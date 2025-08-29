import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeadingStructureComponent } from './heading-structure.component';

describe('HeadingStructureComponent', () => {
  let component: HeadingStructureComponent;
  let fixture: ComponentFixture<HeadingStructureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeadingStructureComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeadingStructureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
