import { Component, OnInit } from '@angular/core'; //remove OnInit if not using
import { TranslateModule, TranslateService } from "@ngx-translate/core";

//Shared components
import { HorizontalRadioButtonsComponent } from '../../components/horizontal-radio-buttons/horizontal-radio-buttons.component';
import { ViewOption, WebViewType } from '../../common/data.types';

//Needed for linking to page compare tool
import { UrlDataService } from '../page-assistant/services/url-data.service';
import { UploadStateService } from '../page-assistant/services/upload-state.service';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';

@Component({
  selector: 'ca-test',
  imports: [TranslateModule, HorizontalRadioButtonsComponent, TableModule, Button],
  templateUrl: './test.component.html',
  styles: ``
})
export class TestComponent implements OnInit { //remove implements OnInit if not using
  //Initialize stuff here

  //This runs first, use it to inject services & other dependencies (delete if not needed)
  constructor(private urlDataService: UrlDataService, private uploadState: UploadStateService, private router: Router, private translate: TranslateService) { } //Add any services you're using

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

  error: string = '';
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

    } catch (err: any) {
      this.error = `${tryError} ${err.message || err || unknownError}`;
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
}
