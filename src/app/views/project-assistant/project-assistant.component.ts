import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from "@ngx-translate/core";
import { Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { FieldsetModule } from 'primeng/fieldset';
import { SplitButtonModule } from 'primeng/splitbutton';
import { MenuItem } from 'primeng/api';

import { IaStateService, SavedProject } from '../ia-assistant/services/ia-state.service';
import { ExportGithubComponent } from '../ia-assistant/components/export-github.component';

@Component({
  selector: 'ca-project-assistant',
  standalone: true,
  imports: [CommonModule, TranslateModule,
    CardModule, ButtonModule, DialogModule, InputTextModule, FieldsetModule, SplitButtonModule,
    ExportGithubComponent],
  templateUrl: './project-assistant.component.html',
  styleUrl: './project-assistant.component.css'
})
export class ProjectAssistantComponent {
  public iaState = inject(IaStateService);
  public router = inject(Router);
  exportItems: MenuItem[] = [];

  constructor() {
    this.loadProjects();
    this.exportItems = [
      {
        label: 'Export CSV (content inventory)',
        icon: 'pi pi-list-check',
        command: () => {

        },
        disabled: true,
      },
      {
        label: 'Export CSV (tree testing)',
        icon: 'pi pi-align-right',
        command: () => {

        },
        disabled: true,
      },
      {
        separator: true,
      },
      {
        label: 'Export JSON file',
        icon: 'pi pi-code',
        command: () => {

        },
        disabled: true,
      },
    ];
  }

  //Load all projects
  allProjects = signal<SavedProject[]>([]);
  loadProjects() {
    const projects = JSON.parse(localStorage.getItem('savedProjects') || '[]');
    this.allProjects.set(projects);
  }

  //Track active project
  activeProject = computed(() => {
    const projects = this.allProjects();
    return projects.length ? projects[0] : null;
  });

  //Other saved projects
  savedProjects = computed(() => {
    const active = this.activeProject();
    return this.allProjects().filter(p => p.key !== active?.key);
  });

  //Display formats
  get projects() {
    return this.savedProjects() || [];
  }

  getDisplayName(project: SavedProject): string {
    return project.key
      .replace(/-/g, " ")
      .replace(/^\w/, char => char.toUpperCase());
  }

  formatDate(dateString: number): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(',', ' at');
  }

  //Actions - load saved project, start new project, save autosave as project, delete a project

  loadingKey: string | null = null;
  async loadProject(key: string) {
    // Show loading state on card
    this.loadingKey = key;
    await new Promise(resolve => setTimeout(resolve, 600));
    //Saves current active project and loads clicked project
    try {
      this.iaState.saveToLocalStorage();
      this.iaState.loadFromLocalStorage(key);
      this.iaState.updateProjectList(key);
      this.loadProjects();
    }
    finally {
      this.loadingKey = null; //end of loading state
    }
  }

  newProject() {
    this.iaState.saveToLocalStorage();
    this.iaState.setActiveStep(1);
    this.iaState.resetIaFlow();
    this.iaState.saveToLocalStorage();
    this.loadProjects(); // refresh reactive state
  }

  showSave: boolean = false;
  saveProject() {
    console.log(this.iaState.getGitHubData().repo)
    let savedAutoSave = false;
    if (this.activeProject()?.key === "autosave" && this.iaState.getGitHubData().repo != "autosave") { savedAutoSave = true }
    this.iaState.saveToLocalStorage();
    this.loadProjects(); // refresh reactive state
    if (savedAutoSave) { this.deleteProject("autosave") } //remove autosave after saving it as a project

  }

  deleteProject(key: string, event?: Event) {
    event?.stopPropagation();
    const all = this.allProjects();
    const isActive = key === this.activeProject()?.key;
    // Remove key from localStorage
    localStorage.removeItem(key);
    // Remove from savedProjects key
    const updatedProjects = all.filter(p => p.key !== key);
    localStorage.setItem('savedProjects', JSON.stringify(updatedProjects));
    this.allProjects.set(updatedProjects);
    // Start new project if active project is deleted
    if (isActive) {
      console.warn("Deleted the active project");
      this.newProject();
    }
  }

}
