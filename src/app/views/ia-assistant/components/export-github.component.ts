import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

//PrimeNG Modules
import { TableModule } from 'primeng/table';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { FilterService, SelectItemGroup, TreeNode } from 'primeng/api';
import { KeyFilterModule } from 'primeng/keyfilter';
import { MessageModule } from 'primeng/message';
import { FieldsetModule } from 'primeng/fieldset';

import { ExportGitHubService } from '../services/export-github.service';
import { IaStateService } from '../services/ia-state.service';
import { FetchService } from '../../../services/fetch.service';

export interface PageData {
  url: string;
  content: string;
}

@Component({
  selector: 'ca-export-github',
  imports: [CommonModule, FormsModule, TranslateModule,
    TableModule, IftaLabelModule, InputTextModule, KeyFilterModule, AutoCompleteModule, PasswordModule, ButtonModule, MessageModule, FieldsetModule],
  templateUrl: './export-github.component.html',
  styles: ``
})
export class ExportGithubComponent implements OnInit {
  private iaState = inject(IaStateService);
  private exportGitHubService = inject(ExportGitHubService);
  private fetchService = inject(FetchService);
  public translate = inject(TranslateService);

  iaData = this.iaState.getIaData;
  gitHubData = this.iaState.getGitHubData;
  repos: string[] = [];
  filteredRepos: string[] = [];
  ownerError = '';
  showHelp = false;
  userToken = '';

  async ngOnInit() {
    this.iaState.loadFromLocalStorage();
    await this.updateRepoList();
  }

  async updateRepoList() {
    this.ownerError = '';
    this.repos = [];

    try {
      const repos = await this.exportGitHubService.getRepoList(this.gitHubData().owner);
      this.repos = repos.map(r => (r.name));
    }
    catch (error) {
      if ((error as Error).message?.includes('404')) {
        this.ownerError = `GitHub owner "${this.gitHubData().owner}" not found.`;
      } else {
        this.ownerError = `Failed to load repositories for "${this.gitHubData().owner}".`;
      }
    }
  }

  filterRepos(event: AutoCompleteCompleteEvent) {
    const query = event.query?.trim().toLowerCase() || '';
    const startsWith = this.repos.filter(r => r.toLowerCase().startsWith(query));
    const includes = this.repos.filter(r => r.toLowerCase().includes(query) && !r.toLowerCase().startsWith(query));
    this.filteredRepos = Array.from(new Set([...startsWith, ...includes]));
  }

  ownerFilter: RegExp = /^[a-zA-Z0-9-]*$/;
  repoFilter: RegExp = /^[a-zA-Z0-9-._]*$/;
  branchFilter: RegExp = /^[a-zA-Z0-9./-]*$/;

  updateOwner() {
    this.gitHubData().owner = this.gitHubData().owner.trim().toLowerCase().replace(/^[-]+|[-]+$/g, '').replace(/[-]{2,}/g, '-');
    if (!this.gitHubData().owner) { this.gitHubData().owner = 'cra-design'; }
  }

  updateRepo() {
    this.gitHubData().repo = this.gitHubData().repo.trim().replace(/^[.-]+|[.-]+$/g, '').replace(/(\/|.)lock$/, '').replace(/[.]{2,}/g, '.').replace(/[-]{2,}/g, '-');
  }

  updateBranch() {
    this.gitHubData().branch = this.gitHubData().branch.trim().replace(/^[./]+|[./]+$/g, '').replace(/(\/|.)lock$/, '').replace(/[.]{2,}/g, '.').replace(/\/{2,}/g, '/');
    if (!this.gitHubData().branch) { this.gitHubData().branch = 'main'; }
  }

  //Get in-scope URLs and page content
  private async getUrlandContent(node: TreeNode): Promise<PageData[]> {
    const pages: PageData[] = [];
    if (node.data.isUserAdded && node.data.url) {
      try {
        const doc = await this.fetchService.fetchContent(node.data.url, "prod");
        const jekyllFormatted = await this.exportGitHubService.formatDocumentAsJekyll(doc, node.data.url, this.gitHubData().owner, this.gitHubData().repo);
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

    //Step 0: Save current GitHub data to state
    this.iaState.setGitHubData({ owner, repo, branch });
    this.iaState.saveToLocalStorage();

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
      if (prefix.length) {
        const last = prefix[prefix.length - 1];
        if (/\.[a-z0-9]+$/i.test(last)) { // ends with file extension
          prefix.pop();
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
      //console.log(`Mapping URL ${p.url} to path ${path}, filename ${lastSegment}`);
      return { url: p.url, path, content: p.content, filename: lastSegment };
    });

    console.log("Exporting pages to GitHub:", exportPages);

    // Step 4: Check existing files in repo
    const existingFiles = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);
    //console.warn("Existing files in repo:", existingFiles);

    // Step 5: Set up repo (create it if it doesn't exist, add _config.yml and copy over core files)
    await this.exportGitHubService.setupRepo(owner, repo, branch, token, existingFiles);

    console.log("Repository setup complete.");


    // Step 6: Export each page to GitHub
    const redirects: { origin: string; destination: string }[] = [];
    for (const page of exportPages) {
      try {
        const result = await this.exportGitHubService.exportToGitHub(owner, repo, branch, page.path, page.filename, page.content, token, existingFiles, overwrite);
        //console.log(`Successfully exported ${page.path}:`, result);
        redirects.push({ origin: page.url, destination: `/${repo}/${page.path}` });
      } catch (error) {
        console.error(`Error exporting ${page.path}:`, error);
      }
    }
    // Step 5: Add redirect file
    const redirectsJson = JSON.stringify(redirects, null, 2);
    await this.exportGitHubService.exportToGitHub(owner, repo, branch, "source/data/exclude-redirect-links.json", "exclude-redirect-links.json", redirectsJson, token, existingFiles, overwrite);

    console.log("Page export complete.");
  }
}
