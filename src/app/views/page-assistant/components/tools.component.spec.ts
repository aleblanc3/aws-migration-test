import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageToolsComponent } from './tools.component';

describe('PageDetailsComponent', () => {
  let component: PageToolsComponent;
  let fixture: ComponentFixture<PageToolsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageToolsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PageToolsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
