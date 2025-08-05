import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'ca-project-assistant',
  standalone: true,
  imports: [TranslateModule, CommonModule, RouterModule, CardModule, ButtonModule],
  templateUrl: './project-assistant.component.html',
  styleUrl: './project-assistant.component.css'
})
export class ProjectAssistantComponent {

}
