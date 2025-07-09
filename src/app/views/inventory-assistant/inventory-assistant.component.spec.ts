import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InventoryAssistantComponent } from './inventory-assistant.component';

describe('InventoryAssistantComponent', () => {
  let component: InventoryAssistantComponent;
  let fixture: ComponentFixture<InventoryAssistantComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventoryAssistantComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InventoryAssistantComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
