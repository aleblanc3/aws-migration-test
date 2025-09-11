import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IaAssistantComponent } from './ia-assistant.component';

describe('IaAssistantComponent', () => {
  let component: IaAssistantComponent;
  let fixture: ComponentFixture<IaAssistantComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IaAssistantComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IaAssistantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
