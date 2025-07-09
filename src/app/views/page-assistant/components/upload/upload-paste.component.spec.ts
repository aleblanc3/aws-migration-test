import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadPasteComponent } from './upload-paste.component';

describe('UploadPasteComponent', () => {
  let component: UploadPasteComponent;
  let fixture: ComponentFixture<UploadPasteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadPasteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadPasteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
