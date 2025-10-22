import { Component, Output, EventEmitter, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FileUploadModule, FileUpload } from 'primeng/fileupload';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'ca-file-upload',
  standalone: true,
  imports: [CommonModule, TranslateModule, FileUploadModule, CardModule],
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.css']
})
export class FileUploadComponent {
  @Output() filesSelected = new EventEmitter<FileList>();
  @ViewChild('fileUpload') fileUpload!: FileUpload;

  onSelect(event: { files: File[] }): void {
    const files = event.files;
    if (files && files.length > 0) {
      // Convert to array if it's a FileList or array-like object
      const filesArray = Array.from(files);

      // Convert File[] to FileList-like structure
      const fileList = this.createFileList(filesArray);
      this.filesSelected.emit(fileList);

      // Clear the file upload component so user can select same files again
      if (this.fileUpload) {
        this.fileUpload.clear();
      }
    }
  }

  private createFileList(files: File[]): FileList {
    const dataTransfer = new DataTransfer();
    for (const file of files) {
      dataTransfer.items.add(file);
    }
    return dataTransfer.files;
  }
}
