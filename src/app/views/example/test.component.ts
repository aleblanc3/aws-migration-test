import { Component, OnInit } from '@angular/core'; //remove OnInit if not using
import { TranslateModule } from "@ngx-translate/core";

//Shared components
import { HorizontalRadioButtonsComponent } from '../../components/horizontal-radio-buttons/horizontal-radio-buttons.component';
import { ViewOption, WebViewType } from '../../common/data.types';

@Component({
  selector: 'ca-test',
  imports: [TranslateModule, HorizontalRadioButtonsComponent],
  templateUrl: './test.component.html',
  styles: ``
})
export class TestComponent implements OnInit { //remove implements OnInit if not using
  //Initialize stuff here

  //This runs first, use it to inject services & other dependencies (delete if not needed)
  constructor() { } //Add any services you're using

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
    console.warn(`Option changed to: `,viewType);
  }

}
