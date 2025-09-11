import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabel } from 'primeng/iftalabel';

import { TranslateService, TranslateModule } from '@ngx-translate/core';

import { MetadataData } from '../../data/data.model';
import { UploadStateService } from '../../services/upload-state.service';

@Component({
  selector: 'ca-seo',
  imports: [CommonModule, FormsModule,
    TranslateModule,
    ButtonModule, TextareaModule, IftaLabel],
  templateUrl: './seo.component.html',
  styles: ``
})
export class SeoComponent implements OnInit {
  private uploadState = inject(UploadStateService);
  private translate = inject(TranslateService);

  ngOnInit() {
    const data = this.uploadState.getUploadData();
    this.metadata = data?.metadata || [];
    this.metadataMap = this.metadata.reduce((map, m) => {
      if (m.name) map[m.name] = m.content || '';
      return map;
    }, {} as Record<string, string>);

    this.originalUrl = data?.originalUrl || "";

  }

  isLoading = false;

  //Initialize metadata & breadcrumb arrays (note: this data is part of UploadData)
  metadata: MetadataData[] = [];
  metadataMap: Record<string, string> = {};
  originalUrl = "";

  //UPD data (placeholders for future function)
  canadaSearchTerms = "";
  googleSearchTerms = "";
  userFeedback = "";
  uxFindings = "";

  print(text: string) {
    console.log(text);
  }
}
