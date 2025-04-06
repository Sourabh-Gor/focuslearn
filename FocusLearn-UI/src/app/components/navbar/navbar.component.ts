import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

interface Notification {
  id: number;
  message: string;
  time: string;
  read: boolean;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  @Input() isSidebarExpanded = true;
  @Output() toggleSidebarEvent = new EventEmitter<void>();
  
  userName = 'User Name';
  userEmail = 'user@example.com';
  currentPageTitle = 'Dashboard';
  
  // Sample notifications
  notifications: Notification[] = [
    { 
      id: 1, 
      message: 'Your study session is about to start in 5 minutes',
      time: '2 minutes ago',
      read: false
    },
    { 
      id: 2, 
      message: 'Quiz: Mathematics is now available',
      time: '1 hour ago',
      read: false
    }
  ];
  
  get notificationCount(): number {
    return this.notifications.filter(notification => !notification.read).length;
  }
  
  constructor(private router: Router, private http: HttpClient, private authService: AuthService) {
    // Subscribe to route changes to update page title
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Get current route path and convert to page title
      const url = this.router.url.split('/').pop() || 'dashboard';
      this.currentPageTitle = this.formatPageTitle(url);
    });
  }

  ngOnInit() {
    const user = this.authService.getUser();
    if (user) {
      this.userName = user.name || "Student"; ;
      this.userEmail = user.email;
    }
}
  
formatPageTitle(url: string): string {
  // Step 1: Decode URL-encoded characters (e.g., %20 -> space)
  let decodedString = decodeURIComponent(url);

  // Step 2: Remove file extensions (e.g., .pdf, .docx) and any trailing numbers in parentheses (e.g., (1))
  decodedString = decodedString.replace(/\.(pdf|docx|txt)(\s*\(\d+\))?$/i, '');

  // Step 3: Split by either hyphens or spaces and filter out empty segments
  const words = decodedString
    .split(/[- ]+/)
    .filter(word => word.length > 0);

  // Step 4: Capitalize each word and join with spaces
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
  
  toggleSidebar() {
    this.toggleSidebarEvent.emit();
  }
  
  markAllAsRead() {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
  }
  
  markAsRead(notification: Notification) {
    notification.read = true;
  }
  
  deleteNotification(id: number) {
    this.notifications = this.notifications.filter(notification => notification.id !== id);
  }
  
  logout() {
    // Implement logout logic here
     this.http.get(`${environment.apiBaseUrl}/api/auth/logout`, { withCredentials: true }).subscribe(
          (user: any) => {
            console.log('Already logged out:', user);
            this.router.navigate(['/login']);
          },
          (error) => {
            console.log('Not logged out:', error);
          }
        );
    
  }
}