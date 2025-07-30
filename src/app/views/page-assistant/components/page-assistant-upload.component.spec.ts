import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageAssistantUploadComponent } from './page-assistant-upload.component';

describe('PageAssistantUploadComponent', () => {
  let component: PageAssistantUploadComponent;
  let fixture: ComponentFixture<PageAssistantUploadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageAssistantUploadComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PageAssistantUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
