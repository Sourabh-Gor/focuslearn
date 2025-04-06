import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, switchMap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment'; // Adjust path as needed

interface User {
    id: string;
    email: string;
    name?: string;
    google_id?: string;
    created_at?: string;
    last_login?: string;
    onboarding_completed?: boolean;
    preferences?: {
        initial_attention_span?: number;
        preferred_study_time?: string;
        common_distractions?: string;
        avg_study_duration?: number;
    };
}

interface AuthResponse {
    isAuthenticated: boolean;
    user?: { id: string; email: string }; // Minimal user info from /check-auth
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private checkAuthUrl = `${environment.apiBaseUrl}/api/auth/check-auth`;
    private meUrl = `${environment.apiBaseUrl}/api/auth/me`;
    private logoutUrl = `${environment.apiBaseUrl}/logout`;
    private userSubject = new BehaviorSubject<User | null>(null);
    private firstTimeLoginSubject = new BehaviorSubject<boolean>(false);
    user$ = this.userSubject.asObservable();
    firstTimeLogin$ = this.firstTimeLoginSubject.asObservable();

    constructor(private http: HttpClient) {}

    checkAuthentication(): Observable<AuthResponse> {
      return this.http.get<AuthResponse>(this.checkAuthUrl, { withCredentials: true }).pipe(
          switchMap((response: AuthResponse): Observable<AuthResponse> => {
              if (response.isAuthenticated && response.user) {
                  return this.http.get<User>(this.meUrl, { withCredentials: true }).pipe(
                      tap((user: User) => {
                          this.userSubject.next(user);
                          this.firstTimeLoginSubject.next(!user.onboarding_completed);
                      }),
                      map(() => response), // Explicitly map to AuthResponse
                      catchError(() => {
                          // Safely handle the case where response.user might be undefined
                          const fallbackUser = response.user
                              ? { id: response.user.id, email: response.user.email }
                              : null;
                          this.userSubject.next(fallbackUser);
                          this.firstTimeLoginSubject.next(false);
                          return of(response); // Return AuthResponse wrapped in Observable
                      })
                  );
              } else {
                  this.userSubject.next(null);
                  this.firstTimeLoginSubject.next(false);
                  return of(response); // Return AuthResponse wrapped in Observable
              }
          }),
          catchError(() => {
              this.userSubject.next(null);
              this.firstTimeLoginSubject.next(false);
              return of({ isAuthenticated: false }); // Return AuthResponse wrapped in Observable
          })
      );
  }

  completeOnboarding(initialAttentionSpan: number, preferredStudyTime: string, commonDistractions?: string, avg_study_time?: number): Observable<any> {
    return this.http.post(
        `${environment.apiBaseUrl}/api/onboarding/complete`,
        { initialAttentionSpan, preferredStudyTime, commonDistractions, avg_study_time},
        { withCredentials: true }
    ).pipe(
        tap((response: any) => {
            this.userSubject.next(response.user); // Update with full user object including preferences
            this.firstTimeLoginSubject.next(false);
        }),
        catchError(err => {
            console.error('Error completing onboarding:', err);
            throw err;
        })
    );
}

    isLoggedIn(): boolean {
        return !!this.userSubject.value;
    }

    isFirstTimeUser(): boolean {
        return this.firstTimeLoginSubject.value;
    }

    getUser(): User | null {
        return this.userSubject.value;
    }

    logout(): Observable<{ message: string }> {
        return this.http.get<{ message: string }>(this.logoutUrl, { withCredentials: true }).pipe(
            tap(() => {
                this.userSubject.next(null);
                this.firstTimeLoginSubject.next(false);
            }),
            catchError(err => {
                this.userSubject.next(null);
                this.firstTimeLoginSubject.next(false);
                throw err;
            })
        );
    }
}