import { Injectable, signal, computed } from '@angular/core';
import { UrlPair, BreadcrumbNode, PageData, SearchMatches, BrokenLinks } from '../data/data.model';
import { TreeNode } from 'primeng/api';
import { environment } from '../../../../environments/environment';
import { FileUploadHandlerEvent } from 'primeng/fileupload';

export interface UrlData {
  rawUrls: string;
  includePrototypeLinks: boolean;
  urlTotal: number;
  urlChecked: number;
  urlPercent: number;
  isValidating: boolean;
  isValidated: boolean;
  isOk: boolean;
  urlPairs: UrlPair[];
}

export interface BreadcrumbData {
  breadcrumbs: BreadcrumbNode[][];
  rootPages: PageData[];
  progress: number;
  step: string;
  hasBreakBeforeRoot: boolean;
  hasBreakAfterRoot: boolean;
}

export interface SearchData {
  rawTerms: string;
  terms: (string | RegExp)[];
}

export interface IaData {
  iaTree: TreeNode[];
  brokenLinks: BrokenLinks[];
  searchMatches: SearchMatches[];
}

export interface IaState {
  version: number;
  activeStep: number;
  urlData: UrlData;
  breadcrumbData: BreadcrumbData;
  searchData: SearchData;
  iaData: IaData;
}

@Injectable({
  providedIn: 'root'
})
export class IaStateService {

  production = environment.production;

  //Active step
  public activeStep = signal(1);
  getActiveStep = computed(() => this.activeStep());
  setActiveStep(step: number) { this.activeStep.set(step); }

  // Step 1: Validate URLs
  private urlData = signal<UrlData>({
    rawUrls: '',
    includePrototypeLinks: false,
    urlTotal: 0,
    urlChecked: 0,
    urlPercent: 0,
    isValidating: false,
    isValidated: false,
    isOk: false,
    urlPairs: [],
  });
  getUrlData = computed(() => this.urlData());
  setUrlData(partial: Partial<UrlData>) {
    this.urlData.update(curr => ({ ...curr, ...partial }));
  }

  // Step 2: Breadcrumbs
  private breadcrumbData = signal<BreadcrumbData>({
    breadcrumbs: [],
    rootPages: [],
    progress: 0,
    step: '',
    hasBreakBeforeRoot: false,
    hasBreakAfterRoot: false,
  });
  getBreadcrumbData = computed(() => this.breadcrumbData());
  setBreadcrumbData(partial: Partial<BreadcrumbData>) {
    this.breadcrumbData.update(curr => ({ ...curr, ...partial }));
  }

  // Step 3: Search criteria
  private searchData = signal<SearchData>({
    rawTerms: '',
    terms: [],
  });
  getSearchData = computed(() => this.searchData());
  setSearchData(partial: Partial<SearchData>) {
    this.searchData.update(curr => ({ ...curr, ...partial }));
  }

  // Step 4: IA tree
  private iaData = signal<IaData>({
    iaTree: [],
    brokenLinks: [],
    searchMatches: [],
  });
  getIaData = computed(() => this.iaData());
  setIaData(partial: Partial<IaData>) {
    this.iaData.update(curr => ({ ...curr, ...partial }));
  }

  // Reset
  resetIaFlow(mode: "all" | "form" = "all") {

    const step = this.activeStep();

    if (step > 1) {
      this.activeStep.set(step - 1);
    }

    //reset URL data
    if (step === 1) {
      this.urlData.set({
        rawUrls: mode === "all" ? '' : this.urlData().rawUrls,
        includePrototypeLinks: false,
        urlTotal: 0,
        urlChecked: 0,
        urlPercent: 0,
        isValidating: false,
        isValidated: false,
        isOk: false,
        urlPairs: [],
      });
    }

    //reset breadcrumb data
    if (step <= 2) {
      this.breadcrumbData.set({
        breadcrumbs: [],
        rootPages: [],
        progress: 0,
        step: '',
        hasBreakBeforeRoot: false,
        hasBreakAfterRoot: false,
      });
    }

    //reset search data
    if (step <= 3) {
      this.searchData.set({
        rawTerms: '',
        terms: [],
      });
    }

    //reset ia tree data
    if (step <= 4) {
      this.iaData.set({
        iaTree: [],
        brokenLinks: [],
        searchMatches: [],
      });
    }
    this.saveToLocalStorage();
  }

  // Get IA state
  getIaState(): IaState {
    return {
      version: 0.1,
      activeStep: this.activeStep(),
      urlData: this.urlData(),
      breadcrumbData: this.breadcrumbData(),
      searchData: this.searchData(),
      iaData: this.iaData(),
    };
  }

  // Save IA state to local storage (browser memory)
  saveToLocalStorage() {
    const state = this.getIaState();
    localStorage.setItem('iaState', JSON.stringify(state));

    if (!this.production) {
      console.groupCollapsed('IA State saved to localStorage');
      console.log('Active step:', state.activeStep);
      console.log('--- URL Data ---');
      console.table({
        rawUrls: state.urlData.rawUrls,
        includePrototypeLinks: state.urlData.includePrototypeLinks,
        isValidating: state.urlData.isValidating,
        isValidated: state.urlData.isValidated,
        isOk: state.urlData.isOk,
      });
      console.log('URL Pairs:', state.urlData.urlPairs);

      console.log('--- Breadcrumb Data ---');
      console.table({
        breadcrumbProgress: state.breadcrumbData.progress,
        hasBreakBeforeRoot: state.breadcrumbData.hasBreakBeforeRoot,
        hasBreakAfterRoot: state.breadcrumbData.hasBreakAfterRoot,
      });
      console.log('Breadcrumbs:', state.breadcrumbData.breadcrumbs);
      console.log('Root Pages:', state.breadcrumbData.rootPages);

      console.log('--- Search Data ---');
      console.log('Terms:', state.searchData.terms);

      console.log('--- IA Data ---');
      console.log('IA Tree:', state.iaData.iaTree);
      console.log('Broken Links:', state.iaData.brokenLinks);
      console.log('Search Matches:', state.iaData.searchMatches);

      console.groupEnd();
    }
  }

  // Load from local storage (browser memory)
  loadFromLocalStorage() {
    const saved = localStorage.getItem('iaState');
    if (!saved) return;
    const state = JSON.parse(saved);
    this.activeStep.set(state.activeStep);
    this.urlData.set(state.urlData);
    this.breadcrumbData.set(state.breadcrumbData);
    this.searchData.set(state.searchData);
    this.iaData.set(state.iaData);
  }

  // Export as JSON (for sharing with someone else)
  exportIaState() {
    const data = JSON.stringify(this.getIaState(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'ia-state.json';
    a.click();

    URL.revokeObjectURL(url);
  }

  // Import JSON
  importIaState(event: FileUploadHandlerEvent) {
    const file: File = event.files?.[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const state: IaState = JSON.parse(reader.result as string);
        if (state.version !== 0.1) {
          console.warn("Incompatible IA state version. Import skipped.");
          return;
        }
        this.urlData.set(state.urlData);
        this.breadcrumbData.set(state.breadcrumbData);
        this.searchData.set(state.searchData);
        this.iaData.set(state.iaData);
        this.saveToLocalStorage();
        console.log('IA state successfully imported');
      } catch (error) {
        console.error('Invalid IA state file', error);
      }
    };
    reader.readAsText(file);
  }

  // Export TreeNode as CSV
  exportIaTreeAsCsv() {
    const iaTree: TreeNode[] = this.iaData().iaTree;
    const rows: string[] = [];

    // Custom headers (in your preferred order + descriptions)
    rows.push([
      'Page Title (h1)',
      'URL',
      'Prototype URL',
      'In scope',
      'Orphaned',
      'Parent URL',
      'Original Parent URL',
      'Status',
    ].join(','));

    const walk = (nodes: TreeNode[], parentUrl: string | null = null) => {
      for (const node of nodes) {
        const data = node.data;

        // Skip templates
        if (data.customStyleKey === 'template') {
          if (node.children?.length) {
            walk(node.children, data.url); // get children of template nodes
          }
          continue;
        }

        // Map style key
        let customStyle = '';
        switch (data.customStyleKey) {
          case 'new': customStyle = 'New page'; break;
          case 'rot': customStyle = 'Remove ROT'; break;
          case 'move': customStyle = 'Page move'; break;
          default: customStyle = '';
        }

        rows.push([
          `"${data.h1 || ''}"`,
          data.url || '',
          data.prototype || '',
          data.isUserAdded ? 'Yes' : 'No',
          data.notOrphan ? 'No' : 'Yes',
          parentUrl || '',
          data.originalParent || '',
          data.customStyleKey || '',
        ].join(','));

        if (node.children?.length) {
          walk(node.children, data.url);
        }
      }
    };

    walk(iaTree);

    // Build CSV file
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'ia-tree.csv';
    a.click();

    URL.revokeObjectURL(url);
  }
}

