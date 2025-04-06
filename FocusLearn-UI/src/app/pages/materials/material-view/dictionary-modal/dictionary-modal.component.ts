
// dictionary-modal.component.ts
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl } from '@angular/forms';
import { DictionaryService } from '../../../../services/dictionary.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import {MatChipsModule} from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-dictionary-modal',
  imports: [
    MatChipsModule,
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatDividerModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatCardModule
  ],
  standalone: true,
  templateUrl: './dictionary-modal.component.html',
  styleUrls: ['./dictionary-modal.component.scss']
})
export class DictionaryModalComponent implements OnInit {
  searchControl = new FormControl('');
  searchResults: any[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  audio: HTMLAudioElement | null = null;

  constructor(
    public dialogRef: MatDialogRef<DictionaryModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { initialWord?: string },
    private dictionaryService: DictionaryService
  ) { }

  ngOnInit(): void {
    if (this.data?.initialWord) {
      this.searchControl.setValue(this.data.initialWord);
      this.performLookup(this.data.initialWord);
    }

    this.searchControl.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term || term.trim() === '') {
          this.searchResults = [];
          this.errorMessage = null;
          return of([]);
        }
        this.isLoading = true;
        this.errorMessage = null;
        return this.dictionaryService.lookupWord(term).pipe(
          catchError(error => {
            this.isLoading = false;
            if (error.status === 404) {
              this.errorMessage = `No definitions found for "${term}"`;
            } else {
              this.errorMessage = 'An error occurred while fetching data';
            }
            return of([]);
          })
        );
      })
    ).subscribe(data => {
      this.isLoading = false;
      this.searchResults = data;
    });
  }

  performLookup(word: string): void {
    if (!word || word.trim() === '') return;
    
    this.isLoading = true;
    this.errorMessage = null;
    
    this.dictionaryService.lookupWord(word).pipe(
      catchError(error => {
        this.isLoading = false;
        this.searchResults = [];
        if (error.status === 404) {
          this.errorMessage = `No definitions found for "${word}"`;
        } else {
          this.errorMessage = 'An error occurred while fetching data';
        }
        return of([]);
      })
    ).subscribe((data: any) => {
      this.isLoading = false;
      this.searchResults = data;
    });
  }

  lookupWord(word: string): void {
    this.performLookup(word);
  }

  playAudio(audioUrl: string): void {
    if (this.audio) {
      this.audio.pause();
    }
    this.audio = new Audio(audioUrl);
    this.audio.play();
  }

  onClose(): void {
    if (this.audio) {
      this.audio.pause();
    }
    this.dialogRef.close();
  }
}