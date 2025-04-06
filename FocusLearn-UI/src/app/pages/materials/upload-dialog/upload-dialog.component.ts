// upload-dialog/upload-dialog.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { LoaderService } from '../../../services/loader.service';

@Component({
  selector: 'app-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './upload-dialog.component.html',
  styleUrls: ['./upload-dialog.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class UploadDialogComponent {
  files: File[] = [];
  isDragging = false;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<UploadDialogComponent>,
    private loaderService: LoaderService,
  ) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles) {
      this.handleFiles(droppedFiles);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
  if (input.files) {
    const maxSize = 20 * 1024 * 1024; // 20MB in bytes
    const files = Array.from(input.files);

    const validFiles = files.filter(file => file.size <= maxSize);
    const invalidFiles = files.filter(file => file.size > maxSize);

    if (invalidFiles.length > 0) {
      alert("Some files exceed 20MB and were not selected.");
    } else {
      this.handleFiles(input.files);
      input.value = ''; // Reset input to allow re-uploading same file
    }
    console.log("Valid files:", validFiles);
  }
}

  private handleFiles(fileList: FileList) {
    const allowedTypes = ['application/pdf'];
    
    Array.from(fileList).forEach(file => {
      if (allowedTypes.includes(file.type)) {
        this.files.push(file);
        this.uploadFile(file);
      } else {
        this.snackBar.open('Only PDF files are allowed', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    // Show custom loader
    this.loaderService.show('Uploading file...');

    this.http.post(`${environment.apiBaseUrl}/api/materials/upload`, formData, {
      withCredentials: true
    }).subscribe({
      next: (response: any) => {
        this.files = this.files.filter(f => f !== file);
        this.loaderService.hide();
        this.snackBar.open('File uploaded successfully', 'Close', {
          duration: 2000,
          panelClass: ['success-snackbar']
        });
        this.dialogRef.close(response.material); // Pass the new material back
      },
      error: (error) => {
        console.error('Upload failed:', error);
        this.snackBar.open('Upload failed: ' + error.message, 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.loaderService.hide();
        this.files = this.files.filter(f => f !== file);
      }
    });
  }
}