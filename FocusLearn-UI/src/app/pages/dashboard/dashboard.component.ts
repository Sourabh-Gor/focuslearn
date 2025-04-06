import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { init3DModel } from './init3dmodel'; // New 3D model script

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  user: any = null;
  welcomeMessage: string = '';

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.user = this.authService.getUser();
    this.setDynamicWelcomeMessage();
  }

  ngAfterViewInit() {
    const modelContainer = document.getElementById('3d-model');
    if (modelContainer) init3DModel(modelContainer);
  }

  setDynamicWelcomeMessage() {
    const messages = [
      `Let’s unlock your potential today, ${this.user?.name}!`,
      `Every step forward counts, ${this.user?.name}—keep shining!`,
      `Your learning journey awaits, ${this.user?.name}!`,
    ];
    this.welcomeMessage = messages[Math.floor(Math.random() * messages.length)];
  }
}