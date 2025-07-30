import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HorizontalRadioButtonsComponent } from '../../views/page-assistant/components/horizontal-radio-buttons.component';

describe('HorizontalRadioButtonsComponent', () => {
  let component: HorizontalRadioButtonsComponent;
  let fixture: ComponentFixture<HorizontalRadioButtonsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HorizontalRadioButtonsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HorizontalRadioButtonsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
