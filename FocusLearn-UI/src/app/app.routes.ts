// src/app/app.routes.ts (or src/app/routes.ts, depending on your naming)
import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AuthGuard } from './services/authguard.service';
import { LayoutComponent } from './components/layout/layout.component';
import { OnboardingComponent } from './pages/onboarding/onboarding.component';
import { OnboardingGuard } from './services/onboardingguard.service';
import { MaterialsComponent } from './pages/materials/materials.component';
import { MaterialViewComponent } from './pages/materials/material-view/material-view.component';
import { FlashcardComponent } from './pages/flashcard/flashcard.component';
import { PdfPodcastComponent } from './pages/pdf-podcast/pdf-podcast.component';

export const routes: Routes = [
    { path: '', component: LandingComponent },
    { path: 'login', component: LoginComponent },
    { path: 'onboarding', component: OnboardingComponent, canDeactivate: [OnboardingGuard] }, // Full-screen onboarding
    {
        path: '',
        component: LayoutComponent,
        canActivate: [AuthGuard, OnboardingGuard], // Protect all child routes and enforce onboarding
        children: [
            { path: 'dashboard', component: DashboardComponent },
            { path: 'materials', component: MaterialsComponent },
            { path: 'material-view/:id/:fileName', component: MaterialViewComponent },
            { path: 'flashcards', component: FlashcardComponent },
            { path: 'pdf-to-podcast', component: PdfPodcastComponent },
            { path: '**', redirectTo: 'dashboard' }
        ]
    },
    { path: '**', redirectTo: '' }
];