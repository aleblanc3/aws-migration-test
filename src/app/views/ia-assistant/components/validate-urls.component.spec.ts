import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ValidateUrlsComponent } from './validate-urls.component';

describe('ValidateUrlsComponent', () => {
  let component: ValidateUrlsComponent;
  let fixture: ComponentFixture<ValidateUrlsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidateUrlsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ValidateUrlsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
