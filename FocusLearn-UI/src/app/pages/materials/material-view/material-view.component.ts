import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { environment } from '../../../../environments/environment';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { NgxExtendedPdfViewerService } from 'ngx-extended-pdf-viewer';
import { LoaderService } from '../../../services/loader.service';
import { pdfDefaultOptions } from 'ngx-extended-pdf-viewer';
import { FlashcardPreviewComponent } from './flashcard-preview/flashcard-preview.component';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { DictionaryModalComponent } from './dictionary-modal/dictionary-modal.component';
import { CalculatorComponent } from './calculator/calculator.component';


@Component({
  selector: 'app-materials-view',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, NgxExtendedPdfViewerModule, MatIconModule, MatProgressSpinnerModule, MatButtonModule, MatFormFieldModule, MatSelectModule, FormsModule, MatSliderModule],
  templateUrl: './material-view.component.html',
  styleUrls: ['./material-view.component.scss'],
})
export class MaterialViewComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);
  private pdfService = inject(NgxExtendedPdfViewerService);
  private dialog = inject(MatDialog);

  materialId!: number;
  materials: any
  pdfUrl: string = '';
  selectedText: string = '';
  highlights: { text: string; color: string }[] = [];
  pdfFailed: boolean = false;
  generatedFlashcard: any = null;
  isSummaryVisible = false;
  summary: string = '';
  isReading = false;
  speechSynthesis: SpeechSynthesisUtterance | null = null;
  audio = new Audio(); // For Google Cloud TTS audio playback
  highlightedText: string = '';
  originalText: string = '';
  currentWordIndex: number = 0;
  wordSpans: string[] = [];
  chunkSize = 30; // words per chunk
  currentChunkIndex = 0;
  chunks: string[] = [];
  availableVoices: SpeechSynthesisVoice[] | null = null;
  selectedVoice: SpeechSynthesisVoice | null = null;
  speechRate: number = 1; // Default speech rate
  isToolbarExpanded: any;


  constructor(private loaderService: LoaderService) {
    pdfDefaultOptions.cursorToolOnLoad = 0; // Set the default cursor tool to "Text Selection"
  }

  ngOnInit(): void {
    this.materialId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.materialId) {
      this.loadMaterial();
    }
    // Listen for text selection inside the PDF viewer
    document.addEventListener('mouseup', this.captureSelectedText.bind(this));
    document.addEventListener('keyup', this.captureSelectedText.bind(this)); // For keyboard selection

    window.speechSynthesis.onvoiceschanged = () => {
      this.availableVoices = window.speechSynthesis.getVoices();
      this.selectedVoice = this.availableVoices.find(v => v.default) || this.availableVoices[0];
    };

  }

  loadMaterial() {
    this.loaderService.show('Loading material...');  // Show loader
    this.http.get(`${environment.apiBaseUrl}/api/materials/material/${this.materialId}`, {
      withCredentials: true
    }).subscribe({
      next: (response: any) => {
        if (response.materials && response.materials.length > 0) {
          this.materials = response.materials[0];
          this.pdfUrl = `${response.materials[0].firebase_url}?t=${new Date().getTime()}`;
        } else {
          this.loaderService.hide();  // Hide loader on failure
          this.snackBar.open('Material not found', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
        }
      },
      error: () => {
        this.loaderService.hide();  // Hide loader on failure
        this.snackBar.open('Failed to load material', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      }
    });
  }

  onPdfLoaded() {
    console.log('PDF loaded successfully');
    this.loaderService.hide();  // Hide loader when PDF is fully loaded
  }

  onError(event: any) {
    this.pdfFailed = true
    console.error('Error loading PDF:', event);
    if (event !== true) {
      this.snackBar.open('Failed to load PDF', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      this.loaderService.hide(); // Hide loader on PDF error
    }
  }

  onTextSelected(event: any) {
    console.log('Text selected:', event);
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      this.selectedText = selection.toString();
    }
  }

  isLoading(): boolean {
    return this.loaderService.isLoading(); // Check if loader is active
  }

  async savePdf() {
    this.loaderService.show('Saving PDF...');
    const pdfBlob = await this.pdfService.getCurrentDocumentAsBlob();
    if (!pdfBlob) {
      this.loaderService.hide();
      this.snackBar.open('Failed to export PDF', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      return;
    }
    const fileName = `${this.materials.file_name}.pdf`;
    const formData = new FormData();
    formData.append('file', pdfBlob, fileName);
    this.http.put(`${environment.apiBaseUrl}/api/materials/update/${this.materialId}`, formData, {
      withCredentials: true
    }).subscribe({
      next: (response: any) => {
        if (response.material && response.material.firebase_url) {
          this.pdfUrl = `${response.material.firebase_url}?t=${new Date().getTime()}`;
        } else {
          this.loaderService.hide();
          this.snackBar.open('PDF Saved Successfully', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
        }
      },
      error: () => {
        this.loaderService.hide();
        this.snackBar.open('Failed to Save PDF', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      }
    });
  }

  generateFlashcard() {
    if (!this.selectedText.trim()) {
      this.snackBar.open('Please select some text first', 'Close', { duration: 3000 });
      return;
    }

    const pageNumber = this.pdfService.getCurrentlyVisiblePageNumbers()[0]; // Get the current PDF page
    const contextText = this.getContextText(); // Get the surrounding context text

    this.loaderService.show('Generating flashcard...');
    this.http.post(`${environment.apiBaseUrl}/api/flashcards`, {
      materialId: this.materialId,
      selectedText: this.selectedText,
      pageNumber: pageNumber,
      contextText: contextText
    }, { withCredentials: true }).subscribe({
      next: (response: any) => {
        this.loaderService.hide();
        this.snackBar.open('Flashcard Created!', 'Close', { duration: 3000, panelClass: ['success-snackbar'] });
        console.log('Flashcard:', response.flashcard);
        response.flashcard.back_content = this.formatBackContent(response.flashcard.back_content); // Format back content
        this.dialog.open(FlashcardPreviewComponent, {
          width: '800px',
          data: response.flashcard
        });

        this.selectedText = '';
      },
      error: (error) => {
        this.loaderService.hide();
        this.snackBar.open('Failed to generate flashcard', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
        console.error('Flashcard creation error:', error);
      }
    });
  }

  captureSelectedText() {
    const selection = window.getSelection() || "";
    this.selectedText = selection.toString().trim() || "";
    console.log('Text Selected:', this.selectedText);
  }

  formatBackContent(back_content: string) {
    // Remove leading/trailing whitespace
    let formatted = back_content.trim();

    // Remove any unnecessary prefixes
    formatted = formatted.replace(/^(\*\*[^:]+:\*\*)\s*/, "");

    // Replace new lines with `<br>` for HTML formatting
    formatted = formatted.replace(/\n/g, "");

    return formatted;
  }


  getContextText(): string {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return '';
    }

    const range = selection.getRangeAt(0);
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    if (!startContainer.textContent || !endContainer.textContent) {
      return '';
    }

    const textBefore = startContainer.textContent.substring(0, startOffset).trim();
    const textAfter = endContainer.textContent.substring(endOffset).trim();

    const fullContext = this.extractFullContext(textBefore, selection.toString(), textAfter);
    return fullContext.trim();
  }

  extractFullContext(before: string, selected: string, after: string): string {

    // Extract the last full sentence from "before" (ensuring it does not cut off)
    let beforeSentenceMatch = before.match(/[^.!?]*[.!?]/g);
    let beforeSentence = beforeSentenceMatch ? beforeSentenceMatch.pop() : before;

    // Extract the first full sentence from "after"
    let afterSentenceMatch = after.match(/[^.!?]*[.!?]/);
    let afterSentence = afterSentenceMatch ? afterSentenceMatch[0] : after;

    return `${beforeSentence || ''} ${selected} ${afterSentence || ''}`.trim();
  }

  generateSummary() {
    this.loaderService.show('Generating summary...');

    this.http.post(`${environment.apiBaseUrl}/api/materials/generate-summary/${this.materialId}`, {}, { withCredentials: true }).subscribe({
      next: (response: any) => {
        this.summary = response.summary;
        this.isSummaryVisible = true; // Show side card
        this.loaderService.hide();
      },
      error: () => {
        this.loaderService.hide();
        this.snackBar.open('Failed to generate summary', 'Close', { duration: 3000, panelClass: ['error-snackbar'] });
      }
    });
  }

  closeSummary() {
    this.isSummaryVisible = false;
  }

  toggleReadAloud() {
    if (this.isReading) {
      this.stopReadAloud();
    } else {
      this.startReadAloud();
    }
  }

  cachedText = '';

  async extractTextFromAllPages(): Promise<string> {
    if (this.cachedText) return this.cachedText;

    const numPages = this.pdfService.numberOfPages();
    const textPromises = [];
    for (let i = 1; i <= numPages; i++) {
      textPromises.push(this.pdfService.getPageAsText(i));
    }

    const pageTexts = await Promise.all(textPromises);
    this.cachedText = pageTexts.filter(Boolean).join(' ');
    return this.cachedText;
  }

  async startReadAloud() {
    this.originalText = await this.extractTextFromAllPages(); // Using updated function
    this.currentWordIndex = 0; // Reset current word index
    if (!this.originalText.trim()) {
      this.snackBar.open('No text found in the PDF!', 'Close', { duration: 3000 });
      return;
    }

    this.wordSpans = this.originalText.split(/\s+/);
    this.isReading = true;
    this.speechSynthesis = new SpeechSynthesisUtterance(this.originalText);
    this.speechSynthesis.lang = 'en-US';
    this.speechSynthesis.voice = this.selectedVoice;
    this.speechSynthesis.rate = this.speechRate;
    this.speechSynthesis.onend = () => {
      this.isReading = false;
      this.highlightedText = '';
    };

    window.speechSynthesis.speak(this.speechSynthesis);
  }

  stopReadAloud() {
    this.isReading = false;
    this.audio.pause();
    this.audio.currentTime = 0;
    window.speechSynthesis.cancel();
  }

  toggleCustomToolbar() {
    this.isToolbarExpanded = !this.isToolbarExpanded;
  }

  openDictionary(): void {
    const selectedText = this.selectedText?.trim();
    
    this.dialog.open(DictionaryModalComponent, {
      width: '600px',
      data: { initialWord: selectedText || '' }
    });
  }

  openCalculator(): void {    
    this.dialog.open(CalculatorComponent, {
      width: '600px',
    });
  }

}

