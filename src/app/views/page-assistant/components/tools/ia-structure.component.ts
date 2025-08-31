import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, LocationStrategy } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { IftaLabel } from 'primeng/iftalabel';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TreeTableModule } from 'primeng/treetable';
import { Tree } from 'primeng/tree';
import { ContextMenuModule, ContextMenu } from 'primeng/contextmenu';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';


//Services
import { UrlDataService } from '../../services/url-data.service';
import { UploadStateService } from '../../services/upload-state.service';
import { ValidatorService } from '../../services/validator.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

import { HttpClient } from '@angular/common/http';
import { MenuItem, TreeNode, TreeDragDropService } from 'primeng/api';

@Component({
  selector: 'ca-ia-structure',
  imports: [CommonModule, FormsModule,
    TranslateModule,
    TableModule, ButtonModule, IftaLabel, BreadcrumbModule, OrganizationChartModule, ProgressBarModule, InputNumberModule, InputTextModule, TreeTableModule, Tree, ContextMenuModule, InputGroup, InputGroupAddonModule,],
  providers: [TreeDragDropService],
  templateUrl: './ia-structure.component.html',
  styles: `
    .ia-label {
      white-space: pre-line;
      display: inline-block;
    }
    ::ng-deep .p-tree-node-label > span {
  display: flex !important;       /* or block */
  width: 100% !important;         /* now it can actually expand */
  align-items: center; /* vertically center icons and input */
  gap: 0.5rem;         /* spacing between icon and input */
}`
})
export class IaStructureComponent implements OnInit {

  constructor(private urlDataService: UrlDataService, private uploadState: UploadStateService, private translate: TranslateService, private validator: ValidatorService, private http: HttpClient, private locationStrategy: LocationStrategy) { }

  ngOnInit() {
    const data = this.uploadState.getUploadData();
    this.breadcrumb = data?.breadcrumb || [];
    this.originalUrl = data?.originalUrl || "";
    this.options = [
      ...this.baseMenu
    ];
    this.baseHref = this.locationStrategy.getBaseHref();
  }

  originalUrl: string = "";
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
          url: url,
          editing: null
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

  //Context menu
  @ViewChild('cm') cm!: ContextMenu;
  options: MenuItem[] = []; //options for editing chart nodes
  baseMenu: MenuItem[] = [
    {
      label: 'Edit label',
      icon: 'pi pi-pen-to-square',
      command: () => {
        console.log('Edit ', this.selectedNode);
        this.editNode('label');
      }
    },
    {
      label: 'Edit url',
      icon: 'pi pi-link',
      command: () => {
        console.log('Edit ', this.selectedNode);
        this.editNode('link');
      }
    },
    {
      label: 'Update IA color',
      icon: 'pi pi-sitemap',
      items: [
        {
          label: 'Root: pink',
          icon: 'pi pi-palette',
          command: () => {
            this.selectedNode.styleClass = 'border-2 border-primary border-round bg-purple-50 shadow-2';
            this.selectedNode = null!;
          }
        },
        {
          label: 'Level 1: blue',
          icon: 'pi pi-palette',
          command: () => {
            this.selectedNode.styleClass = 'border-2 border-primary border-round bg-blue-50 shadow-2';
            this.selectedNode = null!;
          }
        },
        {
          label: 'Level 2: green',
          icon: 'pi pi-palette',
          command: () => {
            this.selectedNode.styleClass = 'border-2 border-primary border-round bg-green-50 shadow-2';
            this.selectedNode = null!;
          }
        },
        {
          label: 'Level 3: yellow',
          icon: 'pi pi-palette',
          command: () => {
            this.selectedNode.styleClass = 'border-2 border-primary border-round bg-yellow-50 shadow-2';
            this.selectedNode = null!;
          }
        },
        {
          label: 'Level 4: orange',
          icon: 'pi pi-palette',
          command: () => {
            this.selectedNode.styleClass = 'border-2 border-primary border-round bg-orange-50 shadow-2';
            this.selectedNode = null!;
          }
        },
        {
          label: 'Level 5: red',
          icon: 'pi pi-palette',
          command: () => {
            this.selectedNode.styleClass = 'border-2 border-primary border-round bg-red-50 shadow-2';
            this.selectedNode = null!;
          }
        },
        {
          label: 'Dashed border',
          icon: 'pi pi-palette',
          command: () => {
            this.selectedNode.styleClass = 'border-2 border-primary border-round border-dashed surface-100 shadow-2';
            this.selectedNode = null!;
          }
        }
      ]
    },
    {
      label: 'Add child page',
      icon: 'pi pi-plus',
      command: () => {
        console.log('Add ', this.selectedNode);
        this.addChildNode();
      }
    },
    {
      label: 'Delete page',
      icon: 'pi pi-trash',
      command: () => {
        console.log('Delete ', this.selectedNode)
        this.deleteNode();
      }
    },
    {
      separator: true
    },
    {
      label: 'Export to CSV',
      icon: 'pi pi-file-export',
      disabled: true, // TODO: implement export
      command: () => {
        console.log('Export ', this.selectedNode)
        this.exportTable();
      }
    },
    {
      separator: true
    },
    {
      label: 'Open page in new page assistant',
      icon: 'pi pi-sparkles',
      command: () => {
        console.log('Open link in page assistant ', this.selectedNode)
        this.openInPageAssistant();
      }
    },
    {
      label: 'Open page in new tab',
      icon: 'pi pi-external-link',
      command: () => {
        console.log('Open link in new tab ', this.selectedNode)
        this.openNodeUrl();
      }
    },
  ]
  selectedNode!: TreeNode;
  draggable: boolean = true;
  selectable: boolean = true;

  //For tracking previous states
  editingNode: TreeNode | null = null;
  undoArray: { node: TreeNode; parent: TreeNode; index: number }[] = [];

  //for loading in page assistant
  baseHref: string | null = null;

  onNodeContextMenu(event: any) {
    if (this.editingNode) { //auto-save before switching
      this.editingNode.data.editing = null;
    }
    this.selectedNode = event.node;
  }

  onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.saveNode();
      console.log('Saved ', this.selectedNode);
      event.stopPropagation();
      event.preventDefault();
    }

    if (event.key === ' ') {
      event.stopPropagation(); //allows space to work in tree
    }
  }

  editNode(mode: 'label' | 'link' = 'label') {
    if (this.selectedNode) {
      this.selectedNode.data.editing = mode;
      this.editingNode = this.selectedNode;
      this.draggable = false;
      this.selectable = false;
      // auto-focus on input
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('input.ia-label');
        input?.focus();
      });
    }
  }

  saveNode() {
    if (this.selectedNode) {
      this.selectedNode.data.editing = null;
    }
    if (this.selectedNode.data.url === 'https://www.canada.ca/') { this.editNode('link'); return; } // don't allow default URLs
    this.draggable = true;
    this.selectable = false;
  }

  addChildNode() {
    if (!this.selectedNode) return; // need a selected parent node

    // Ensure children array exists
    if (!this.selectedNode.children) {
      this.selectedNode.children = [];
    }

    // Create the new node
    const newNode: TreeNode = {
      label: 'New page',
      data: {
        h1: 'New page',
        url: 'https://www.canada.ca/', // default URL
        editing: false,
      },
      styleClass: 'border-2 border-primary border-round surface-100 shadow-2',
      children: []
    };

    // Push into parent
    this.selectedNode.children.push(newNode);

    // Expand parent so the new child is visible
    this.selectedNode.expanded = true;

    // Select the new node so the user can start editing
    this.selectedNode = newNode;
    this.editNode('label');

    this.updateMenu(); // refresh context menu, undo, etc.
  }

  deleteNode() {
    if (!this.iaChart || !this.selectedNode) return;

    const nodeToDelete = this.selectedNode;

    // Root-level (don't delete the root!!!)
    const rootIndex = this.iaChart.findIndex(n => n === nodeToDelete);
    if (rootIndex > -1) {
      console.warn('Cannot delete root node.');
      return;
    }

    // Child node
    const findAndDelete = (nodes: TreeNode[]): boolean => {
      for (let i = 0; i < nodes.length; i++) {
        const children = nodes[i].children || [];
        const childIndex = children.findIndex(c => c === nodeToDelete);
        if (childIndex > -1) {
          this.undoArray.push({ node: nodeToDelete, parent: nodes[i], index: childIndex });
          children.splice(childIndex, 1);
          return true;
        }
        // recurse into grandchildren
        if (children.length && findAndDelete(children)) {
          return true;
        }
      }
      return false;
    };

    findAndDelete(this.iaChart);
    this.updateMenu();
  }

  restoreNode() {
    if (this.undoArray.length === 0) return;

    const last = this.undoArray.pop()!;

    if (last.parent?.children) {
      last.parent.children.splice(last.index, 0, last.node);
    } else {
      console.warn('Cannot restore node: parent missing.');
      return;
    }

    this.selectedNode = last.node;
    this.updateMenu();
  }

  //Add undo option under delete if there is something to restore
  updateMenu() {
    this.options = [...this.baseMenu];

    const deleteIndex = this.options.findIndex(option => option.label === 'Delete page');

    if (this.undoArray.length > 0 && deleteIndex !== -1) {
      this.options.splice(deleteIndex + 1, 0, {
        label: 'Restore page',
        icon: 'pi pi-refresh',
        command: () => this.restoreNode()
      });
    }
  }

  //Placeholder for export function
  exportTable() {
  }

  //Open link in new tab
  openNodeUrl() {
    window.open(this.selectedNode.data.url, '_blank');
  }

  //Make share link a service so it can be used on both share.component.ts and here
  openInPageAssistant() {
    const baseUrl = (window.location.origin + this.baseHref).replace(/\/+$/, '');
    const urlParam = encodeURIComponent(this.selectedNode.data.url);
    const shareLink = `${baseUrl}/page-assistant/share?url=${urlParam}`;
    console.log('Open in page assistant: ', shareLink);
    window.open(shareLink, '_blank');
  }


}