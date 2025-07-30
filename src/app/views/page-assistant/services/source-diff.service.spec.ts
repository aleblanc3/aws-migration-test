import { TestBed } from '@angular/core/testing';

import { SourceDiffService } from './source-diff.service';

describe('SourceDiffService', () => {
  let service: SourceDiffService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SourceDiffService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
