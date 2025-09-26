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
    this.updateTerms();
  }

  searchData = this.iaState.getSearchData;

  updateTerms() {
    this.searchData().terms = this.searchData().rawTerms
      .split(/[\n;\t]+/) // split on semicolons, newlines, tabs
      .map(term => term.trim()) // trim whitespace
      .filter(Boolean) // filter out empties
      .map(term => {
        try {
          if (term.startsWith('regex:')) {
            const pattern = term.slice(6);
            return new RegExp(pattern, 'smi');
          }
          else return term.toLowerCase();
        }
        catch (error) { console.log(error); return `invalid ${term}`; }
      });

    this.searchData().terms = Array.from(new Set(this.searchData().terms)); // unique set
  }

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
      this.updateTerms();
    }
  }

  onPasteTerm() {
    setTimeout(() => this.updateTerms(), 0);
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
