import { Component, OnInit, ElementRef, ViewChild, effect, inject, Input } from '@angular/core';
import { CommonModule, LocationStrategy } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TreeTableModule } from 'primeng/treetable';
import { Tree, TreeNodeContextMenuSelectEvent, TreeNodeDropEvent } from 'primeng/tree';
import { ContextMenuModule, ContextMenu } from 'primeng/contextmenu';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { PopoverModule } from 'primeng/popover';
import { TabsModule } from 'primeng/tabs';

//Services

import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../../services/theme.service';

import { MenuItem, TreeNode, TreeDragDropService } from 'primeng/api';
import { FullscreenHTMLElement } from '../data/data.model';

import { environment } from '../../../../environments/environment';

import { IaRelationshipService } from '../services/ia-relationship.service';
import { IaTreeService } from '../services/ia-tree.service';
import { FetchService } from '../../../services/fetch.service';

@Component({
  selector: 'ca-ia-tree',
  imports: [CommonModule, FormsModule,
    TranslateModule,
    TableModule, ButtonModule, OrganizationChartModule, ProgressBarModule, InputNumberModule, InputTextModule, TreeTableModule, Tree, ContextMenuModule, InputGroupModule, InputGroupAddonModule, TooltipModule, ToggleButtonModule,
    PopoverModule, ToggleSwitchModule, TabsModule],
  providers: [TreeDragDropService],
  templateUrl: './ia-tree.component.html',
  styles: `
    :host {
      display: block;
    }
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
    /*transparent button*/
    ::ng-deep .transparent-toggle:hover {
    background-color: var(--p-primary-50) !important;
  }
  ::ng-deep .transparent-toggle {
    background-color: unset !important;
    border: none !important;
  }
  `
})
export class IaTreeComponent implements OnInit {

  @Input() iaTree: TreeNode[] | null = null;
  @Input() brokenLinks: { parentUrl?: string, url: string, status: number }[] = []

  private translate = inject(TranslateService);
  private locationStrategy = inject(LocationStrategy);
  private theme = inject(ThemeService);
  public iaTreeService = inject(IaTreeService);
  private iaService = inject(IaRelationshipService);
  private fetchService = inject(FetchService);

  production: boolean = environment.production;

  constructor() {
    effect(() => {
      this.theme.darkMode(); // track dark mode changes
      this.updateNodeStyles(this.iaTree, 0);
    });
  }

  ngOnInit() {
    this.options = [
      ...this.baseMenu
    ];
    this.baseHref = this.locationStrategy.getBaseHref();
  }

  //Toggle visibility of indicators in the tree chart
  toggles: Record<'orphan' | 'crawl' | 'scope' | 'proto', boolean> = {
    orphan: true,
    crawl: true,
    scope: true,
    proto: true
  };
  get toggleKeys(): (keyof typeof this.toggles)[] {
    return Object.keys(this.toggles) as (keyof typeof this.toggles)[];
  }

  getToggleStates() {
    const values = Object.values(this.toggles);
    const allTrue = values.every(v => v);
    const allFalse = values.every(v => !v);
    return { allTrue, allFalse };
  }

  onMainToggleClick() {
    const { allTrue } = this.getToggleStates();
    const newValue = !allTrue; //toggle them on if not all on
    this.toggleKeys.forEach(key => this.toggles[key] = newValue);
  }

  getMainToggleIcon(): string {
    const { allTrue, allFalse } = this.getToggleStates();
    if (allTrue) return 'pi pi-eye';
    if (allFalse) return 'pi pi-eye-slash';
    return 'pi pi-minus'; // some visible
  }

  getMainToggleLabel(): string {
    const { allTrue, allFalse } = this.getToggleStates();
    if (allTrue) return 'All visible                       ';
    if (allFalse) return 'All hidden';
    return 'Some visible';
  }
  //End of toggle code

  //Get child pages
  async getChildPages(node: TreeNode) {
    console.log(node);
    node.data.isRoot = true;
    await this.fetchService.simulateDelay(2000); //so we can see spinner spin
    await this.iaTreeService.crawlFromRoots(this.iaTree!, this.brokenLinks);
    this.iaTreeService.updateNodeStyles(this.iaTree, 0);
  }

  //End of get child pages

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
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen(); // Safari
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen(); // IE11
    }
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
            this.updateNodeStyles(this.iaTree, 0);
            this.selectedNode = null!;
          }
        },
        {
          label: 'ROT',
          icon: 'pi pi-trash',
          command: () => {
            this.selectedNode.data.customStyleKey = 'rot';
            this.selectedNode.data.borderStyle = 'border-2 border-primary border-round border-dashed shadow-2';
            this.updateNodeStyles(this.iaTree, 0);
            this.selectedNode = null!;
          }
        },
        {
          label: 'Page move',
          icon: 'pi pi-sitemap',
          command: () => {
            this.selectedNode.data.customStyleKey = 'move';
            this.selectedNode.data.borderStyle = 'border-2 border-primary border-round border-dashed shadow-2';
            this.updateNodeStyles(this.iaTree, 0);
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
            this.updateNodeStyles(this.iaTree, 0);
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

  onNodeContextMenu(event: TreeNodeContextMenuSelectEvent) {
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
    this.updateNodeStyles(this.iaTree, 0); // refresh styles
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

    const location = findParent(this.iaTree || []);
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
    this.updateNodeStyles(this.iaTree, 0);
  }

  deleteNode() {
    if (!this.iaTree || !this.selectedNode) return;

    const nodeToDelete = this.selectedNode;

    // Root-level (don't delete the root!!!)
    const rootIndex = this.iaTree.findIndex(n => n === nodeToDelete);
    if (rootIndex > -1) {
      console.warn('Cannot delete root node.');
      return;
    }

    // Child node
    const findAndDelete = (nodes: TreeNode[]): boolean => {
      for (const node of nodes) {
        const children: TreeNode[] = node.children ?? [];
        const childIndex = children.findIndex(c => c === nodeToDelete);
        if (childIndex > -1) {
          this.undoArray.push({ node: nodeToDelete, parent: node, index: childIndex });
          children.splice(childIndex, 1);
          node.children = children.length ? children : undefined;
          return true;
        }
        // recurse into grandchildren
        if (children.length && findAndDelete(children)) {
          return true;
        }
      }
      return false;
    };

    findAndDelete(this.iaTree);
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
      this.updateNodeStyles(this.iaTree, 0);
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

  handleNodeDrop(event: TreeNodeDropEvent): void {
    const dragNode = event.dragNode;
    const dropNode = event.dropNode;

    if (!dragNode || !dropNode) return;

    if ((dropNode.data.isContainer || dropNode.parent?.data?.isContainer) && dragNode.data.isContainer) return; // not foolproof but tries to prevent dropping a container into another container
    event.accept?.(); // accept the drop

    //Reset move style so move style can be removed if user puts it back
    if (dragNode.data.customStyleKey === 'move') {
      dragNode.data.customStyleKey = '';
      dragNode.data.borderStyle = 'border-2 border-primary border-round shadow-2';
    }

    //Get target element
    const targetEl = event.originalEvent?.target as HTMLElement;
    const tag = targetEl.tagName.toLowerCase(); // will be <a> or <div> if dropped on a node or <li> if dropped between nodes
    const droppedOnNode: boolean = tag !== 'li'

    //Check if no change to IA structure
    const dragParentUrl = dragNode.data.originalParent; //parentUrl is the original parent before any changes
    const dropUrl = dropNode.data.url;
    const dropParentUrl = dropNode.parent?.data?.url ?? '';
    const dropGrandparentUrl = dropNode.parent?.data?.originalParent ?? '';

    //console.log('Tag should be a if dropped on node:\n', tag);
    if (droppedOnNode) { console.log('Dropped on node'); console.log('Checking if parentUrl matches node Url:\n', dropUrl); }
    else { console.log('Dropped between nodes'); console.log('Checking if parentUrl matches sibling parent Url:\n', dropParentUrl); }
    //console.log('Drag parentUrl:\n', dragParentUrl);

    const droppedOnParent = droppedOnNode && dragParentUrl === dropUrl;
    const reorderedSiblings = !droppedOnNode && dragParentUrl === dropParentUrl;

    //console.log('Sibling reorder: ', reorderedSiblings);
    //console.log('Dropped on parent: ', droppedOnParent);

    //Check if dropping sibling onto a container
    const droppedOnContainerSibling = dropNode.data.isContainer && droppedOnNode && dragParentUrl === dropParentUrl;
    const droppedBetweenContainerSibling = dropNode.parent?.data?.isContainer && !droppedOnNode && dragParentUrl === dropGrandparentUrl;
    //console.log('Dropped on container sibling: ', droppedOnContainerSibling);
    //console.log('Dropped between container sibling: ', droppedBetweenContainerSibling);

    //Check for custom style (containers & dummy nodes)
    const isCustom = dragNode.data.customStyle
    //console.log('Container or dummy node: ', isCustom);

    //console.log('Event drop', event);

    //Set move style when not reordering siblings, moving siblings into a template container, dragging a custom style node, or moving a new page
    if (!(droppedOnParent || reorderedSiblings || droppedOnContainerSibling || droppedBetweenContainerSibling || isCustom || dragNode.data.customStyleKey === 'new')) {
      dragNode.data.customStyleKey = 'move';
      dragNode.data.borderStyle = 'border-2 border-primary border-round border-dashed shadow-2';
    }

    //Cleanup dragover style (happens when hovering on parent but dropping between parent and top child)
    const treeRoot = targetEl.closest('.p-tree');
    treeRoot?.querySelectorAll('.p-tree-node-dragover').forEach((el) => {
      el.classList.remove('p-tree-node-dragover');
    });

    console.log('Drag parent URL', dragNode.data.originalParent);
    this.updateNodeStyles(this.iaTree, 0);
  }

  private updateNodeStyles(nodes: TreeNode[] | null, level = 0): void {
    if (!nodes) return;

    for (const node of nodes) {

      const borderStyle = node.data?.borderStyle || 'border-2 border-primary border-round shadow-2';

      const bgClass = this.iaTreeService.bgColors[level % this.iaTreeService.bgColors.length];
      const bgStyle = this.iaTreeService.contextStyles[node.data?.customStyleKey] ?? bgClass;

      node.styleClass = `${borderStyle} ${bgStyle}`;

      if (node.children && node.children.length > 0) {
        //console.log('Node status', node.data.isContainer, level);
        const nextLevel = node.data.isContainer ? level : level + 1;
        this.updateNodeStyles(node.children, nextLevel);
      }
    }
  }

}
