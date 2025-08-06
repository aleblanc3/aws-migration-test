import csv
import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import random
import subprocess
import logging
from typing import Dict, List, Optional
from urllib.parse import urlparse
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraping.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, min_delay: int = 1, max_delay: int = 5):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.last_request_time = 0

    def wait(self) -> None:
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time
        if time_since_last_request < self.min_delay:
            delay = random.uniform(self.min_delay, self.max_delay)
            time.sleep(delay)
        self.last_request_time = time.time()

class URLScraper:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; CRA-data-usability-script/v1.0/0.00; +; )'
        }
        self.rate_limiter = RateLimiter()
        self.allowed_tags = ['h1', 'h2', 'h3', 'h4', 'p']

    def validate_url(self, url: str) -> bool:
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False

    def scrape_url(self, url: str) -> str:
        if not self.validate_url(url):
            return 'Invalid URL format'

        try:
            self.rate_limiter.wait()
            response = requests.get(url, headers=self.headers, allow_redirects=False, timeout=30)
            
            if response.status_code == 301:
                return 'redirected'
            elif response.status_code != 200:
                return f'Failed to fetch content - Status code: {response.status_code}'

            soup = BeautifulSoup(response.text, 'html.parser')
            main_element = self._find_main_element(soup)
            
            if not main_element:
                return 'Main element not found on the page'

            return self._extract_content(main_element)

        except requests.Timeout:
            return 'Request timed out'
        except requests.RequestException as e:
            return f'Request failed: {str(e)}'
        except Exception as e:
            logger.error(f'Error scraping {url}: {str(e)}')
            return str(e)

    def _find_main_element(self, soup: BeautifulSoup) -> Optional[BeautifulSoup]:
        main_selectors = [
            {'attrs': {'property': 'mainContentOfPage', 'resource': '#wb-main', 'typeof': 'WebPageElement'}},
            {'attrs': {'property': 'mainContentOfPage', 'resource': '#wb-main', 'typeof': 'WebPageElement', 'class': 'col-md-9 col-md-push-3'}},
            {'attrs': {'role': 'main', 'property': 'mainContentOfPage', 'class': 'container'}},
            {'attrs': {'role': 'main', 'property': 'mainContentOfPage'}}  
        ]

        for selector in main_selectors:
            elements = soup.find_all('main', **selector)
            for element in elements:
                if 'class' not in element.attrs or 'container' in element.attrs.get('class', []):
                    # If we found a main element with a container div inside, return the container div
                    container_div = element.find('div', class_='container')
                    if container_div and selector == main_selectors[-1]:  # Only for the newly added selector
                        logger.info("Found main element with container div inside")
                        return container_div
                    return element
                    
        # If we didn't find a match with the selectors, try a more generic approach
        main_element = soup.find('main', role='main')
        if main_element:
            logger.info("Found main element using generic selector")
            container_div = main_element.find('div', class_='container')
            if container_div:
                logger.info("Found container div inside main element")
                return container_div
            return main_element
            
        return None

    def _extract_content(self, main_element: BeautifulSoup) -> str:
        unwanted_sections = [
            'provisional most-requested-bullets well well-sm brdr-0',
            'pagedetails container',
            'lnkbx',
            'pagedetails',
            'gc-prtts',
            'alert alert-info',
            'footer',
            'nav',
            'header',
            'aside'
        ]
        
        # Remove unwanted sections by class
        for unwanted_class in unwanted_sections:
            sections = main_element.find_all(class_=unwanted_class)
            for section in sections:
                section.decompose()
                
        # Also remove unwanted sections by tag name
        for tag_name in ['footer', 'nav', 'header', 'aside']:
            elements = main_element.find_all(tag_name)
            for element in elements:
                element.decompose()

        # Remove navigation elements
        h2_elements = main_element.find_all('h2', class_='h3', string=lambda text: text and ("On this page:" in text or "Sur cette page :" in text))
        for h2 in h2_elements:
            next_sibling = h2.find_next_sibling()
            if next_sibling and next_sibling.name == 'ul':
                h2.decompose()
                next_sibling.decompose()

        # Extract content from allowed tags
        scraped_content = []
        for tag in self.allowed_tags:
            elements = main_element.find_all(tag)
            for element in elements:
                # Skip chat elements and empty elements
                if tag == 'h2' and any(text in element.get_text() for text in ['Chat with Charlie', 'Clavardez avec Charlie']):
                    continue
                    
                text = element.get_text().strip()
                if text:  # Only add non-empty text
                    scraped_content.append(text)

        # Join content with proper spacing
        joined_content = ' '.join(scraped_content)
        
        # Log content length for debugging
        logger.info(f"Extracted {len(joined_content)} characters of content")
        if len(joined_content) < 100:
            logger.warning(f"Very short content extracted: '{joined_content}'")
        elif len(joined_content) > 2500:
            logger.info(f"Content truncated from {len(joined_content)} to 2500 characters")
            
        # Return content, truncated if necessary
        return joined_content[:2500]

class CSVProcessor:
    def __init__(self, input_file: str, output_file: str):
        self.input_file = Path(input_file)
        self.output_file = Path(output_file)
        self.scraper = URLScraper()

    @staticmethod
    def is_french_url(url: str) -> bool:
        return '/fr/' in url.lower()

    def validate_files(self) -> tuple[bool, bool]:
        """
        Validates input CSV file and determines its format.
        Returns (is_paired_urls, expect_content) tuple.
        """
        if not self.input_file.exists():
            raise FileNotFoundError(f"Input file not found: {self.input_file}")
        if not self.input_file.suffix == '.csv':
            raise ValueError("Input file must be a CSV file")
        
        with open(self.input_file, 'r', encoding='utf-8') as infile:
            reader = csv.reader(infile)
            header = next(reader, None)
            if not header:
                raise ValueError("CSV file must have a header row")
            
            header_set = {col.lower() for col in header}
            
            # Check for pre-scraped content format
            if {'english url', 'english scraped content', 'french url', 'french scraped content'}.issubset(header_set):
                return True, True
            
            # Check for paired URLs format
            if {'english_url', 'french_url'}.issubset(header_set):
                return True, False
            
            # Check for single URLs format
            if header[0].lower() == 'urls':
                return False, False
            
            raise ValueError("Invalid CSV format. Expected either:\n"
                           "1. 'urls' column for single language URLs\n"
                           "2. 'english_url', 'french_url' columns for paired URLs\n"
                           "3. 'English url', 'English scraped content', 'French url', 'French scraped content' for pre-scraped content")

    def process_single_urls(self, reader: csv.DictReader, total_rows: int) -> List[Dict]:
        """Process CSV with single 'urls' column"""
        output_data = []
        english_urls = []
        french_urls = []
        
        # First, categorize URLs
        for row in reader:
            url = row[reader.fieldnames[0]].strip()
            if url:
                if self.is_french_url(url):
                    french_urls.append(url)
                else:
                    english_urls.append(url)
        
        # Process English URLs
        for i, url in enumerate(english_urls):
            logger.info(f'Processing English URL {i + 1}/{len(english_urls)}: {url}')
            scraped_content = self.scraper.scrape_url(url)
            output_data.append({
                'English url': url,
                'English scraped content': scraped_content,
                'French url': '',
                'French scraped content': ''
            })
        
        # Process French URLs
        for i, url in enumerate(french_urls):
            logger.info(f'Processing French URL {i + 1}/{len(french_urls)}: {url}')
            scraped_content = self.scraper.scrape_url(url)
            output_data.append({
                'English url': '',
                'English scraped content': '',
                'French url': url,
                'French scraped content': scraped_content
            })
        
        return output_data

    def process_paired_urls(self, reader: csv.DictReader, total_rows: int) -> List[Dict]:
        """Process CSV with 'english_url' and 'french_url' columns"""
        output_data = []
        
        for i, row in enumerate(reader):
            en_url = row['english_url'].strip()
            fr_url = row['french_url'].strip()
            
            if not self.is_french_url(fr_url):
                logger.warning(f"French URL does not contain '/fr/': {fr_url}")
                continue
            
            logger.info(f'Processing URL pair {i + 1}/{total_rows}')
            
            en_content = self.scraper.scrape_url(en_url) if en_url else ''
            fr_content = self.scraper.scrape_url(fr_url) if fr_url else ''
            
            output_data.append({
                'English url': en_url,
                'English scraped content': en_content,
                'French url': fr_url,
                'French scraped content': fr_content
            })
        
        return output_data

    def process(self) -> None:
        try:
            is_paired_urls, expect_content = self.validate_files()
            output_data = []
            
            with open(self.input_file, 'r', newline='', encoding='utf-8') as infile:
                reader = csv.DictReader(infile)
                total_rows = sum(1 for _ in open(self.input_file)) - 1
                
                if expect_content:
                    logger.info("Processing pre-scraped content from CSV")
                    output_data = [row for row in reader]
                elif is_paired_urls:
                    logger.info("Processing paired English-French URLs")
                    output_data = self.process_paired_urls(reader, total_rows)
                else:
                    logger.info("Processing single language URLs")
                    output_data = self.process_single_urls(reader, total_rows)

            logger.info(f'Writing {len(output_data)} entries to CSV')
            fieldnames = [
                'English url', 'English scraped content',
                'French url', 'French scraped content'
            ]
            
            with open(self.output_file, 'w', newline='', encoding='utf-8') as outfile:
                writer = csv.DictWriter(outfile, fieldnames=fieldnames)
                writer.writeheader()
                for data in output_data:
                    writer.writerow(data)
            logger.info(f'Data saved to {self.output_file}')

            self._run_metadata_generator()

        except Exception as e:
            logger.error(f"Error processing CSV: {str(e)}")
            raise

    def _run_metadata_generator(self) -> None:
        try:
            logger.info("Starting metadata generation...")
            result = subprocess.run(
                [sys.executable, 'metadata_generator.py'],
                capture_output=True,
                text=True,
                check=True
            )
            logger.info("Metadata generation completed successfully")
        except subprocess.CalledProcessError as e:
            logger.error(f"Metadata generation failed: {e.stderr}")
            raise
        except Exception as e:
            logger.error(f"Error running metadata generator: {str(e)}")
            raise

def main():
    try:
        import argparse
        parser = argparse.ArgumentParser(description='Process URLs and generate metadata')
        parser.add_argument('--input', default='inputtoscrape.csv', help='Input CSV file path')
        parser.add_argument('--output', default='scraped_content.csv', help='Output CSV file path')
        args = parser.parse_args()
        
        processor = CSVProcessor(args.input, args.output)
        processor.process()
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
