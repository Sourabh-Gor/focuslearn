import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-flashcard-preview',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule
  ],
  template: `
    <div class="flashcard-preview-container">
      <h2 mat-dialog-title style="color: antiquewhite;">✨ Flashcard ✨</h2>
      
      <mat-dialog-content>
        <div class="flashcard-container">
          <div class="flashcard" [class.flipped]="flipped">
            <div class="card-face front">
              <mat-card>
                <mat-card-content>
                  <p>{{ data.front_content }}</p>
                </mat-card-content>
              </mat-card>
            </div>
            <div class="card-face back">
              <mat-card>
                <mat-card-content>
                  <p>{{ data.back_content }}</p>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="center">
        <button mat-raised-button class="flip-button" (click)="flipCard()">
          <mat-icon>cached</mat-icon> FLIP
        </button>
        <button mat-raised-button class="regen-button" (click)="regenerateAnswer()">
          <mat-icon>refresh</mat-icon> REGENERATE
        </button>
        <button mat-raised-button class="continue-button" (click)="dialogRef.close()">
          CONTINUE
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    /* Background Fix - No More White */
    .flashcard-preview-container {
      padding: 20px;
      text-align: center;
      background: radial-gradient(circle,rgb(23, 24, 25), #414345); /* Dark modern bg */
      color: #fff;
      box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.5);
    }

    /* Flashcard Wrapper */
    .flashcard-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 260px;
      perspective: 1200px;
    }

    /* Flashcard */
    .flashcard {
      position: relative;
      width: 550px;
      height: 260px;
      transform-style: preserve-3d;
      transition: transform 0.6s ease-in-out;
    }

    /* Flip Effect */
    .flashcard.flipped {
      transform: rotateY(180deg);
    }

    /* Card Faces */
    .flashcard .card-face {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.3);
      transition: transform 0.6s ease-in-out, box-shadow 0.3s ease-in-out;
    }

    /* Front Card */
    .flashcard .front {
      background: linear-gradient(135deg,rgb(70, 169, 255),rgb(13, 48, 78));
      transform: rotateY(0deg);
    }

    /* Back Card */
    .flashcard .back {
      background: linear-gradient(135deg,rgb(188, 23, 4),rgb(87, 26, 26));
      transform: rotateY(180deg);
    }

    /* Mat Card */
    mat-card {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 24px;
      border-radius: 12px;
      color: #000;
      font-size: 1.2rem;
      font-weight: 500;
    }

    /* Buttons */
    .flip-button {
      background: linear-gradient(45deg, #00c6ff, #0072ff);
      color: #fff;
      border-radius: 8px;
      transition: all 0.3s ease-in-out;
    }

    .regen-button {
      background: linear-gradient(45deg, #ff6a00, #ee0979);
      color: #fff;
      border-radius: 8px;
      transition: all 0.3s ease-in-out;
    }

    .continue-button {
      background: linear-gradient(45deg, #4CAF50, #2E7D32);
      color: #fff;
      border-radius: 8px;
      transition: all 0.3s ease-in-out;
    }

    /* Button Hover Effects */
    button:hover {
      transform: scale(1.05);
      box-shadow: 0px 4px 15px rgba(255, 255, 255, 0.3);
    }

    /* Button Animations */
    .flip-button, .regen-button, .continue-button {
      animation: fadeIn 0.5s ease-in-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Flip Animation */
    .flashcard {
      animation: flipIn 0.7s ease-in-out;
    }

    @keyframes flipIn {
      from { transform: rotateY(-10deg); opacity: 0; }
      to { transform: rotateY(0deg); opacity: 1; }
    }
  `]
})
export class FlashcardPreviewComponent {
  flipped = false;
  
  constructor(
    public dialogRef: MatDialogRef<FlashcardPreviewComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  flipCard() {
    this.flipped = !this.flipped;
  }
  
  regenerateAnswer() {
    this.http.post(`${environment.apiBaseUrl}/api/flashcards/regenerate/${this.data.id}`, {}, {
      withCredentials: true
    }).subscribe({
      next: (response: any) => {
        if (response.flashcard) {
          this.data.back_content = response.flashcard.back_content;
          this.snackBar.open('Answer regenerated successfully', 'Close', { 
            duration: 3000, 
            panelClass: ['success-snackbar']
          });
        }
      },
      error: () => {
        this.snackBar.open('Failed to regenerate answer', 'Close', { 
          duration: 3000, 
          panelClass: ['error-snackbar']
        });
      }
    });
  }
}
