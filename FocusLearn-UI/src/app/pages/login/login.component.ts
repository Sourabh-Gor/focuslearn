import { AfterViewInit, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { RouterModule } from '@angular/router';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    RouterModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})

export class LoginComponent implements AfterViewInit, OnInit {
  constructor(private http: HttpClient, private router: Router) {}

  ngAfterViewInit() {
    console.log(environment.apiBaseUrl);
    setTimeout(() => {
      this.slides = [
        { image: 'assets/slide1.png', caption: 'Slide 1' },
        { image: 'assets/slide2.png', caption: 'Slide 2' },
        { image: 'assets/slide3.png', caption: 'Slide 3' }
      ];
    }, 100);
  }
  ngOnInit(): void {
    this.checkAuth();
  }

  checkAuth() {
    this.http.get(`${environment.apiBaseUrl}/api/user/auth`, { withCredentials: true }).subscribe(
      (user: any) => {
        console.log('Already logged in:', user);
        this.router.navigate(['/dashboard']); // Redirect to dashboard
      },
      (error) => {
        console.log('Not logged in:', error);
      }
    );
  }

  email = '';
  password = '';
  hidePassword = true;
  
  onLogin() {
    console.log('Logging in with:', this.email, this.password);
    this.http
      .post<{ message: string; token: string }>(`${environment.apiBaseUrl}/api/auth/login`, {
        email: this.email,
        password: this.password,
      })
      .subscribe(
        (response) => {
          console.log(response.message);
          localStorage.setItem('token', response.token);
          this.router.navigate(['/dashboard']); // Redirect on success
        },
        (error) => {
          console.error('Login failed:', error.error.message);
        }
      );
  }

  onGoogleLogin() {
    console.log('Google Sign-In clicked');
    window.location.href = `${environment.apiBaseUrl}/api/auth/google`; // Redirect to Google OAuth
  }
  slides = [
    { image: 'assets/feature1.png', caption: 'AI-powered learning' },
    { image: 'assets/feature2.png', caption: 'Personalized Study Plans' },
    { image: 'assets/feature3.jpg', caption: 'Gamified Learning Experience' }
  ];

  slideConfig = {
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2000,
    dots: true,
    infinite: true
  };

}
