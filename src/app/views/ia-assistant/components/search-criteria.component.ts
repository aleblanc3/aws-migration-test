import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';
import { ChipModule } from 'primeng/chip';
import { BadgeModule } from 'primeng/badge';
import { IaStateService } from '../services/ia-state.service';

@Component({
  selector: 'ca-search-criteria',
  imports: [CommonModule, FormsModule, TranslateModule,
    TextareaModule, IftaLabelModule, ChipModule, BadgeModule],
  templateUrl: './search-criteria.component.html',
  styles: ``
})
export class SearchCriteriaComponent implements OnInit {
  public iaState = inject(IaStateService);

  ngOnInit(): void {
    this.iaState.updateTerms();
  }

  searchData = this.iaState.getSearchData;

  updateRawTerms() {
    this.searchData().rawTerms = this.searchData().terms.map(term => {
      if (term instanceof RegExp) {
        return `regex:${term.source}`;
      } else {
        return term;
      }
    })
      .join('; ');
  }

  onKeydownTerm(event: KeyboardEvent) {
    if (event.key === ';' || event.key === 'Enter' || event.key === 'Tab') {
      this.iaState.updateTerms();
    }
  }

  onPasteTerm() {
    setTimeout(() => this.iaState.updateTerms(), 0);
  }

  removeTerm(term: string | RegExp) {
    this.searchData().terms = this.searchData().terms.filter(t => t !== term);
    console.log(this.searchData().terms);
    this.updateRawTerms()
  }

  isRegex(term: string | RegExp): boolean {
    return term instanceof RegExp;
  }

  getTermColor(term: string | RegExp): string {
    if (this.isRegex(term)) return 'bg-blue-100';
    else if (typeof term === 'string' && term.startsWith('invalid regex')) return 'bg-red-100';
    else return 'bg-green-100';
  }

}
