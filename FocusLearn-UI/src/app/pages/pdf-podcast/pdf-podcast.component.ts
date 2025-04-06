import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MatSnackBar } from '@angular/material/snack-bar';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { LoaderService } from '../../services/loader.service';

@Component({
  selector: 'app-pdf-podcast',
  templateUrl: './pdf-podcast.component.html',
  styleUrls: ['./pdf-podcast.component.scss'],
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatCardModule,
  ],
  standalone: true,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.95)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1)' })),
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'scale(0.95)' })),
      ]),
    ]),
  ],
})
export class PdfPodcastComponent implements OnInit {
  materials: any[] = [];
  selectedMaterialId: string = '';
  loading = false;
  audioSrc: string | null = null;

  constructor(private http: HttpClient, private snackBar: MatSnackBar, private loaderService: LoaderService) {}

  ngOnInit(): void {
    this.loadMaterials();
  }

  loadMaterials() {
    this.http.get<any>(`${environment.apiBaseUrl}/api/materials`, {
      withCredentials: true,
    }).subscribe({
      next: (response) => {
        if (response.materials) this.materials = response.materials;
      },
      error: (error) => {
        console.error('Failed to load materials:', error);
        this.snackBar.open('Failed to load materials', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar'],
        });
      },
    });
  }

  generatePodcast() {
    this.loaderService.show("Generating Podcast..."); // Show loader when generating podcast
    if (!this.selectedMaterialId) return;

    this.loading = true;
    this.audioSrc = null;

    this.http.post(`${environment.apiBaseUrl}/api/materials/generate-podcast/${this.selectedMaterialId}`, {}, {
      responseType: 'text', withCredentials: true,
    }).subscribe({
      next: (base64Audio) => {
        this.audioSrc = `data:audio/mp3;base64,${base64Audio}`;
        this.loading = false;
        this.loaderService.hide(); // Hide loader after podcast generation
        this.snackBar.open('Podcast generated successfully', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar'],
        });
      },
      error: (error) => {
        console.error('Podcast generation failed:', error);
        this.snackBar.open('Podcast generation failed', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar'],
        });
        this.loading = false;
        this.loaderService.hide(); // Hide loader if generation fails
      },
    });
  }
}
