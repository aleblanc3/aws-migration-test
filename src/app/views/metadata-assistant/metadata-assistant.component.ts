import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'ca-metadata-assistant',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,
    ButtonModule,
    CardModule
  ],
  templateUrl: './metadata-assistant.component.html',
  styleUrls: ['./metadata-assistant.component.css']
})
export class MetadataAssistantComponent {
  
  constructor(
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    // Component initialization
  }
}