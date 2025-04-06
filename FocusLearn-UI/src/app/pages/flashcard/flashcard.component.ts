import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { LoaderService } from '../../services/loader.service';
import { MatDividerModule } from '@angular/material/divider';

interface Flashcard {
  id: number;
  front_content: string;
  back_content: string;
  material_id: number;
  page_number: number;
  created_at: string;
  updated_at: string;
}

interface Material {
  id: number;
  file_name: string;
}

@Component({
  selector: 'app-flashcard-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  templateUrl: './flashcard.component.html',
  styleUrl: './flashcard.component.scss'
})
export class FlashcardComponent implements OnInit {
  flashcards: Flashcard[] = [];
  materials: Material[] = [];
  selectedMaterialId: number = 0; // 0 means "All Materials"
  flippedCards: { [key: number]: boolean } = {};

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private loaderService: LoaderService
  ) {}

  ngOnInit(): void {
    this.loadMaterials();
    this.loadFlashcards();
  }

  loadMaterials() {
    this.http.get<any>(`${environment.apiBaseUrl}/api/materials`, {
      withCredentials: true
    }).subscribe({
      next: (response) => {
        if (response.materials) {
          this.materials = response.materials;
        }
      },
      error: (error) => {
        console.error('Failed to load materials:', error);
        this.snackBar.open('Failed to load materials', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  loadFlashcards() {
    this.loaderService.show('Loading flashcards...');
    
    let url = `${environment.apiBaseUrl}/api/flashcards`;
    if (this.selectedMaterialId > 0) {
      url = `${environment.apiBaseUrl}/api/flashcards/material/${this.selectedMaterialId}`;
    }
    
    this.http.get<any>(url, {
      withCredentials: true
    }).subscribe({
      next: (response) => {
        this.flashcards = response.flashcards || [];
        // Initialize all cards to be front-facing
        this.flashcards.forEach(card => {
          this.flippedCards[card.id] = false;
        });
        this.loaderService.hide();
      },
      error: (error) => {
        console.error('Failed to load flashcards:', error);
        this.snackBar.open('Failed to load flashcards', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.loaderService.hide();
      }
    });
  }

  filterFlashcards() {
    this.loadFlashcards();
  }

  flipCard(id: number) {
    this.flippedCards[id] = !this.flippedCards[id];
  }

  regenerateAnswer(flashcard: Flashcard) {
    this.loaderService.show('Regenerating answer...');
    
    this.http.post<any>(`${environment.apiBaseUrl}/api/flashcards/regenerate/${flashcard.id}`, {}, {
      withCredentials: true
    }).subscribe({
      next: (response) => {
        if (response.flashcard) {
          const index = this.flashcards.findIndex(card => card.id === flashcard.id);
          if (index !== -1) {
            this.flashcards[index].back_content = response.flashcard.back_content;
            // Flip to back side to show the new answer
            this.flippedCards[flashcard.id] = true;
          }
          this.loaderService.hide();
          this.snackBar.open('Answer regenerated successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
        }
      },
      error: (error) => {
        console.error('Failed to regenerate answer:', error);
        this.loaderService.hide();
        this.snackBar.open('Failed to regenerate answer', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  deleteFlashcard(id: number) {
    if (confirm('Are you sure you want to delete this flashcard?')) {
      this.loaderService.show('Deleting flashcard...');
      
      this.http.delete<any>(`${environment.apiBaseUrl}/api/flashcards/${id}`, {
        withCredentials: true
      }).subscribe({
        next: () => {
          this.flashcards = this.flashcards.filter(card => card.id !== id);
          this.loaderService.hide();
          this.snackBar.open('Flashcard deleted successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
        },
        error: (error) => {
          console.error('Failed to delete flashcard:', error);
          this.loaderService.hide();
          this.snackBar.open('Failed to delete flashcard', 'Close', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }

  formatBackContent(back_content: string): string {
    let formatted = back_content.trim();  
  
    // Remove "**SomeKey:**" pattern at the beginning
    formatted = formatted.replace(/^(\*\*[^:]+:\*\*)\s*/, "");
  
    // Remove all newline characters
    formatted = formatted.replace(/\n/g, "");
  
    // Remove all occurrences of '*'
    formatted = formatted.replace(/\*/g, "");
  
    return formatted;
  }
  

  isLoading(): boolean {
    return this.loaderService.isLoading();
  }
}