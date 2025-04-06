// loader.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loader-container" *ngIf="isLoading">
      <div class="loader-overlay"></div>
      <div class="loader-content">
        <video autoplay loop muted class="loader-video">
          <source src="assets/loader-canva.mp4" type="video/mp4">
          Your browser does not support the video tag.
        </video>
        <!-- <img src="assets/loading-unscreen.gif" alt="Loading animation"> -->
        <div class="loader-text" *ngIf="message">{{ message }}</div>
      </div>
    </div>
  `,
  styles: [`
    .loader-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    
    .loader-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
    }
    
    .loader-content {
      position: relative;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    .loader-video {
      max-width: 300px;
      max-height: 300px;
    }
    
    .loader-text {
      margin-top: 16px;
      color: white;
      font-size: 18px;
      font-weight: 500;
      text-align: center;
    }
  `]
})
export class LoaderComponent {
  @Input() isLoading: boolean = false;
  @Input() message: string = '';
}