import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IaTreeComponent } from './ia-tree.component';

describe('IaTreeComponent', () => {
  let component: IaTreeComponent;
  let fixture: ComponentFixture<IaTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IaTreeComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IaTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
