import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageProblemsComponent } from './problems.component';

describe('PageDetailsComponent', () => {
  let component: PageProblemsComponent;
  let fixture: ComponentFixture<PageProblemsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageProblemsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageProblemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
