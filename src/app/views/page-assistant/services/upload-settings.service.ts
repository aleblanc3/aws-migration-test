import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UploadSettingsService {

  private selectedUploadType = signal<'url' | 'paste' | 'word'>('url');

  getSelectedUploadType = computed(() => this.selectedUploadType());

  setUploadType(type: 'url' | 'paste' | 'word') {
    this.selectedUploadType.set(type);
  }
}