import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IaStructureComponent } from './ia-structure.component';

describe('IaStructureComponent', () => {
  let component: IaStructureComponent;
  let fixture: ComponentFixture<IaStructureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IaStructureComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IaStructureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
