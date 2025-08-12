import { Injectable, signal, computed } from '@angular/core';
import { UploadData, ModifiedData, OriginalData } from '../../../common/data.types'

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

  //Reset
  resetUploadFlow() {
    this.selectedUploadType.set('url'); // default to URL
    this.uploadData.set(null);
  }

}