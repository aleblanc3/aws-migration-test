import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TranslateModule } from "@ngx-translate/core";

import { Router } from '@angular/router';

//primeNG
import { RadioButtonModule } from 'primeng/radiobutton';

//Components
import { UploadUrlComponent } from './upload/upload-url.component';
import { UploadPasteComponent } from './upload/upload-paste.component';
import { UploadWordComponent } from './upload/upload-word.component';

//Services
import { UploadStateService } from '../services/upload-state.service';

@Component({
  selector: 'ca-page-upload',
  imports: [CommonModule, FormsModule,
    TranslateModule,
    RadioButtonModule,
    UploadUrlComponent, UploadPasteComponent, UploadWordComponent
  ],
  templateUrl: './upload.component.html',
  styles: ``
})
export class PageUploadComponent implements OnInit {

  constructor(private uploadState: UploadStateService, private router: Router) { }

  ngOnInit(): void {
    const data = this.uploadState.getUploadData();
    if (data) {
      this.goToCompare();
    }
  }

  selectedUploadType: string = 'url';  // Default to url radio button
  onUploadTypeChange(value: 'url' | 'paste' | 'word') { // Set variable in service
    this.selectedUploadType = value;
    this.uploadState.setUploadType(value);
  }

  goToCompare() {
    this.router.navigate(['page-assistant/compare']);
  }
}
