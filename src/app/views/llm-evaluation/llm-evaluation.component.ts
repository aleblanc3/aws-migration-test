import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'ca-llm-evaluation',
  imports: [CommonModule, TranslateModule],
  template: `
    <h1 id="wb-cont">{{ 'title.llmEvaluation' | translate }}</h1>
    <p>{{ 'llmEvaluation.content' | translate }}</p>
  `,
  styles: ``
})
export class LlmEvaluationComponent {
}
