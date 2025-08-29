import { Injectable, signal, computed } from '@angular/core';
import { UploadData, ModifiedData, OriginalData } from '../data/data.model'

@Injectable({
  providedIn: 'root'
})
export class UploadStateService {

  //Upload type
  private selectedUploadType = signal<'url' | 'paste' | 'word'>('url');
  getSelectedUploadType = computed(() => this.selectedUploadType());
  setUploadType(type: 'url' | 'paste' | 'word') {
    this.selectedUploadType.set(type);
  }

  //Upload data
  private uploadData = signal<Partial<UploadData> | null>(null);
  private originalUploadData: Partial<UploadData> | null = null; //for the compare with original button
  private prevUploadData: (Partial<UploadData> | null)[] = []; //for the undo button
  private maxHistory = 20; //max size of undo array
  getUploadData = computed(() => this.uploadData());

  setUploadData(data: Partial<UploadData>) {
    this.uploadData.set(data);
  }

  mergeModifiedData(modified: ModifiedData): void {
    const current = this.uploadData() || {};
    this.uploadData.set({
      ...current,
      modifiedHtml: modified.modifiedHtml,
      modifiedUrl: modified.modifiedUrl,
    });
  }

  mergeOriginalData(original: OriginalData): void {
    const current = this.uploadData() || {};
    this.uploadData.set({
      ...current,
      originalHtml: original.originalHtml,
      originalUrl: original.originalUrl,
    });
  }

  mergeFoundFlags(version: 'original' | 'modified', flags: { hidden: boolean; modal: boolean; dynamic: boolean }) {
    const current = this.uploadData() || {};
    const currentFound = current.found || {
      original: { hidden: true, modal: true, dynamic: true },
      modified: { hidden: true, modal: true, dynamic: true }
    };
    this.uploadData.set({
      ...current,
      found: {
        ...currentFound,
        [version]: {
          ...currentFound[version],
          ...flags
        }
      }
    });
  }

  // Restore the previous state (for undo button)
  undoLastChange(): void {
    if (this.prevUploadData.length === 0) return;
    const lastState = this.prevUploadData.pop() ?? null;
    this.uploadData.set(lastState);
  }

  isUndoDisabled(): boolean { return this.prevUploadData.length === 0; }

  // Save a copy of uploadData before overwriting
  savePreviousUploadData(): void {
    const current = this.uploadData();
    this.prevUploadData.push(current ? structuredClone(current) : null);
    // Remove oldest item if array gets too big
    if (this.prevUploadData.length > this.maxHistory) {
      this.prevUploadData.shift();
    }
  }

  //Reset
  resetUploadFlow(): void {
    this.selectedUploadType.set('url'); // default to URL
    this.uploadData.set(null);
    this.prevUploadData = [];
  }

}