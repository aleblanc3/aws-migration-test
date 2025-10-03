import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplateConversionComponent } from './template-conversion.component';

describe('TemplateConversionComponent', () => {
  let component: TemplateConversionComponent;
  let fixture: ComponentFixture<TemplateConversionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateConversionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemplateConversionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
