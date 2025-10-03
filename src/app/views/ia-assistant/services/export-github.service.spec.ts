import { TestBed } from '@angular/core/testing';

import { ExportGitHubService } from './export-github.service';

describe('ExportGitHubService', () => {
  let service: ExportGitHubService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportGitHubService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
