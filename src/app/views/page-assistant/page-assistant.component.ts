import { Component, signal} from '@angular/core';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { LocalStorageService } from '../../services/local-storage.service'; //Delete if you aren't using anything from local storage
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

//primeNG
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { StepperModule } from 'primeng/stepper';
import { PanelModule } from 'primeng/panel';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';

//Components
import { UploadUrlComponent } from './components/upload/upload-url.component';
import { UploadPasteComponent } from './components/upload/upload-paste.component';
import { UploadWordComponent } from './components/upload/upload-word.component';
import { PageCompareComponent } from './components/page-compare.component';

@Component({
  selector: 'ca-page-assistant',
  imports: [TranslateModule, CommonModule, FormsModule, RadioButtonModule, CheckboxModule, ButtonModule, StepperModule, UploadUrlComponent, UploadPasteComponent, UploadWordComponent, PageCompareComponent, PanelModule, MessageModule, CardModule],
  templateUrl: './page-assistant.component.html',
  styles: ``
})
export class PageAssistantComponent {



  selectedUploadType: string = 'url';  // Default to first radio button
  activeStep = 1;

  //Test
  activeStepIndex = 0;           // current step index: 0 (Upload) or 1 (View)
  preloadedUrl?: string;         // if coming from direct URL
  finalUrl?: string;             // URL to pass to View step
  //End test

  

 // cancelUpload() {
  //  this.selectedUploadType = null;
 // }

  sourceURL: any;

  constructor(public localStore: LocalStorageService, private translate: TranslateService, private route: ActivatedRoute) { } 

  /*Test continued
 ngOnInit() {
    // Check if arriving via /stepper/view?url=...
    this.route.queryParamMap.subscribe(params => {
      const directUrl = params.get('url');
      if (directUrl) {
        this.preloadedUrl = directUrl;
        this.finalUrl = directUrl;
        this.activeStepIndex = 1; // jump directly to View step
      }
    });
  }

  onUploadCompleted(uploadedUrl: string) {
    this.finalUrl = uploadedUrl;
    this.activeStepIndex = 1; // advance to View step
  }



  //End test*/
  
  //Step 1 radio buttons to select task
  selectedTask: any = null;

  tasks: any[] = [
    { name: 'my content with an AI optimized version', key: 'taskContentAndAI', unavailable: 'false' },
    { name: 'two webpages', key: 'task2Contents', unavailable: 'false' },
    { name: 'two AI models', key: 'task2Models', unavailable: 'false' },
    { name: 'two AI prompts', key: 'task2Prompts', unavailable: 'true' }
  ];

  //Step 2 radio buttons to select upload type
  selectedUpload: any = null;

  uploads: any[] = [
    { name: 'URL', key: 'url', unavailable: 'false' },
    { name: 'Copy & paste', key: 'paste', unavailable: 'false' },
    { name: 'Word doc (converts to HTML)', key: 'word', unavailable: 'true' }
  ];
  //Step 2 get upload data from child component
  public receivedUploadData: {
    sourceURL: string;
    sourceHTML: string;
    prototypeURL?: string;
    prototypeHTML?: string;
  } | null = null;

  public handleUpload(uploadData: { sourceURL: string, sourceHTML: string, prototypeURL?: any, prototypeHTML?: any } | null = null) {
    this.receivedUploadData = uploadData;
    this.activeStep = 2;  // move to step 2
  }

 
}