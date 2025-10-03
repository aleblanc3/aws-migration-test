import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { StepperModule } from 'primeng/stepper';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { PopoverModule } from 'primeng/popover';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ChipModule } from 'primeng/chip';
import { TableModule } from 'primeng/table';
import { BadgeModule } from 'primeng/badge';
import { ToolbarModule } from 'primeng/toolbar';
import { FileUploadModule } from 'primeng/fileupload';
import { DropdownModule } from 'primeng/dropdown';

import { IaStateService } from './services/ia-state.service';
import { ValidateUrlsComponent } from "./components/validate-urls.component";
import { SetRootsComponent } from "./components/set-roots.component";
import { SearchCriteriaComponent } from './components/search-criteria.component';
import { IaTreeComponent } from './components/ia-tree.component';
import { ExportGitHubService } from './services/export-github.service';
import { FetchService } from '../../services/fetch.service';

import { TreeNode } from 'primeng/api';

export interface PageData {
  url: string;
  content: string;
}

@Component({
  selector: 'ca-ia-assistant',
  imports: [CommonModule, FormsModule, TranslateModule,
    TextareaModule, InputTextModule, IftaLabelModule, InputGroupModule, InputGroupAddonModule, ButtonModule, FileUploadModule,
    ProgressBarModule, ChipModule, StepperModule, ConfirmPopupModule, TableModule, BadgeModule, TooltipModule, ToolbarModule, PopoverModule, DropdownModule,
    SearchCriteriaComponent, IaTreeComponent, ValidateUrlsComponent, SetRootsComponent],
  templateUrl: './ia-assistant.component.html',
  styles: `
  ::ng-deep .upload-secondary-outline .p-button {
  border: 1px solid var(--p-zinc-200) !important;
  background-color: transparent !important;
 color: var(--p-button-secondary-color);
  }
  ::ng-deep .upload-secondary-outline .p-button:hover {
  background-color: var(--p-button-outlined-secondary-hover-background);
  color: var(--p-button-secondary-hover-color);
}
  
  ::ng-deep .upload-secondary-outline .p-button-label {
    display: none;
  }
 `
})
export class IaAssistantComponent {
  public iaState = inject(IaStateService);
  public exportGitHubService = inject(ExportGitHubService);
  private fetchService = inject(FetchService);

  isDev = false;
  async ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    this.isDev = params.get('dev') === 'true';
    await this.updateRepoList();
    console.log(this.repos);
  }

  repos: { label: string, value: string }[] = [];
  async updateRepoList() {
    await this.exportGitHubService.getRepoList(this.owner).then(repos => {
      this.repos = repos.map(r => ({
        label: r.name,
        value: r.name
      }));
    });
  }
  owner = 'cra-design';
  repo = '';
  branch = 'main';
  userToken = '';

  //Get in-scope URLs and page content
  private async getUrlandContent(node: TreeNode): Promise<PageData[]> {
    const pages: PageData[] = [];
    if (node.data.isUserAdded && node.data.url) {
      try {
        const doc = await this.fetchService.fetchContent(node.data.url, "prod");
        const jekyllFormatted = await this.exportGitHubService.formatDocumentAsJekyll(doc, node.data.url);
        pages.push({ url: node.data.url, content: jekyllFormatted });
      } catch (error) {
        console.error(`Error fetching content for ${node.data.url}:`, error);
      }
    }
    // recurse into children
    if (node.children) {
      for (const child of node.children) {
        const childPages = await this.getUrlandContent(child);
        pages.push(...childPages);
      }
    }
    return pages;
  }

  async exportProjectToGitHub(owner: string, repo: string, branch: string, token: string, overwrite = false) {

    // Step 1: Gather all in-scope URLs and their content
    const nodes = this.iaState.getIaData().iaTree;
    const pages: PageData[] = await this.getUrlandContent(nodes[0]);
    console.log('Exporting pages to GitHub:', pages);

    // Step 2: Find common path prefix
    function getCommonPrefix(urls: string[]): string {
      const paths = urls.map(url => new URL(url).pathname.split("/").filter(Boolean));
      const first = paths[0];
      const prefix: string[] = [];

      for (let i = 0; i < first.length; i++) {
        const segment = first[i];
        if (paths.every(p => p[i] === segment)) {
          prefix.push(segment);
        } else {
          break;
        }
      }
      return "/" + prefix.join("/");
    }

    const urls = pages.map(page => page.url);
    const commonRoot = getCommonPrefix(urls);
    console.log("Detected common root:", commonRoot);

    // Step 3: Trim common root from urls for GitHub paths
    const exportPages = pages.map(p => {
      let path = new URL(p.url).pathname;
      if (path.startsWith(commonRoot)) {
        path = path.slice(commonRoot.length);
      }
      path = path.replace(/^\/+/, ""); // strip leading slashes
      const lastSegment = path.split("/").pop() || "index.html";
      return { url: p.url, path, content: p.content, filename: lastSegment };
    });

    console.log("Exporting pages to GitHub:", exportPages);

    // Step 4: Set up repo (create it if it doesn't exist, add _config.yml and copy over core files)
    await this.exportGitHubService.setupRepo(owner, repo, branch, token);

    // Step 5: Export each page to GitHub
    const redirects: { origin: string; destination: string }[] = [];
    for (const page of exportPages) {
      try {
        const result = await this.exportGitHubService.exportToGitHub(owner, repo, branch, page.path, page.filename, page.content, token, overwrite);
        console.log(`Successfully exported ${page.path}:`, result);
        redirects.push({ origin: page.url, destination: page.path });
      } catch (error) {
        console.error(`Error exporting ${page.path}:`, error);
      }
    }
    // Step 5: Add redirect file
    const redirectsJson = JSON.stringify(redirects, null, 2);
    await this.exportGitHubService.exportToGitHub(owner, repo, branch, "source/data/exclude-redirect-links.json", "exclude-redirect-links.json", redirectsJson, token, overwrite);
  }
}

