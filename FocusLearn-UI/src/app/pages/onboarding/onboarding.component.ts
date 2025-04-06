// src/app/pages/onboarding/onboarding.component.ts
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Router } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-onboarding',
    standalone: true,
    imports: [
        MatButtonModule,        // For mat-button and mat-raised-button
        MatFormFieldModule,     // For mat-form-field
        MatInputModule,         // For matInput
        FormsModule,             // For [(ngModel)]
        CommonModule            // For *ngIf
    ],
    templateUrl: './onboarding.component.html',
    styleUrls: ['./onboarding.component.scss'],
    animations: [
        trigger('fadeIn', [
            transition(':enter', [
                style({ opacity: 0 }),
                animate('500ms ease-in', style({ opacity: 1 }))
            ])
        ]),
        trigger('slideIn', [
            transition(':enter', [
                style({ transform: 'translateY(50px)', opacity: 0 }),
                animate('700ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
            ])
        ])
    ]
})
export class OnboardingComponent implements OnInit {
    step = 1;
    initialAttentionSpan: number | null = null;
    preferredStudyTime: string | null = null;
    commonDistractions: string = '';
    suggestedSessionTime: number | null = null;

    constructor(private authService: AuthService, private router: Router) {}

    ngOnInit() {
        const user = this.authService.getUser();
        if (user?.onboarding_completed) {
            this.router.navigate(['/dashboard']);
        }
    }

    selectAttentionSpan(minutes: number) {
        this.initialAttentionSpan = minutes;
        this.nextStep();
    }

    selectStudyPreference(preference: string) {
        this.preferredStudyTime = preference;
        this.calculateSessionTime();
        this.nextStep();
    }

    nextStep() {
        this.step++;
    }

    calculateSessionTime() {
        if (this.initialAttentionSpan && this.preferredStudyTime) {
            const baseTime = this.initialAttentionSpan;
            switch (this.preferredStudyTime) {
                case 'short': this.suggestedSessionTime = Math.min(baseTime, 20); break;
                case 'balanced': this.suggestedSessionTime = Math.min(baseTime + 5, 30); break;
                case 'long': this.suggestedSessionTime = Math.min(baseTime + 10, 50); break;
            }
        }
    }

    completeOnboarding() {
        if (this.initialAttentionSpan && this.preferredStudyTime) {
            this.authService.completeOnboarding(
                this.initialAttentionSpan,
                this.preferredStudyTime,
                this.commonDistractions || undefined,
                this.suggestedSessionTime || undefined
            ).subscribe({
                next: () => this.router.navigate(['/dashboard']),
                error: (err) => console.error('Onboarding failed:', err)
            });
        }
    }
}