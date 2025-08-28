import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabel } from 'primeng/iftalabel';
import { FieldsetModule } from 'primeng/fieldset';
import { PanelModule } from 'primeng/panel';
import { AccordionModule } from 'primeng/accordion';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputNumberModule } from 'primeng/inputnumber';
import { TooltipModule } from 'primeng/tooltip';
import { TreeTableModule } from 'primeng/treetable';

//Services
import { UrlDataService } from '../services/url-data.service';
import { UploadStateService } from '../services/upload-state.service';
import { ValidatorService } from '../services/validator.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MenuItem, TreeNode } from 'primeng/api';
import { MetadataData } from '../data/data.model';
import { TemplateConversionComponent } from "./tools/template-conversion.component";
import { LinkReportComponent } from "./tools/link-report.component";
import { SeoComponent } from "./tools/seo.component";
import { UserInsightsComponent } from "./tools/user-insights.component";
import { ComponentGuidanceComponent } from "./tools/component-guidance.component";
import { HeadingStructureComponent } from "./tools/heading-structure.component";

@Component({
  selector: 'ca-page-tools',
  imports: [CommonModule, FormsModule,
    TranslateModule,
    TableModule, ButtonModule, IftaLabel, TextareaModule, FieldsetModule, PanelModule, AccordionModule, BreadcrumbModule, OrganizationChartModule, ProgressBarModule, InputNumberModule, TooltipModule, TreeTableModule,
    TemplateConversionComponent, LinkReportComponent, SeoComponent, UserInsightsComponent, ComponentGuidanceComponent, HeadingStructureComponent],
  templateUrl: './tools.component.html',
  styles: `
    :host {
      display: block;
    }
    .ia-label {
      white-space: pre-line; 
      display: inline-block; 
    }
  `
})
export class PageToolsComponent implements OnInit {

  constructor(private urlDataService: UrlDataService, private uploadState: UploadStateService, private translate: TranslateService, private validator: ValidatorService, private http: HttpClient) { }

  ngOnInit() {
    const data = this.uploadState.getUploadData();
    this.breadcrumb = data?.breadcrumb || [];
    this.originalUrl = data?.originalUrl || "";

  }

  //Initialize metadata & breadcrumb arrays (note: this data is part of UploadData)
  originalUrl: string = "";


  /********************************
   * Start of breadcrumb analysis *
   *******************************/

  //Breadcrumb & orphan status
  breadcrumb: MenuItem[] = [];
  urlFound: boolean | null = null;

  //IA chart
  iaChart: TreeNode[] | null = null;
  brokenLinks: { parentUrl?: string, url: string, status: number }[] = []
  depth: number = 4 //default value

  //For tracking progress while building IA chart
  isChartLoading: boolean = false;
  iaProgress: number = 0;
  totalUrls: number = 0;
  processedUrls: number = 0;

  //Pages to skip children when building IA chart
  private readonly skipFormsAndPubs = new Set<string>([
    'https://www.canada.ca/en/revenue-agency/services/forms-publications/forms.html',
    'https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/formulaires.html',
    'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications.html',
    'https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications.html'
  ]);

  //Button fxn
  async checkIA() {

    //IA orphan status
    this.urlFound = await this.checkParentLinks(this.breadcrumb, this.originalUrl);

    //IA tree
    this.iaChart = await this.buildIaTree([this.originalUrl], this.depth); // depth defaults to 4 but user can select 2 to 6

    //Set focus to first element in chart
    setTimeout(() => {
      const firstNode = document.querySelector(".p-organizationchart-node a");
      if (firstNode) (firstNode as HTMLElement).focus();
    });

  }

  //Step 1: Check if breadcrumb orphan via parent page
  async checkParentLinks(breadcrumbs: MenuItem[], originalUrl: string): Promise<boolean> {
    if (!breadcrumbs?.length) return false;

    const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1]; //get breadcrumb parent
    const targetUrl = lastBreadcrumb.url;
    if (!targetUrl) {
      console.error('Last breadcrumb has no URL');
      return false;
    }

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        console.error(`Failed to fetch breadcrumb page: ${response.status}`);
        return false;
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const links = Array.from(doc.querySelectorAll('a')) //get all links on parent page
        .map(a => a.getAttribute('href'))
        .filter((href): href is string => !!href);

      // Make links absolute
      const absoluteLinks = links.map(href => {
        try {
          return new URL(href, targetUrl).href;
        } catch {
          return href; // fallback
        }
      });

      const found = absoluteLinks.includes(originalUrl);
      console.log(`Original URL ${found ? 'found' : 'NOT found'} in ${targetUrl}`);
      return found;

    } catch (err) {
      console.error('Error checking breadcrumb target:', err);
      return false;
    }
  }



  //Step 2a: Get single page IA data
  async getPageMetaAndLinks(url: string): Promise<{ h1?: string; breadcrumb?: string[]; links?: string[], status: number } | null> {
    try {
      //Get HTML content
      const res = await fetch(url);
      const status = res.status;
      if (!res.ok) return { status };
      const html = await res.text();

      //Parse HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      //Get H1 (or double H1)
      const h1Elements = Array.from(doc.querySelectorAll('h1'));
      const h1: string = h1Elements.map(e => e.textContent?.trim()).filter(Boolean).join('<br>');

      //Get breadcrumb
      const breadcrumb = Array.from(doc.querySelectorAll('.breadcrumb li a'))
        .map(a => new URL((a as HTMLAnchorElement).getAttribute('href') || '', url).href);

      //Get unique links
      const anchors = Array.from(doc.querySelectorAll('main a[href]')) as HTMLAnchorElement[];
      const baseUrl = new URL(url).origin;
      const links = Array.from(
        new Set( //unique set
          anchors //from my array of anchors
            .map(a => {
              const u = new URL(a.getAttribute('href') || '', url); // map absolute link
              u.hash = ''; // without #id's
              return u.href;
            })
            .filter(u => u.startsWith(baseUrl) && u !== url) // on same domain but not self
        )
      );

      return { h1, breadcrumb, links, status };
    } catch (err) {
      console.error(`Failed to fetch ${url}`, err);
      return { status: 0 };
    }
  }
  //Step 2b: Crawl all child pages for IA data
  async buildIaTree(urls: string[], depth: number, parentUrl?: string, level: number = 0): Promise<TreeNode[]> {
    if (depth <= 0) return [];

    //reset progress tracker
    if (!parentUrl && level === 0) {
      this.isChartLoading = true;
      this.iaProgress = 5;
      this.processedUrls = 0;
      this.totalUrls = urls.length;
    }

    const nodes: TreeNode[] = [];

    //Set background color
    const bgColors = [
      "bg-purple-50",
      "bg-blue-50",
      "bg-green-50",
      "bg-yellow-50",
      "bg-orange-50",
      "bg-red-50"
    ];

    const bgClass = bgColors[level % bgColors.length];

    for (const url of urls) {
      const meta = await this.getPageMetaAndLinks(url);

      this.processedUrls++; //Increase processed URLs
      this.iaProgress = Math.round((this.processedUrls / this.totalUrls) * 100); //Update progress

      if (!meta || meta.status !== 200) {
        this.brokenLinks.push({
          parentUrl,
          url,
          status: meta?.status || 0
        });
        continue;
      }
      if (!meta.breadcrumb || !meta.links) continue;

      // Check if child via breadcrumb parent
      if (parentUrl && meta.breadcrumb.at(-1) !== parentUrl) {
        continue;
      }

      const node: TreeNode = {
        label: meta.h1,
        data: {
          h1: meta.h1,
          url: url
        },
        expanded: true,
        styleClass: `border-2 border-primary border-round ${bgClass} shadow-2`,
        children: []
      };

      // Recurse into children
      if (meta.links?.length && depth > 1) {
        this.totalUrls += meta.links.length; // Increase total URLs by # of child links for progress tracker

        const total = meta.links.length; //total links (used for limiting displayed child pages)

        let limit = total; // default: no limit        
        if (this.skipFormsAndPubs.has(url)) { limit = 5; } // limit forms & pubs pages

        const links = meta.links.slice(0, limit); //trim excess links

        node.children = await this.buildIaTree(links, depth - 1, url, level + 1); //get child nodes

        if (total > limit) { //add dummy node if we limited the child nodes
          node.children?.push({
            label: `+ ${total - limit} more...`,
            data: null,
            styleClass: `border-2 border-primary border-round surface-100 shadow-2`,
            children: []
          });
        }
      }

      nodes.push(node);
    }

    // Finalize progress tracker
    if (!parentUrl && level === 0) {
      this.iaProgress = 100;
      setTimeout(() => {
        this.isChartLoading = false;
        this.iaProgress = 0;
      }, 1000);
    }

    return nodes;
  }

  //Prevent default click on org chart links <-- Do we want this?? 
  onNodeClick(event: MouseEvent) {
    if (event.button === 0) {
      event.preventDefault();
    }
  }

  //Full screen element
  @ViewChild('chartContainer') chartContainer!: ElementRef;
  maximize(elRef: ElementRef) {
    const element = elRef.nativeElement as HTMLElement;
    if (element.requestFullscreen) { element.requestFullscreen(); }
    else if ((element as any).webkitRequestFullscreen) { (element as any).webkitRequestFullscreen(); } // Safari
    else if ((element as any).msRequestFullscreen) { (element as any).msRequestFullscreen(); }// IE11
  }

  /********************************
   * End of breadcrumb analysis   *
   *******************************/

}
