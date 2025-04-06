import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { trigger, state, style, transition, animate } from '@angular/animations';

interface SidebarModule {
  id: string;
  name: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  animations: [
    trigger('sidebarState', [
      state('expanded', style({
        width: '250px'
      })),
      state('collapsed', style({
        width: '70px'
      })),
      transition('expanded <=> collapsed', [
        animate('0.3s ease-in-out')
      ])
    ]),
    trigger('fadeInOut', [
      state('visible', style({
        opacity: 1
      })),
      state('hidden', style({
        opacity: 0,
        display: 'none'
      })),
      transition('visible <=> hidden', [
        animate('0.2s ease-in-out')
      ])
    ])
  ]
})
export class SidebarComponent {
  @Input() isExpanded = true;
  @Output() toggleSidebar = new EventEmitter<boolean>();
  
  // Dynamic modules array - easily add or remove modules here
  modules: SidebarModule[] = [
    { id: 'dashboard', name: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { id: 'materials', name: 'Materials', icon: 'menu_book', route: '/materials' },
    // { id: 'sessions', name: 'Study Sessions', icon: 'timer', route: '/sessions' },
    { id: 'flashcards', name: 'Flashcards', icon: 'style', route: '/flashcards' },
    { id: 'quizzes', name: 'Quizzes', icon: 'quiz', route: '/quizzes' },
    { id: 'pdf-to-podcast', name: 'PDF to Podcast', icon: 'podcasts', route: '/pdf-to-podcast' },
    // { id: 'study-planner', name: 'Study Planner', icon: 'calendar_today', route: '/study-planner' },
    // { id: 'debate', name: 'Debate', icon: 'record_voice_over', route: '/debate' },
    // { id: 'badges', name: 'Badges', icon: 'stars', route: '/badges' },
    // { id: 'leaderboard', name: 'Leaderboard', icon: 'leaderboard', route: '/leaderboard' },
    // { id: 'settings', name: 'Settings', icon: 'settings', route: '/settings' }
];

  toggle() {
    this.isExpanded = !this.isExpanded;
    this.toggleSidebar.emit(this.isExpanded);
  }
}