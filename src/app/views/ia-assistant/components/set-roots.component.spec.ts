import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetRootsComponent } from './set-roots.component';

describe('SetRootsComponent', () => {
  let component: SetRootsComponent;
  let fixture: ComponentFixture<SetRootsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetRootsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SetRootsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
