import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';

import { TranslateModule, TranslateService } from "@ngx-translate/core";

import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { UrlDataService } from '../services/url-data.service';
import { UploadStateService } from '../services/upload-state.service';
import { htmlProcessingResult } from '../data/data.model';

@Component({
  selector: 'ca-share',
  imports: [CommonModule, ProgressSpinnerModule],
  template: `   
      <p *ngIf="!loading">Sample share link: <br><a href="share?url=https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html&compareUrl=https://cra-design.github.io/gst-hst-business/en/topics/gst-hst-businesses.html">
      share?url=https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html&compareUrl=https://cra-design.github.io/gst-hst-business/en/topics/gst-hst-businesses.html</a>
    <div class="flex justify-content-center" *ngIf="loading"><p-progress-spinner ariaLabel="loading" /></div>
  `,
  styles: ``
})
export class ShareComponent implements OnInit {

  constructor(private route: ActivatedRoute, private urlDataService: UrlDataService, private uploadState: UploadStateService, private router: Router, private translate: TranslateService) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const url = params['url'];
      const compareUrl = params['compareUrl'];
      if (url) {
        this.fetchAndGoToCompare(url, compareUrl);
      }
    });
  }

  error: string = '';
  loading = false;

  async fetchAndGoToCompare(url: string, compareUrl?: string): Promise<void> {

    const unknownError = this.translate.instant('page.upload.error.unknown');
    const tryError = this.translate.instant('page.upload.url.error.try');
    this.loading = true;
    this.error = '';

    try {
      const originalData = await this.urlDataService.fetchAndProcess(url);
      let compareData: htmlProcessingResult | undefined;
      if (compareUrl) {
        compareData = await this.urlDataService.fetchAndProcess(compareUrl);
      }

      this.uploadState.setUploadData({
        originalUrl: url,
        originalHtml: originalData.html,
        modifiedUrl: compareUrl ?? url,
        modifiedHtml: compareData?.html ?? originalData.html,
        found: {
          original: originalData.found,
          modified: compareData?.found ?? originalData.found
        }
      });

      this.router.navigate(['page-assistant/compare']);

    } catch (err: any) {
      this.error = `${tryError} ${err.message || err || unknownError}`;
    } finally {
      this.loading = false;
    }
  }
}