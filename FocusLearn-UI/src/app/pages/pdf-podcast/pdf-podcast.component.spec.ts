import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfPodcastComponent } from './pdf-podcast.component';

describe('PdfPodcastComponent', () => {
  let component: PdfPodcastComponent;
  let fixture: ComponentFixture<PdfPodcastComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfPodcastComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PdfPodcastComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
