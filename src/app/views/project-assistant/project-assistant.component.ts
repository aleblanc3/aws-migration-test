import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ca-project-assistant',
  standalone: true,
  imports: [TranslateModule, CommonModule],
  templateUrl: './project-assistant.component.html',
  styleUrl: './project-assistant.component.css'
})
export class ProjectAssistantComponent {

}
