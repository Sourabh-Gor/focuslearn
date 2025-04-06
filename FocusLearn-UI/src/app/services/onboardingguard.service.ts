// src/app/services/onboarding.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, CanDeactivate, Router } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Observable } from 'rxjs';
import { OnboardingComponent } from '../pages/onboarding/onboarding.component';

@Injectable({
    providedIn: 'root'
})
export class OnboardingGuard implements CanActivate, CanDeactivate<OnboardingComponent> {
    constructor(private authService: AuthService, private router: Router) {}

    canActivate(): boolean {
        const user = this.authService.getUser();
        if (user && !user.onboarding_completed) {
            this.router.navigate(['/onboarding']);
            return false;
        }
        return true;
    }

    canDeactivate(component: OnboardingComponent): boolean {
        const user = this.authService.getUser();
        if (user && !user.onboarding_completed) {
            return confirm('You haven’t completed onboarding. Are you sure you want to leave?');
        }
        return true;
    }
}