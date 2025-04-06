// loader.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('');

  loading$: Observable<boolean> = this.loadingSubject.asObservable();
  message$: Observable<string> = this.messageSubject.asObservable();

  show(message: string = ''): void {
    this.messageSubject.next(message);
    this.loadingSubject.next(true);
  }

  hide(): void {
    this.loadingSubject.next(false);
  }

  isLoading(): boolean {
    return this.loadingSubject.getValue(); // Returns true if loading is in progress
  }
}