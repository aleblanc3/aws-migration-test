import { TestBed } from '@angular/core/testing';

import { ShadowdomService } from './shadowdom.service';

describe('ShadowdomService', () => {
  let service: ShadowdomService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShadowdomService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
