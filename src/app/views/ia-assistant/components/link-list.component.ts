import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UrlItem } from '../data/data.model'

import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { Tooltip } from "primeng/tooltip";

@Component({
  selector: 'ca-link-list',
  imports: [CommonModule, FormsModule, IftaLabelModule, InputTextModule, InputGroupModule, InputGroupAddonModule, ButtonModule, Tooltip],
  template: `
<ng-container *ngIf="links?.length">
  <h2 class="mb-0">{{ labelKey }} links</h2>
  <div class="flex flex-column gap-2">
    <div *ngFor="let url of links">
      <p-iftalabel *ngIf="url.originalHref">
        <input type="text" id="original" pInputText [(ngModel)]="url.originalHref" disabled pSize="small" class="ng-invalid ng-dirty bg-white" fluid/>
        <label for="original">Original URL</label>
      </p-iftalabel>
      <p-inputgroup>
        <p-iftalabel>
          <input type="text" [id]="labelKey" pInputText variant="outlined" [(ngModel)]="url.href" pSize="small" fluid/>
          <label [for]="labelKey">{{ labelKey }} URL</label>
        </p-iftalabel>
        <p-inputgroup-addon>
          <p-button icon="pi pi-check-circle" pTooltip="Revalidate" tooltipPosition="top" severity="success" variant="text" (click)="approve.emit({ url, event: $event })" />
        </p-inputgroup-addon>
        <p-inputgroup-addon>
          <p-button icon="pi pi-times-circle" pTooltip="Remove link" tooltipPosition="top" severity="danger" variant="text" (click)="remove.emit(url)" />
        </p-inputgroup-addon>
      </p-inputgroup>
    </div>
    <ng-container *ngIf="labelKey === 'Blocked'">
      <p class="mb-0">Only links from the following domains are allowed:</p>
      <ul class="my-0">
          <li>www.canada.ca</li>
          <li>test.canada.ca</li>
          <li>gc-proto.github.io</li>
          <li>cra-proto.github.io</li>
          <li>cra-design.github.io</li>
      </ul>
    </ng-container>
  </div>
</ng-container>
  `,
  styles: `
    :host {
      display: block;
    }
  `
})
export class LinkListComponent {
  @Input() labelKey!: string;
  @Input() links!: UrlItem[];
  @Output() approve = new EventEmitter<{ url: UrlItem, event: Event }>();
  @Output() remove = new EventEmitter<UrlItem>();
}
