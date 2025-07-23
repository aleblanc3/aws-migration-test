import { TestBed } from '@angular/core/testing';

import { WebDiffService } from './web-diff.service';

describe('WebDiffService', () => {
  let service: WebDiffService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebDiffService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
