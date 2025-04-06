//layout.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { LoaderService } from '../../services/loader.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, NavbarComponent, LoaderComponent],
  template: `
    <app-sidebar [isExpanded]="isSidebarExpanded" (toggleSidebar)="onToggleSidebar($event)"></app-sidebar>
    <div class="main-content" [ngClass]="{'sidebar-expanded': isSidebarExpanded, 'sidebar-collapsed': !isSidebarExpanded}">
      <app-navbar [isSidebarExpanded]="isSidebarExpanded" (toggleSidebarEvent)="toggleSidebar()"></app-navbar>
      <div class="page-content">
        <router-outlet></router-outlet>
      </div>
    </div>
    <app-loader [isLoading]="isLoading" [message]="loaderMessage"></app-loader>
  `,
  styles: [`
    :host {
      display: flex;
      height: 100vh;
      position: relative;
    }
    
    .main-content {
      flex: 1;
      transition: margin-left 0.3s ease-in-out;
      position: relative;
      z-index: 1;
    }
    
    .sidebar-expanded {
      margin-left: 250px;
    }
    
    .sidebar-collapsed {
      margin-left: 70px;
    }
    
    .page-content {
      padding: 24px;
      margin-top: 64px;
      height: calc(100vh - 64px);
      overflow-y: auto;
    }
  `]
})
export class LayoutComponent implements OnInit {
  isSidebarExpanded = true;
  isLoading = false;
  loaderMessage = '';
  
  constructor(private loaderService: LoaderService) {
    this.loaderService.loading$.subscribe(loading => {
      this.isLoading = loading;
    });
    
    this.loaderService.message$.subscribe(message => {
      this.loaderMessage = message;
    });
  }

  ngOnInit() {
    // Check for saved sidebar state in localStorage
    const savedState = localStorage.getItem('sidebarState');
    if (savedState) {
      this.isSidebarExpanded = savedState === 'expanded';
    }
  }
  
  onToggleSidebar(expanded: boolean) {
    this.isSidebarExpanded = expanded;
    localStorage.setItem('sidebarState', expanded ? 'expanded' : 'collapsed');
  }
  
  toggleSidebar() {
    this.isSidebarExpanded = !this.isSidebarExpanded;
    localStorage.setItem('sidebarState', this.isSidebarExpanded ? 'expanded' : 'collapsed');
  }
}