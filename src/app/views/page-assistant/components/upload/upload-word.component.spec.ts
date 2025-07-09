import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadWordComponent } from './upload-word.component';

describe('UploadWordComponent', () => {
  let component: UploadWordComponent;
  let fixture: ComponentFixture<UploadWordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadWordComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadWordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
