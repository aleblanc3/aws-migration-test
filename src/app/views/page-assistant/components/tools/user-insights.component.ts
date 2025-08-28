import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TranslateService, TranslateModule } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabel } from 'primeng/iftalabel';

@Component({
  selector: 'ca-user-insights',
  imports: [CommonModule, FormsModule,
    TranslateModule,
    ButtonModule, TextareaModule, IftaLabel],
  templateUrl: './user-insights.component.html',
  styles: ``
})
export class UserInsightsComponent {

  constructor(private translate: TranslateService) { }

  isLoading: boolean = false;

  //UPD data (placeholders for future function)
  task: string = ""
  userFeedback: string = "";
  uxFindings: string = "";

  print(text: string) {
    console.log(text);
  }
}
