import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageAssistantCompareComponent } from './page-assistant.component';

describe('PageAssistantCompareComponent', () => {
  let component: PageAssistantCompareComponent;
  let fixture: ComponentFixture<PageAssistantCompareComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageAssistantCompareComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PageAssistantCompareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
