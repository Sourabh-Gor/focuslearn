import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-landing',
  standalone: true, // ✅ Ensure this is a standalone component
  imports: [CommonModule, MatIconModule, MatButtonModule, MatToolbarModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  constructor(private http: HttpClient, private router: Router) {}

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
 }
