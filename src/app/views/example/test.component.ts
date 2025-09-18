import { Component, OnInit, inject } from '@angular/core'; //remove OnInit if not using
import { TranslateModule, TranslateService } from "@ngx-translate/core";

//Shared components
import { HorizontalRadioButtonsComponent } from '../../components/horizontal-radio-buttons/horizontal-radio-buttons.component';
import { ViewOption, WebViewType } from '../page-assistant/data/data.model';

//Needed for linking to page compare tool
import { UrlDataService } from '../page-assistant/services/url-data.service';
import { UploadStateService } from '../page-assistant/services/upload-state.service';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';

//Fetch service
import { FetchService } from '../../services/fetch.service';

@Component({
  selector: 'ca-test',
  imports: [TranslateModule, HorizontalRadioButtonsComponent, TableModule, Button],
  templateUrl: './test.component.html',
  styles: ``
})
export class TestComponent implements OnInit {
  //inject any services you're using
  private urlDataService = inject(UrlDataService);
  private uploadState = inject(UploadStateService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private fetchService = inject(FetchService);

  //Your functions go here

  //This runs once after the constuctor, delete if not needed.
  ngOnInit(): void {
    console.log(`Test page - your API key is: localStorage.getItem('apiKey')`);
  }

  //Horizontal radio button example
  yourSelectedButton: WebViewType = WebViewType.Diff;

  yourArray: ViewOption<WebViewType>[] = [
    { label: 'page.compare.view.original', value: WebViewType.Original, icon: 'pi pi-file' },
    { label: 'page.compare.view.modified', value: WebViewType.Modified, icon: 'pi pi-file-edit' },
    { label: 'page.compare.view.diff', value: WebViewType.Diff, icon: 'pi pi-sort-alt' }
  ];

  // Your function to determine what happens when radio buttons are selected
  yourFunction(viewType: WebViewType) {
    this.yourSelectedButton = viewType;
    console.warn(`Option changed to: `, viewType);
  }

  // Fetches URL content and navigates to page assistant compare tool

  error = '';
  loading = false;

  async fetchAndGoToCompare(url: string): Promise<void> {

    const unknownError = this.translate.instant('page.upload.error.unknown');
    const tryError = this.translate.instant('page.upload.url.error.try');
    this.loading = true;
    this.error = '';

    try {
      const mainHTML = await this.urlDataService.fetchAndProcess(url);

      this.uploadState.setUploadData({
        originalUrl: url,
        originalHtml: mainHTML.html,
        modifiedUrl: url,
        modifiedHtml: mainHTML.html,
        found: {
          original: mainHTML.found,
          modified: mainHTML.found
        }
      });

      this.router.navigate(['page-assistant/compare']);

    } catch (err: unknown) {
      if (err instanceof Error) {
        this.error = `${tryError} ${err.message}`;
      }
      else if (typeof err === 'string') {
        this.error = `${tryError} ${err}`;
      }
      else {
        this.error = `${unknownError}`;
      }
    } finally {
      this.loading = false;
    }
  }

  //Sample data for table
  links = [
    { title: 'Taxes', url: 'https://www.canada.ca/en/services/taxes.html' },
    { title: 'Scams and fraud - CRA', url: 'https://www.canada.ca/en/revenue-agency/corporate/scams-fraud.html' },
    { title: 'Income earned illegally is taxable', url: 'https://www.canada.ca/en/revenue-agency/corporate/scams-fraud/income-earned-illegally-taxable.html' },
    { title: 'Return a payment - Canada Dental Benefit - Closed', url: 'https://www.canada.ca/en/revenue-agency/services/child-family-benefits/dental-benefit/return-payment.html' },

  ];

  //Example for fetch service
  testUrls = ["https://www.canada.ca/en/revenue-agency/services/child-family-benefits/goods-services-tax-harmonized-sales-tax-gst-hst-credit.html",
    "https://cra-design.github.io/gst-hst-business/en/topics/gst-hst-businesses.html",
    "https://www.canada.ca/en/revenue-agency/services/child-family-benefits/goods-services-tax-harmonized-sales-tax-gst-hst-credit.htm",
    "https://www.canada.ca/en/broken-link-example.html",
    "https://test.canada.ca/cra-arc/payroll/index.html"]

  async testFetch() {
    for (const url of this.testUrls) {
      try {
        const data = await this.fetchService.fetchContent(url, "both", 5);
        console.log(data);
      } catch (error) { console.error(error); }
    }
  }
}
