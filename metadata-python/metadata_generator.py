import csv
import logging
import requests
import langdetect
from dataclasses import dataclass
from typing import Dict, List, Optional, Iterator
import backoff
from pathlib import Path
import sys
import json
from tqdm import tqdm
import os
import time
import random

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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('metadata_script.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class Config:
    model_name: str
    api_url: str = "https://openrouter.ai/api/v1/chat/completions"
    
    @classmethod
    def load_config(cls, config_path: Optional[str] = None, model_name: Optional[str] = None) -> 'Config':
        default_config = {
            "model_name": "mistralai/mixtral-8x7b-instruct",
            "api_url": "https://openrouter.ai/api/v1/chat/completions"
        }
        
        if config_path:
            try:
                with open(config_path, 'r') as f:
                    config_data = json.load(f)
                    default_config.update(config_data)
            except Exception as e:
                logger.warning(f"Failed to load config file: {e}. Using defaults.")
        
        # Override model_name if provided
        if model_name:
            default_config["model_name"] = model_name
            logger.info(f"Using model: {model_name}")
        
        return cls(**default_config)

class ContentProcessor:
    def __init__(self, text: str):
        self.text = text.strip() if text else ""
    
    def is_valid(self) -> bool:
        # Check if content is non-empty and has sufficient length for meaningful analysis
        if not self.text:
            logger.warning("Content is empty")
            return False
            
        if len(self.text) < 50:
            logger.warning(f"Content is too short: {len(self.text)} characters")
            return False
            
        # Check if content has enough words (not just whitespace or special characters)
        words = [w for w in self.text.split() if w.strip()]
        if len(words) < 10:
            logger.warning(f"Content has too few words: {len(words)} words")
            return False
            
        logger.info(f"Content validated: {len(self.text)} characters, {len(words)} words")
        return True

    @staticmethod
    def detect_language(text: str) -> str:
        if not text or len(text.strip()) < 10:
            logger.warning("Text too short for language detection, defaulting to English")
            return 'en'
            
        try:
            # Use more text for better language detection
            sample = text[:1000] if len(text) > 1000 else text
            lang = langdetect.detect(sample)
            logger.info(f"Detected language: {lang}")
            return lang
        except langdetect.lang_detect_exception.LangDetectException as e:
            logger.warning(f"Language detection failed: {str(e)}, defaulting to English")
            return 'en'

class MetadataProcessor:
    def __init__(self, config: Config):
        self.config = config
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is not set")
        self.api_url = config.api_url
        self.rate_limiter = RateLimiter(min_delay=3, max_delay=5)  # Add delay between API calls
        
        # Log the model being used
        logger.info(f"Initializing MetadataProcessor with model: {config.model_name} using API URL: {self.api_url}")
        
    def translate_to_french(self, text: str, is_description: bool = True) -> str:
        # Check if using OpenAI model
        using_openai = "openai/gpt" in self.config.model_name.lower()
        
        if is_description:
            prompt_text = (
                "Translate the following English meta description to French. IMPORTANT: Your response must contain ONLY the direct translation, "
                "with absolutely NO commentary, NO suggestions, NO explanations, and NO additional text of any kind. "
                "Return ONLY the translated text itself:\n\n"
                f"{text}\n\n"
                "French translation:"
            )
            
            try:
                # First attempt with the selected model
                translated = self._make_completion_call(
                    prompt_text=prompt_text,
                    max_tokens=200,
                    temperature=0.3,
                    model_name=self.config.model_name
                )
                
                # Check if we got a valid response
                if using_openai and (not translated or translated == "" or translated.startswith("Error extracting content") or translated.startswith("Failed to extract")):
                    logger.warning("OpenAI model failed to translate description, falling back to GPT-4.1")
                    # Fall back to GPT-4.1 model
                    translated = self._make_completion_call(
                        prompt_text=prompt_text,
                        max_tokens=200,
                        temperature=0.3,
                        model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                    )
                    logger.info("Successfully translated description using GPT-4.1 fallback model")
                
                # Post-processing to remove any commentary
                if ":" in translated:
                    # If there's a colon, it might be separating commentary from translation
                    parts = translated.split(":", 1)
                    if len(parts) > 1 and len(parts[1].strip()) > 10:  # Ensure we're not just removing part of the translation
                        translated = parts[1].strip()
                
                # Remove common commentary phrases
                commentary_phrases = [
                    "Voici la traduction", "La traduction est", "Traduction:",
                    "En français:", "Je traduis:", "Traduction française:"
                ]
                for phrase in commentary_phrases:
                    if translated.startswith(phrase):
                        translated = translated[len(phrase):].strip()
                
                return translated
            except Exception as e:
                logger.error(f"Error translating description with primary model: {str(e)}")
                if using_openai:
                    logger.info("Falling back to GPT-4.1 model after exception")
                    try:
                        # Fall back to GPT-4.1 model
                        translated = self._make_completion_call(
                            prompt_text=prompt_text,
                            max_tokens=200,
                            temperature=0.3,
                            model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                        )
                        logger.info("Successfully translated description using GPT-4.1 fallback model after exception")
                        return translated
                    except Exception as fallback_error:
                        logger.error(f"Fallback model also failed: {str(fallback_error)}")
                        return "Failed to translate description. Please try again with a different model."
                else:
                    return "Failed to translate description. Please try again with a different model."
        else:
            # For keywords, ensure comma-delimited format
            prompt_text = (
                "Translate each of these English keywords to French. IMPORTANT: Return ONLY the translated keywords "
                "in a comma-separated list. Provide absolutely NO commentary, NO suggestions, NO explanations, and NO additional text of any kind. "
                "Return ONLY a comma-separated list of the translated keywords:\n\n"
                f"{text}\n\n"
                "French keywords (comma-separated):"
            )
            
            try:
                # First attempt with the selected model
                translated = self._make_completion_call(
                    prompt_text=prompt_text,
                    max_tokens=80,
                    temperature=0.3,
                    model_name=self.config.model_name
                )
                
                # Check if we got a valid response
                if using_openai and (not translated or translated == "" or translated.startswith("Error extracting content") or translated.startswith("Failed to extract")):
                    logger.warning("OpenAI model failed to translate keywords, falling back to GPT-4.1")
                    # Fall back to GPT-4.1 model
                    translated = self._make_completion_call(
                        prompt_text=prompt_text,
                        max_tokens=80,
                        temperature=0.3,
                        model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                    )
                    logger.info("Successfully translated keywords using GPT-4.1 fallback model")
            except Exception as e:
                logger.error(f"Error translating keywords with primary model: {str(e)}")
                if using_openai:
                    logger.info("Falling back to GPT-4.1 model after exception")
                    try:
                        # Fall back to GPT-4.1 model
                        translated = self._make_completion_call(
                            prompt_text=prompt_text,
                            max_tokens=80,
                            temperature=0.3,
                            model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                        )
                        logger.info("Successfully translated keywords using GPT-4.1 fallback model after exception")
                    except Exception as fallback_error:
                        logger.error(f"Fallback model also failed: {str(fallback_error)}")
                        return "Failed to translate keywords. Please try again with a different model."
                else:
                    return "Failed to translate keywords. Please try again with a different model."
            
            # Post-processing to remove any commentary
            if ":" in translated:
                # If there's a colon, it might be separating commentary from translation
                parts = translated.split(":", 1)
                if len(parts) > 1 and len(parts[1].strip()) > 10:  # Ensure we're not just removing part of the translation
                    translated = parts[1].strip()
            
            # Remove common commentary phrases
            commentary_phrases = [
                "Voici les mots-clés", "Les mots-clés sont", "Mots-clés:",
                "En français:", "Je traduis:", "Traduction française:"
            ]
            for phrase in commentary_phrases:
                if translated.startswith(phrase):
                    translated = translated[len(phrase):].strip()
            
            # Clean up the response to ensure proper comma-delimited format
            keywords = [k.strip() for k in translated.split(',')]
            return ', '.join(k for k in keywords if k)
        
    def review_french_meta_description(self, french_content: str, translated_desc: str) -> str:
        # Check if using OpenAI model
        using_openai = "openai/gpt" in self.config.model_name.lower()
        
        prompt_text = (
            "As a bilingual SEO expert fluent in French, review the following translated meta description against the original French content. "
            "Analyze for:\n"
            "1. Translation accuracy and naturalness\n"
            "2. SEO effectiveness in French\n"
            "3. Cultural and linguistic appropriateness\n"
            "4. Consistency with the original content\n\n"
            "Provide specific suggestions for improvements if needed.\n\n"
            f"French Content: {french_content}\n\n"
            f"Translated Meta Description: {translated_desc}\n\n"
            "Analysis and Suggestions:"
        )
        
        try:
            # First attempt with the selected model
            # Always use openai/gpt-4.1 for French review functionality
            review = self._make_completion_call(
                prompt_text=prompt_text,
                max_tokens=400,
                temperature=0.3,
                model_name="openai/gpt-4.1"
            )
            
            # Check if we got a valid response
            if using_openai and (not review or review == "" or review.startswith("Error extracting content") or review.startswith("Failed to extract")):
                logger.warning("OpenAI model failed to review description, falling back to GPT-4.1")
                # Fall back to GPT-4.1 model
                # Use the same model (openai/gpt-4.1) for fallback
                review = self._make_completion_call(
                    prompt_text=prompt_text,
                    max_tokens=400,
                    temperature=0.3,
                    model_name="openai/gpt-4.1"
                )
                logger.info("Successfully reviewed description using GPT-4.1 fallback model")
            
            return review
        except Exception as e:
            logger.error(f"Error reviewing description with primary model: {str(e)}")
            if using_openai:
                logger.info("Falling back to GPT-4.1 model after exception")
                try:
                    # Fall back to Gemini 2.5 Flash model
                    # Use the same model (openai/gpt-4.1) for fallback
                    review = self._make_completion_call(
                        prompt_text=prompt_text,
                        max_tokens=400,
                        temperature=0.3,
                        model_name="openai/gpt-4.1"
                    )
                    logger.info("Successfully reviewed description using GPT-4.1 fallback model after exception")
                    return review
                except Exception as fallback_error:
                    logger.error(f"Fallback model also failed: {str(fallback_error)}")
                    return "Failed to review description. Please try again with a different model."
            else:
                return "Failed to review description. Please try again with a different model."
        
    def review_french_keywords(self, french_content: str, translated_keywords: str) -> str:
        # Check if using OpenAI model
        using_openai = "openai/gpt" in self.config.model_name.lower()
        
        prompt_text = (
            "As a bilingual SEO expert fluent in French, review the following translated keywords against the original French content. "
            "Analyze for:\n"
            "1. Translation accuracy and relevance\n"
            "2. SEO effectiveness for French market\n"
            "3. Cultural and market appropriateness\n"
            "4. Consistency with French industry terminology\n\n"
            "Provide specific suggestions for improvements if needed.\n\n"
            f"French Content: {french_content}\n\n"
            f"Translated Keywords: {translated_keywords}\n\n"
            "Analysis and Suggestions:"
        )
        
        try:
            # First attempt with the selected model
            # Always use openai/gpt-4.1 for French review functionality
            review = self._make_completion_call(
                prompt_text=prompt_text,
                max_tokens=400,
                temperature=0.3,
                model_name="openai/gpt-4.1"
            )
            
            # Check if we got a valid response
            if using_openai and (not review or review == "" or review.startswith("Error extracting content") or review.startswith("Failed to extract")):
                logger.warning("OpenAI model failed to review keywords, falling back to GPT-4.1")
                # Fall back to GPT-4.1 model
                # Use the same model (openai/gpt-4.1) for fallback
                review = self._make_completion_call(
                    prompt_text=prompt_text,
                    max_tokens=400,
                    temperature=0.3,
                    model_name="openai/gpt-4.1"
                )
                logger.info("Successfully reviewed keywords using GPT-4.1 fallback model")
            
            return review
        except Exception as e:
            logger.error(f"Error reviewing keywords with primary model: {str(e)}")
            if using_openai:
                logger.info("Falling back to GPT-4.1 model after exception")
                try:
                    # Fall back to Gemini 2.5 Flash model
                    # Use the same model (openai/gpt-4.1) for fallback
                    review = self._make_completion_call(
                        prompt_text=prompt_text,
                        max_tokens=400,
                        temperature=0.3,
                        model_name="openai/gpt-4.1"
                    )
                    logger.info("Successfully reviewed keywords using GPT-4.1 fallback model after exception")
                    return review
                except Exception as fallback_error:
                    logger.error(f"Fallback model also failed: {str(fallback_error)}")
                    return "Failed to review keywords. Please try again with a different model."
            else:
                return "Failed to review keywords. Please try again with a different model."

    @staticmethod
    def truncate_summary(summary: str, max_length: int = 250) -> str:
        if len(summary) > max_length:
            last_full_stop = summary.rfind('.', 0, max_length)
            return summary[:last_full_stop + 1] if last_full_stop != -1 else summary[:max_length]
        return summary

    @backoff.on_exception(
        backoff.expo,
        (Exception,),
        max_tries=3,
        on_backoff=lambda details: logger.warning(f"Retrying API call: {details}")
    )
    def _make_completion_call(
        self,
        prompt_text: str,
        max_tokens: int,
        temperature: float,
        model_name: str = None
    ) -> str:
        self.rate_limiter.wait()  # Add rate limiting between API calls
        try:
            # Base headers
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://metadata-generator.app",  # Add a referer for tracking
                "X-Title": "Metadata Generator App"  # Add a title for tracking
            }
            
            # Add model-specific headers
            model = model_name or self.config.model_name
            if "openai/gpt" in model.lower():
                # Standard headers for OpenAI
                # Using only standard headers for better compatibility
                logger.info("Using standard headers for OpenAI model")
            
            # Use provided model or default from config
            model = model_name or self.config.model_name
            
            # Log the model being used for this specific call
            logger.info(f"Making API call with model: {model}")
            
            # Different payload format based on model
            if "anthropic" in model.lower():
                # Claude format with enhanced parameters
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt_text}],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "top_p": 0.9,  # Add top_p for better control
                    "stop": ["###"]  # Add stop sequence to prevent runaway generation
                }
                logger.info("Using enhanced Claude API format")
            elif "openai/gpt" in model.lower():
                # OpenAI format
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt_text}],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "top_p": 1.0,
                    "frequency_penalty": 0.0,
                    "presence_penalty": 0.0
                }
                logger.info("Using OpenAI API format")
            # Removed Llama-specific handling
            else:
                # Default OpenRouter format
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt_text}],
                    "max_tokens": max_tokens,
                    "temperature": temperature
                }
                logger.info("Using standard API format")
            
            logger.info(f"Sending request to: {self.api_url}")
            logger.info(f"Request payload: {json.dumps(payload, indent=2)}")
            
            try:
                # For OpenAI model, add retry logic with exponential backoff
                if "openai/gpt" in model.lower():
                    max_retries = 3
                    retry_count = 0
                    retry_delay = 2  # Initial delay in seconds
                    
                    while retry_count < max_retries:
                        try:
                            logger.info(f"OpenAI API call attempt {retry_count + 1}/{max_retries}")
                            response = requests.post(self.api_url, headers=headers, json=payload, timeout=60)
                            response.raise_for_status()
                            
                            # Log response status and headers for debugging
                            logger.info(f"Response status: {response.status_code}")
                            logger.info(f"Response headers: {dict(response.headers)}")
                            
                            response_data = response.json()
                            
                            # Check if response has valid content
                            if response_data.get("choices") or response_data.get("candidates"):
                                logger.info("Received valid response from OpenAI")
                                break
                            else:
                                logger.warning(f"OpenAI response missing expected fields: {str(response_data)[:200]}...")
                                if retry_count < max_retries - 1:
                                    retry_count += 1
                                    logger.info(f"Retrying in {retry_delay} seconds...")
                                    time.sleep(retry_delay)
                                    retry_delay *= 2  # Exponential backoff
                                else:
                                    logger.error("Max retries reached for OpenAI model")
                                    break
                        except Exception as e:
                            if retry_count < max_retries - 1:
                                retry_count += 1
                                logger.warning(f"OpenAI API call failed: {str(e)}. Retrying in {retry_delay} seconds...")
                                time.sleep(retry_delay)
                                retry_delay *= 2  # Exponential backoff
                            else:
                                logger.error(f"All OpenAI API call attempts failed: {str(e)}")
                                raise
                else:
                    # Standard API call for other models
                    response = requests.post(self.api_url, headers=headers, json=payload, timeout=60)
                    response.raise_for_status()  # Raise exception for HTTP errors
                    
                    # Log response status and headers for debugging
                    logger.info(f"Response status: {response.status_code}")
                    logger.info(f"Response headers: {dict(response.headers)}")
                    
                    response_data = response.json()
            except requests.exceptions.RequestException as e:
                logger.error(f"Request failed: {str(e)}")
                if hasattr(e, 'response') and e.response:
                    logger.error(f"Response status: {e.response.status_code}")
                    logger.error(f"Response content: {e.response.text[:500]}...")
                raise
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}")
                logger.error(f"Raw response: {response.text[:500]}...")
                raise
            
            # Log the response structure for debugging
            logger.info(f"Response structure: {json.dumps(response_data, indent=2)[:500]}...")
            
            # Extract content based on model
            try:
                if "openai/gpt" in model.lower():
                    # Enhanced OpenAI response handling
                    logger.info("Processing OpenAI model response")
                    
                    # Check for empty content first
                    if (response_data.get("choices") and
                        response_data["choices"][0].get("message") and
                        response_data["choices"][0]["message"].get("content") == ""):
                        logger.warning("OpenAI returned empty content - immediately falling back to GPT-4.1")
                        
                        # Immediate fallback to GPT-4.1
                        if model_name and model_name == "openai/gpt-4.1":
                            logger.info("Immediately retrying with GPT-4.1 model")
                            return self._make_completion_call(
                                prompt_text=prompt_text,
                                max_tokens=max_tokens,
                                temperature=temperature,
                                model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                            )
                        content = ""
                        
                    # Try standard OpenRouter format
                    elif response_data.get("choices") and response_data["choices"][0].get("message") and response_data["choices"][0]["message"].get("content"):
                        content = response_data["choices"][0]["message"]["content"].strip()
                        logger.info("Extracted content using standard OpenRouter format")
                    
                    # Try alternative formats
                    elif response_data.get("choices") and response_data["choices"][0].get("text"):
                        content = response_data["choices"][0]["text"].strip()
                        logger.info("Extracted content using alternative 'text' format")
                    
                    # Try native OpenAI API format
                    elif response_data.get("candidates"):
                        candidates = response_data["candidates"]
                        logger.info(f"Found candidates in response: {json.dumps(candidates, indent=2)[:300]}...")
                        
                        if candidates and isinstance(candidates, list) and len(candidates) > 0:
                            candidate = candidates[0]
                            
                            # Try different candidate formats
                            if candidate.get("content") and candidate["content"].get("parts"):
                                parts = candidate["content"]["parts"]
                                if parts and isinstance(parts, list) and len(parts) > 0:
                                    if parts[0].get("text"):
                                        content = parts[0]["text"].strip()
                                        logger.info("Extracted content from candidates.content.parts[0].text")
                                    else:
                                        content = str(parts[0])
                                        logger.info(f"Extracted content from parts[0] object: {content[:100]}...")
                                else:
                                    content = str(candidate["content"])
                                    logger.info(f"Extracted content from candidate content: {content[:100]}...")
                            elif candidate.get("text"):
                                content = candidate["text"].strip()
                                logger.info("Extracted content from candidate.text")
                            else:
                                content = str(candidate)
                                logger.info(f"Extracted content from candidate object: {content[:100]}...")
                        else:
                            content = str(response_data)
                            logger.info(f"No valid candidates found, using full response: {content[:100]}...")
                    
                    # Deep recursive search for any text content
                    else:
                        logger.warning("Using deep recursive search for content in OpenAI response")
                        content = "No content found in response"
                        
                        def find_text_content(obj, depth=0, max_depth=5):
                            if depth > max_depth:
                                return None
                                
                            if isinstance(obj, str) and len(obj.strip()) > 10:
                                return obj
                                
                            if isinstance(obj, dict):
                                # Check common keys first
                                for key in ["content", "text", "message", "value", "result", "output"]:
                                    if key in obj and isinstance(obj[key], str) and len(obj[key].strip()) > 10:
                                        return obj[key]
                                
                                # Recursively search all dict values
                                for key, value in obj.items():
                                    result = find_text_content(value, depth + 1, max_depth)
                                    if result:
                                        return result
                                        
                            if isinstance(obj, list):
                                for item in obj:
                                    result = find_text_content(item, depth + 1, max_depth)
                                    if result:
                                        return result
                                        
                            return None
                            
                        found_content = find_text_content(response_data)
                        if found_content:
                            content = found_content.strip()
                            logger.info(f"Found content through deep search: {content[:100]}...")
                        else:
                            # Last resort - immediate fallback to Gemini 2.5 Flash
                            logger.error("Failed to extract any meaningful content from OpenAI response")
                            if model_name and model_name == "openai/gpt-4.1":
                                logger.info("Immediately retrying with GPT-4.1 model after failed content extraction")
                                return self._make_completion_call(
                                    prompt_text=prompt_text,
                                    max_tokens=max_tokens,
                                    temperature=temperature,
                                    model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                                )
                            content = f"Failed to extract content from OpenAI response. Raw response: {str(response_data)[:500]}..."
                elif "anthropic" in model.lower():
                    # Enhanced Claude response handling
                    if response_data.get("choices") and response_data["choices"][0].get("message") and response_data["choices"][0]["message"].get("content"):
                        content = response_data["choices"][0]["message"]["content"].strip()
                        logger.info("Extracted content from Claude using standard format")
                    else:
                        # Try alternative formats or fallback
                        logger.warning("Claude response in unexpected format, attempting to extract content")
                        content = str(response_data)
                        # Try to find any text content in the response
                        if isinstance(response_data, dict):
                            for key in ["content", "text", "message", "output", "completion"]:
                                if key in response_data and isinstance(response_data[key], str):
                                    content = response_data[key].strip()
                                    logger.info(f"Extracted Claude content from '{key}' field")
                                    break
                # Removed Llama-specific handling
                else:
                    content = response_data["choices"][0]["message"]["content"].strip() if response_data.get("choices") else ""
                
                # Log the extracted content
                logger.info(f"Extracted content: {content[:100]}...")
            except Exception as e:
                logger.error(f"Error extracting content from response: {str(e)}")
                logger.error(f"Response data: {str(response_data)[:500]}...")
                # Return a fallback message
                content = "Error extracting content from model response. Please check logs."
                
            return content
        except Exception as e:
            logger.error(f"API call failed: {str(e)}")
            raise

    def summarize_content(self, content: str) -> str:
        processor = ContentProcessor(content)
        if not processor.is_valid():
            return "Content too short or invalid for summarization"

        language = processor.detect_language(content)
        
        # Log content length for debugging
        logger.info(f"Generating meta description for content of length {len(content)} characters in {language} language")
        
        # Truncate content for logging purposes
        log_content = content[:100] + "..." if len(content) > 100 else content
        logger.info(f"Content preview: {log_content}")
        
        # Check which model is being used
        using_openai = "openai/gpt" in self.config.model_name.lower()
        using_claude = "anthropic/claude" in self.config.model_name.lower()
        
        prompt_text = (
            "As a search engine optimization expert, analyze the following content carefully and provide a concise, complete summary suitable "
            "for a meta description in English. The summary MUST be highly relevant to the specific content provided and capture its main topic and purpose. "
            "Use topic-specific terms found in the content, write in full sentences, "
            "and ensure the summary ends concisely within 275 characters. Avoid using ellipses or cutting off sentences. "
            "IMPORTANT: Provide ONLY the meta description itself with NO additional commentary or explanations.\n\n"
            f"{content}\n\nSummary:"
        ) if language == 'en' else (
            "En tant qu'expert en référencement et optimisation pour les moteurs de recherche francophones, analysez attentivement le contenu suivant et fournissez un résumé concis et complet adapté "
            "à une méta-description en français de haute qualité. Le résumé DOIT être parfaitement adapté au contenu spécifique fourni et capturer avec précision son sujet et son objectif principal. "
            "Utilisez des termes spécifiques au sujet trouvés dans le contenu, privilégiez un français naturel et idiomatique, écrivez en phrases complètes, "
            "et assurez-vous que le résumé se termine de manière concise dans les 275 caractères. Évitez l'utilisation de points de suspension ou de coupures abruptes. "
            "IMPORTANT: Fournissez UNIQUEMENT la méta-description elle-même SANS commentaire ou explication supplémentaire. "
            "Assurez-vous que la méta-description est optimisée pour les moteurs de recherche francophones. "
            "CRITIQUE: Votre réponse doit être une méta-description COMPLÈTE et NON TRONQUÉE. Ne coupez pas la description au milieu d'une phrase.\n\n"
            f"{content}\n\nRésumé:"
        )
        
        try:
            # First attempt with the selected model
            summary = self._make_completion_call(
                prompt_text=prompt_text,
                max_tokens=200 if language == 'en' else 300,  # Increase token limit for French descriptions
                temperature=0.5,
                model_name=self.config.model_name
            )
            
            # Check if we got a valid response
            if (using_openai or using_claude) and (not summary or summary == "" or summary.startswith("Error extracting content") or summary.startswith("Failed to extract") or len(summary) < 50):
                model_name = "GPT-4.1" if using_openai else "Claude"
                logger.warning(f"{model_name} model failed to generate complete summary, falling back to GPT-4.1")
                # Fall back to GPT-4.1 model
                summary = self._make_completion_call(
                    prompt_text=prompt_text,
                    max_tokens=200 if language == 'en' else 300,  # Increase token limit for French descriptions
                    temperature=0.5,
                    model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                )
                logger.info("Successfully generated summary using GPT-4.1 fallback model")
        except Exception as e:
            logger.error(f"Error generating summary with primary model: {str(e)}")
            if using_openai or using_claude:
                logger.info("Falling back to GPT-4.1 model after exception")
                try:
                    # Fall back to GPT-4.1 model
                    summary = self._make_completion_call(
                        prompt_text=prompt_text,
                        max_tokens=200 if language == 'en' else 300,  # Increase token limit for French descriptions
                        temperature=0.5,
                        model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                    )
                    logger.info("Successfully generated summary using GPT-4.1 fallback model after exception")
                except Exception as fallback_error:
                    logger.error(f"Fallback model also failed: {str(fallback_error)}")
                    return "Failed to generate summary. Please try again with a different model."
            else:
                return "Failed to generate summary. Please try again with a different model."
                
        # Enhanced post-processing to remove any commentary
        # First, check for Claude-specific formatting
        if using_claude:
            # Claude often wraps content in quotes or has specific formatting
            if summary.startswith('"') and summary.endswith('"'):
                summary = summary[1:-1].strip()
            
            # Claude might include markdown formatting
            if summary.startswith('```') and '```' in summary[3:]:
                summary = summary.split('```', 2)[1].strip()
        
        # Check for colon-separated commentary
        if ":" in summary:
            # If there's a colon, it might be separating commentary from summary
            parts = summary.split(":", 1)
            if len(parts) > 1 and len(parts[1].strip()) > 10:  # Ensure we're not just removing part of the summary
                summary = parts[1].strip()
        
        # Remove common commentary phrases
        commentary_phrases = [
            "Here is a summary", "Summary:", "Meta description:", "Here's a summary",
            "Voici un résumé", "Résumé:", "Méta-description:", "Voici une méta-description",
            "Meta Description:", "French Meta Description:", "Description:", "Méta-description en français:"
        ]
        for phrase in commentary_phrases:
            if summary.lower().startswith(phrase.lower()):
                summary = summary[len(phrase):].strip()
                
        # Remove any leading/trailing quotes
        if summary.startswith('"') and summary.endswith('"'):
            summary = summary[1:-1].strip()
        
        return self.truncate_summary(summary)

    def generate_keywords(self, content: str) -> str:
        processor = ContentProcessor(content)
        if not processor.is_valid():
            return "Content too short or invalid for keyword generation"
            
        # Log content length for debugging
        logger.info(f"Generating keywords for content of length {len(content)} characters")
        
        # Determine language for better keyword generation
        language = processor.detect_language(content)
        logger.info(f"Detected language for keyword generation: {language}")
        
        # Check which model is being used
        using_openai = "openai/gpt" in self.config.model_name.lower()
        using_claude = "anthropic/claude" in self.config.model_name.lower()

        prompt_text = (
            "As a search engine optimization expert, carefully analyze the following content and identify 10 meaningful, topic-specific meta keywords "
            "that are DIRECTLY EXTRACTED from or strongly implied by the content. The keywords must be highly relevant to the specific topics discussed "
            "in the content. IMPORTANT: Return ONLY a comma-separated list of keywords with absolutely NO additional notes, explanations, or commentary of any kind. "
            "Exclude 'Canada Revenue Agency' from the keywords. "
            "Focus strictly on providing keywords that would help users find this specific content.:\n\n"
            f"{content}\n\nKeywords:"
        ) if language == 'en' else (
            "En tant qu'expert en optimisation pour les moteurs de recherche, analysez attentivement le contenu suivant et identifiez 10 mots-clés méta significatifs et spécifiques au sujet "
            "qui sont DIRECTEMENT EXTRAITS ou fortement suggérés par le contenu. Les mots-clés doivent être hautement pertinents aux sujets spécifiques abordés "
            "dans le contenu. IMPORTANT: Retournez UNIQUEMENT une liste de mots-clés séparés par des virgules sans AUCUNE note, explication ou commentaire supplémentaire. "
            "Excluez 'Agence du revenu du Canada' des mots-clés. "
            "Concentrez-vous strictement sur la fourniture de mots-clés qui aideraient les utilisateurs à trouver ce contenu spécifique. "
            "CRITIQUE: Fournissez UNIQUEMENT les mots-clés séparés par des virgules, sans aucun texte supplémentaire.\n\n"
            f"{content}\n\nMots-clés:"
        )
        
        try:
            # First attempt with the selected model
            keywords = self._make_completion_call(
                prompt_text=prompt_text,
                max_tokens=100 if language == 'en' else 120,  # Increase token limit for French keywords
                temperature=0.3,
                model_name=self.config.model_name
            )
            
            # Check if we got a valid response
            if (using_openai or using_claude) and (not keywords or keywords == "" or keywords.startswith("Error extracting content") or keywords.startswith("Failed to extract") or len(keywords) < 20):
                model_name = "GPT-4.1" if using_openai else "Claude"
                logger.warning(f"{model_name} model failed to generate complete keywords, falling back to GPT-4.1")
                # Fall back to GPT-4.1 model
                keywords = self._make_completion_call(
                    prompt_text=prompt_text,
                    max_tokens=100 if language == 'en' else 120,  # Increase token limit for French keywords
                    temperature=0.3,
                    model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                )
                logger.info("Successfully generated keywords using GPT-4.1 fallback model")
            
            # Enhanced post-processing to remove any commentary
            # First, check for Claude-specific formatting
            if using_claude:
                # Claude often wraps content in quotes or has specific formatting
                if keywords.startswith('"') and keywords.endswith('"'):
                    keywords = keywords[1:-1].strip()
                
                # Claude might include markdown formatting
                if keywords.startswith('```') and '```' in keywords[3:]:
                    keywords = keywords.split('```', 2)[1].strip()
            
            # Check for colon-separated commentary
            if ":" in keywords:
                # If there's a colon, it might be separating commentary from keywords
                parts = keywords.split(":", 1)
                if len(parts) > 1 and len(parts[1].strip()) > 10:  # Ensure we're not just removing part of the keywords
                    keywords = parts[1].strip()
            
            # Remove common commentary phrases
            commentary_phrases = [
                "Here are the keywords", "Keywords:", "Meta keywords:", "Here are some keywords",
                "The keywords are", "Suggested keywords:", "Mots-clés:", "Voici les mots-clés",
                "Les mots-clés sont", "Mots clés:", "Mots-clés suggérés:", "Keywords in French:"
            ]
            for phrase in commentary_phrases:
                if keywords.lower().startswith(phrase.lower()):
                    keywords = keywords[len(phrase):].strip()
            
            # Remove any leading/trailing quotes
            if keywords.startswith('"') and keywords.endswith('"'):
                keywords = keywords[1:-1].strip()
            
            return keywords
        except Exception as e:
            logger.error(f"Error generating keywords with primary model: {str(e)}")
            if using_openai or using_claude:
                logger.info("Falling back to GPT-4.1 model after exception")
                try:
                    # Fall back to GPT-4.1 model
                    keywords = self._make_completion_call(
                        prompt_text=prompt_text,
                        max_tokens=100 if language == 'en' else 120,  # Increase token limit for French keywords
                        temperature=0.3,
                        model_name="openai/gpt-4.1"  # Use GPT-4.1 for fallback
                    )
                    logger.info("Successfully generated keywords using GPT-4.1 fallback model after exception")
                    return keywords
                except Exception as fallback_error:
                    logger.error(f"Fallback model also failed: {str(fallback_error)}")
                    return "Failed to generate keywords. Please try again with a different model."
            else:
                return "Failed to generate keywords. Please try again with a different model."

class CSVHandler:
    def __init__(self, input_path: str, output_path: str):
        self.input_path = Path(input_path)
        self.output_path = Path(output_path)

    def validate_files(self) -> None:
        if not self.input_path.exists():
            raise FileNotFoundError(f"Input file not found: {self.input_path}")
        if not self.input_path.suffix == '.csv':
            raise ValueError("Input file must be a CSV file")

    def read_csv(self) -> Iterator[Dict]:
        try:
            with open(self.input_path, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                yield from reader
        except UnicodeDecodeError:
            with open(self.input_path, 'r', newline='', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                yield from reader

    def write_row(self, writer: csv.DictWriter, row: Dict) -> None:
        try:
            writer.writerow(row)
        except Exception as e:
            logger.error(f"Error writing row: {e}")
            raise

def main():
    try:
        if not os.getenv("OPENROUTER_API_KEY"):
            logger.error("OPENROUTER_API_KEY environment variable is not set")
            sys.exit(1)
            
        config = Config.load_config()
        processor = MetadataProcessor(config)
        csv_handler = CSVHandler('scraped_content.csv', 'processed_metadata.csv')
        
        csv_handler.validate_files()
        
        total_rows = sum(1 for _ in csv_handler.read_csv())
        
        with open(csv_handler.output_path, 'w', newline='', encoding='utf-8') as outfile:
            fieldnames = [
                'English url', 'English scraped content', 'French url', 'French scraped content',
                'English meta description', 'English meta keywords',
                'French meta description', 'French keywords',
                'Translated English to french meta description', 'Translated English to french meta keywords',
                'French translation meta description review', 'French translation meta keywords review'
            ]
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            
            with tqdm(total=total_rows, desc="Processing content") as pbar:
                for row in csv_handler.read_csv():
                    try:
                        # Generate English metadata
                        with tqdm(total=2, desc="Generating English metadata") as en_pbar:
                            en_description = processor.summarize_content(row['English scraped content'])
                            en_pbar.update(1)
                            
                            en_keywords = processor.generate_keywords(row['English scraped content'])
                            en_pbar.update(1)
                        
                        # Generate French metadata
                        with tqdm(total=2, desc="Generating French metadata") as fr_pbar:
                            fr_description = processor.summarize_content(row['French scraped content'])
                            fr_pbar.update(1)
                            
                            fr_keywords = processor.generate_keywords(row['French scraped content'])
                            fr_pbar.update(1)
                        
                        # Translate English metadata to French
                        with tqdm(total=2, desc="Translating English metadata") as trans_pbar:
                            translated_desc = processor.translate_to_french(en_description, is_description=True)
                            trans_pbar.update(1)
                            
                            translated_keywords = processor.translate_to_french(en_keywords, is_description=False)
                            trans_pbar.update(1)
                        
                        # Review French translations against French content
                        with tqdm(total=2, desc="Reviewing French translations") as review_pbar:
                            desc_review = processor.review_french_meta_description(
                                row['French scraped content'], translated_desc
                            )
                            review_pbar.update(1)
                            
                            keywords_review = processor.review_french_keywords(
                                row['French scraped content'], translated_keywords
                            )
                            review_pbar.update(1)
                        
                        output_row = {
                            'English url': row['English url'],
                            'English scraped content': row['English scraped content'],
                            'French url': row['French url'],
                            'French scraped content': row['French scraped content'],
                            'English meta description': en_description,
                            'English meta keywords': en_keywords,
                            'French meta description': fr_description,
                            'French keywords': fr_keywords,
                            'Translated English to french meta description': translated_desc,
                            'Translated English to french meta keywords': translated_keywords,
                            'French translation meta description review': desc_review,
                            'French translation meta keywords review': keywords_review
                        }
                        
                        csv_handler.write_row(writer, output_row)
                        pbar.update(1)
                        
                    except Exception as e:
                        logger.error(f"Error processing row: {e}")
                        continue

        logger.info(f'Metadata generation completed. Results saved to {csv_handler.output_path}')
        sys.exit(0)  # Explicitly exit after completion
        
    except Exception as e:
        logger.error(f"Script failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
