import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewDiffsComponent } from './view-diffs.component';

describe('ViewDiffsComponent', () => {
  let component: ViewDiffsComponent;
  let fixture: ComponentFixture<ViewDiffsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewDiffsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewDiffsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
