import { Component, OnInit, ElementRef, ViewChild, effect, inject } from '@angular/core';
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
import { UploadStateService } from '../../services/upload-state.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../../../services/theme.service';

import { MenuItem, TreeNode, TreeDragDropService } from 'primeng/api';
import { FullscreenHTMLElement } from '../../../ia-assistant/data/data.model';

import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'ca-ia-structure',
  imports: [CommonModule, FormsModule,
    TranslateModule,
    TableModule, ButtonModule, IftaLabel, BreadcrumbModule, OrganizationChartModule, ProgressBarModule, InputNumberModule, InputTextModule, TreeTableModule, Tree, ContextMenuModule, InputGroup, InputGroupAddonModule,],
  providers: [TreeDragDropService],
  templateUrl: './ia-structure.component.html',
  styles: `
    /* remove link style from tree & fix indentation for line breaks in table */
    .ia-label {
      white-space: pre-line; 
      display: inline-block;
      color: var(--text-color) !important; 
      text-decoration: none !important;
    } 

    /* fix tree text color for dark backgrounds */
    ::ng-deep .p-tree li[class*="text-white"] > .p-tree-node-content .ia-label {
      color: #ffffff !important;
    }

    /* fix tree text color for light backgrounds */
    ::ng-deep .p-tree li[class*="text-black"] > .p-tree-node-content .ia-label {
      color: #000000 !important;
    }

    /* remove default hover style from tree nodes */
    ::ng-deep .p-tree .p-tree-node-content:hover {
      background-color: unset !important; 
    }

    /* remove link style from IA chart */
    ::ng-deep .ia-chart-container .p-organizationchart-node a { 
      color: var(--text-color) !important;
      text-decoration: none !important;
    }

    /* fix chart text color for dark backgrounds */
    ::ng-deep .ia-chart-container .p-organizationchart-node.text-white a {
      color: #ffffff !important;
    }

    /* fix chart text color for light backgrounds */
    ::ng-deep .ia-chart-container .p-organizationchart-node.text-black a {
      color: #000000 !important;
    }
`
})
export class IaStructureComponent implements OnInit {
  private uploadState = inject(UploadStateService);
  private translate = inject(TranslateService);
  private locationStrategy = inject(LocationStrategy);
  private theme = inject(ThemeService);

  production: boolean = environment.production;

  constructor() {
    effect(() => {
      this.theme.darkMode(); // track dark mode changes
      this.updateNodeStyles(this.iaChart, 0);
    });
  }

  ngOnInit() {
    const data = this.uploadState.getUploadData();
    this.breadcrumb = data?.breadcrumb || [];
    this.originalUrl = data?.originalUrl || "";
    this.options = [
      ...this.baseMenu
    ];
    this.baseHref = this.locationStrategy.getBaseHref();
  }

  originalUrl = "";
  //Breadcrumb & orphan status
  breadcrumb: MenuItem[] = [];
  urlFound: boolean | null = null;

  //IA chart
  iaChart: TreeNode[] | null = null;
  brokenLinks: { parentUrl?: string, url: string, status: number }[] = []
  depth = 4 //default value

  //For tracking progress while building IA chart
  isChartLoading = false;
  iaProgress = 0;
  totalUrls = 0;
  processedUrls = 0;

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

  //Set background color

  get bgColors(): string[] {
    return this.theme.darkMode()
      ? this.bgColorsDark
      : this.bgColorsLight;
  }

  bgColorsLight: string[] = [
    "surface-0 hover:bg-primary-50",
    "bg-primary-50 hover:bg-primary-100",
    "bg-primary-100 hover:bg-primary-200",
    "bg-primary-200 hover:bg-primary-300",
    "bg-primary-300 hover:bg-primary-400",
    "bg-primary-400 hover:bg-primary-500",
    "bg-primary-500 hover:bg-primary-600 text-white",
    "bg-primary-600 hover:bg-primary-700 text-white",
    "bg-primary-700 hover:bg-primary-800 text-white",
    "bg-primary-800 hover:bg-primary-900 text-white",
  ];

  bgColorsDark: string[] = [
    "surface-0 hover:bg-primary-900",
    "bg-primary-900 hover:bg-primary-800",
    "bg-primary-800 hover:bg-primary-700",
    "bg-primary-700 hover:bg-primary-600",
    "bg-primary-600 hover:bg-primary-500",
    "bg-primary-500 hover:bg-primary-400",
    "bg-primary-400 hover:bg-primary-300  text-black",
    "bg-primary-300 hover:bg-primary-200 text-black",
    "bg-primary-200 hover:bg-primary-100 text-black",
    "bg-primary-100 hover:bg-primary-50 text-black",
  ];

  get contextStyles(): Record<string, string> {
    return this.theme.darkMode()
      ? this.contextStylesDark
      : this.contextStylesLight;
  }

  contextStylesLight: Record<string, string> = {
    new: 'bg-green-200 hover:bg-green-300 text-black',
    rot: 'bg-red-200 hover:bg-red-300 text-black',
    move: 'bg-yellow-200 hover:bg-yellow-300 text-black',
    template: 'surface-200 hover:surface-300 text-black'
  };

  contextStylesDark: Record<string, string> = {
    new: 'bg-green-700 hover:bg-green-600 text-white',
    rot: 'bg-red-700 hover:bg-red-600 text-white',
    move: 'bg-yellow-700 hover:bg-yellow-600 text-black',
    template: 'surface-700 hover:surface-600 text-white'
  };

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
  async buildIaTree(urls: string[], depth: number, parentUrl?: string, level = 0): Promise<TreeNode[]> {
    if (depth <= 0) return [];

    //reset progress tracker
    if (!parentUrl && level === 0) {
      this.isChartLoading = true;
      this.iaProgress = 5;
      this.processedUrls = 0;
      this.totalUrls = urls.length;
    }

    const nodes: TreeNode[] = [];

    const bgClass = this.bgColors[level % this.bgColors.length];

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
          originalParent: parentUrl,
          editing: null,
          customStyle: false,
          customStyleKey: null,
          borderStyle: 'border-2 border-primary border-round shadow-2'
        },
        expanded: true,
        styleClass: `border-2 border-primary border-round shadow-2 ${bgClass}`,
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
            data: {
              h1: `+ ${total - limit} more...`,
              url: null,
              originalParent: parentUrl,
              editing: null,
              customStyle: true,
              customStyleKey: 'template',
              borderStyle: 'border-2 border-primary border-round shadow-2 border-dashed'
            },
            expanded: true,
            styleClass: `border-2 border-primary border-round shadow-2 border-dashed surface-100 hover:surface-200`,
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
    const element = elRef.nativeElement as FullscreenHTMLElement;
    element.requestFullscreen?.() || element.webkitRequestFullscreen?.() || element.msRequestFullscreen?.(); //backup support for IE11 & Safari
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
      separator: true
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
      label: 'Change template',
      icon: 'pi pi-sync',
      items: [
        {
          label: 'Split into subway pattern',
          icon: 'pi pi-sitemap',
          command: () => {
            console.log('Change template ', this.selectedNode)
            this.addParentNode('subway');
          }
        },
        {
          label: 'Combine into single page',
          icon: 'pi pi-file-check',
          command: () => {
            console.log('Change template ', this.selectedNode)
            this.addParentNode('combine');
          }
        },
      ]
    },
    {
      label: 'Change style',
      icon: 'pi pi-palette',
      items: [
        {
          label: 'New page',
          icon: 'pi pi-file-plus',
          command: () => {
            this.selectedNode.data.customStyleKey = 'new';
            this.selectedNode.data.borderStyle = 'border-2 border-primary border-round border-dashed shadow-2';
            this.updateNodeStyles(this.iaChart, 0);
            this.selectedNode = null!;
          }
        },
        {
          label: 'ROT',
          icon: 'pi pi-trash',
          command: () => {
            this.selectedNode.data.customStyleKey = 'rot';
            this.selectedNode.data.borderStyle = 'border-2 border-primary border-round border-dashed shadow-2';
            this.updateNodeStyles(this.iaChart, 0);
            this.selectedNode = null!;
          }
        },
        {
          label: 'Page move',
          icon: 'pi pi-sitemap',
          command: () => {
            this.selectedNode.data.customStyleKey = 'move';
            this.selectedNode.data.borderStyle = 'border-2 border-primary border-round border-dashed shadow-2';
            this.updateNodeStyles(this.iaChart, 0);
            this.selectedNode = null!;
          }
        },
        {
          separator: true
        },
        {
          label: 'Reset custom style',
          icon: 'pi pi-replay',
          command: () => {
            this.selectedNode.data.customStyle = false;
            this.selectedNode.data.customStyleKey = null;
            this.selectedNode.data.borderStyle = 'border-2 border-primary border-round shadow-2';
            this.updateNodeStyles(this.iaChart, 0);
            this.selectedNode = null!;
          }
        },
      ]
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
  draggable = true;
  selectable = true;

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
    const customStyle = this.selectedNode.data.customStyle;

    this.options.forEach(item => {
      if (item.label === 'Open page in new page assistant' || item.label === 'Open page in new tab') {
        item.disabled = !this.selectedNode?.data?.url?.trim(); //disable if no URL
      }
      if (item.label === 'Change template' || item.label === 'Change style') {
        item.disabled = customStyle; //disable if custom style
      }
    });
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
    if (!this.selectedNode) return;

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
        customStyle: false,
        customStyleKey: 'new',
        borderStyle: 'border-2 border-primary border-round border-dashed shadow-2'
      },
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
    this.updateNodeStyles(this.iaChart, 0); // refresh styles
  }

  //Will be used to create a container to mark pages for template change
  addParentNode(action: 'subway' | 'combine') {
    if (!this.selectedNode) return;

    // Find the parent node and the array the selected node is in
    const findParent = (nodes: TreeNode[], parentNode?: TreeNode): { parentContainer: TreeNode[]; parentNode: TreeNode | null } | null => {
      for (const node of nodes) {
        if (node === this.selectedNode) {
          return {
            parentContainer: nodes, // found at this level
            parentNode: parentNode ?? null,
          };
        }
        if (node.children) {
          const searchChildNodes = findParent(node.children, node);
          if (searchChildNodes) return searchChildNodes;
        }
      }
      return null;
    };

    const location = findParent(this.iaChart || []);
    if (!location) return; // if not found

    const { parentContainer, parentNode } = location;

    const label = action === 'subway' ? 'Split into subway pattern' : 'Combine into single page';

    //Create new parent node
    const newParentNode: TreeNode = {
      label: label,
      data: {
        h1: label,
        url: '',
        originalParent: parentNode?.data?.url ?? '',
        editing: false,
        customStyle: true, // prevents style changes
        customStyleKey: 'template',
        isContainer: true, // used to keep child nodes at proper level and prevent drag/drop of these wrappers into each other
        borderStyle: 'border-2 border-primary border-round border-dashed shadow-2'
      },
      expanded: true,
      children: [this.selectedNode]
    };

    // Replace the original node with the new parent node (which contains the original node as a child)
    const index = parentContainer.indexOf(this.selectedNode);
    if (index !== -1) {
      parentContainer.splice(index, 1, newParentNode);
    }

    // Make the new parent the selection
    this.selectedNode = newParentNode;

    // UI refresh
    this.updateMenu();
    this.updateNodeStyles(this.iaChart, 0);
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
    if (!this.selectedNode.data.customStyle) {
      this.selectedNode.data.customStyleKey = 'rot';
      this.selectedNode.data.borderStyle = 'border-2 border-primary border-round border-dashed shadow-2';
      this.updateNodeStyles(this.iaChart, 0);
    }
    this.updateMenu();
  }

  //Add undo option under delete if there is something to restore
  updateMenu() {
    this.options = [...this.baseMenu];

    const deleteIndex = this.options.findIndex(option => option.label === 'Delete page');

    if (this.undoArray.length > 0 && deleteIndex !== -1) {
      this.options.splice(deleteIndex + 1, 0, {
        label: 'Restore page',
        icon: 'pi pi-history',
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

  handleNodeDrop(event: any): void {

    if ((event.dropNode.data.isContainer || event.dropNode.parent?.data?.isContainer) && event.dragNode.data.isContainer) return; // not foolproof but tries to prevent dropping a container into another container
    event.accept(); // accept the drop

    //Reset move style so move style can be removed if user puts it back
    if (event.dragNode.data.customStyleKey === 'move') {
      event.dragNode.data.customStyleKey = '';
      event.dragNode.data.borderStyle = 'border-2 border-primary border-round shadow-2';
    }

    //Get target element
    const targetEl = event.originalEvent.target as HTMLElement;
    const tag = targetEl.tagName.toLowerCase(); // will be <a> or <div> if dropped on a node or <li> if dropped between nodes
    const droppedOnNode: boolean = tag !== 'li'

    //Check if no change to IA structure
    const dragParentUrl = event.dragNode.data.originalParent; //parentUrl is the original parent before any changes
    const dropUrl = event.dropNode.data.url;
    const dropParentUrl = event.dropNode.parent?.data?.url ?? '';
    const dropGrandparentUrl = event.dropNode.parent?.data?.originalParent ?? '';

    //console.log('Tag should be a if dropped on node:\n', tag);
    if (droppedOnNode) { console.log('Dropped on node'); console.log('Checking if parentUrl matches node Url:\n', dropUrl); }
    else { console.log('Dropped between nodes'); console.log('Checking if parentUrl matches sibling parent Url:\n', dropParentUrl); }
    //console.log('Drag parentUrl:\n', dragParentUrl);

    const droppedOnParent = droppedOnNode && dragParentUrl === dropUrl;
    const reorderedSiblings = !droppedOnNode && dragParentUrl === dropParentUrl;

    //console.log('Sibling reorder: ', reorderedSiblings);
    //console.log('Dropped on parent: ', droppedOnParent);

    //Check if dropping sibling onto a container
    const droppedOnContainerSibling = event.dropNode.data.isContainer && droppedOnNode && dragParentUrl === dropParentUrl;
    const droppedBetweenContainerSibling = event.dropNode.parent?.data?.isContainer && !droppedOnNode && dragParentUrl === dropGrandparentUrl;
    //console.log('Dropped on container sibling: ', droppedOnContainerSibling);
    //console.log('Dropped between container sibling: ', droppedBetweenContainerSibling);

    //Check for custom style (containers & dummy nodes)
    const isCustom = event.dragNode.data.customStyle
    //console.log('Container or dummy node: ', isCustom);

    //console.log('Event drop', event);

    //Set move style when not reordering siblings, moving siblings into a template container, dragging a custom style node, or moving a new page
    if (!(droppedOnParent || reorderedSiblings || droppedOnContainerSibling || droppedBetweenContainerSibling || isCustom || event.dragNode.data.customStyleKey === 'new')) {
      event.dragNode.data.customStyleKey = 'move';
      event.dragNode.data.borderStyle = 'border-2 border-primary border-round border-dashed shadow-2';
    }

    //Cleanup dragover style (happens when hovering on parent but dropping between parent and top child)
    const treeRoot = targetEl.closest('.p-tree');
    treeRoot?.querySelectorAll('.p-tree-node-dragover').forEach((el) => {
      el.classList.remove('p-tree-node-dragover');
    });

    console.log('Drag parent URL', event.dragNode.data.originalParent);
    this.updateNodeStyles(this.iaChart, 0);
  }

  private updateNodeStyles(nodes: TreeNode[] | null, level = 0): void {
    if (!nodes) return;

    for (const node of nodes) {

      const borderStyle = node.data?.borderStyle || 'border-2 border-primary border-round shadow-2';

      const bgClass = this.bgColors[level % this.bgColors.length];
      const bgStyle = this.contextStyles[node.data?.customStyleKey] ?? bgClass;

      node.styleClass = `${borderStyle} ${bgStyle}`;

      if (node.children && node.children.length > 0) {
        //console.log('Node status', node.data.isContainer, level);
        const nextLevel = node.data.isContainer ? level : level + 1;
        this.updateNodeStyles(node.children, nextLevel);
      }
    }
  }


}