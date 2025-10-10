import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportGithubComponent } from './export-github.component';

describe('ExportGithubComponent', () => {
  let component: ExportGithubComponent;
  let fixture: ComponentFixture<ExportGithubComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportGithubComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExportGithubComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
