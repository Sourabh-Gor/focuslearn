import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
    constructor(private authService: AuthService, private router: Router) {}
    title = 'FocusLearn-UI';

    ngOnInit(): void {
        this.authService.checkAuthentication().subscribe({
            next: (response) => {
                if (response.isAuthenticated) {
                    if (this.authService.isFirstTimeUser()) {
                        this.router.navigate(['/onboarding']);
                    } else {
                        // If already redirected to /dashboard by backend, no need to navigate again
                        // Otherwise, you could redirect to /dashboard here
                    }
                } else {
                    this.router.navigate(['/']);
                }
            },
            error: () => {
                this.router.navigate(['/']);
            }
        });
    }
}