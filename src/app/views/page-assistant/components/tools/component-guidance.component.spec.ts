import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponentGuidanceComponent } from './component-guidance.component';

describe('ComponentGuidanceComponent', () => {
  let component: ComponentGuidanceComponent;
  let fixture: ComponentFixture<ComponentGuidanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentGuidanceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComponentGuidanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
