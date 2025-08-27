import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageUploadComponent } from './upload.component';

describe('PageUploadComponent', () => {
  let component: PageUploadComponent;
  let fixture: ComponentFixture<PageUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageUploadComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PageUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
