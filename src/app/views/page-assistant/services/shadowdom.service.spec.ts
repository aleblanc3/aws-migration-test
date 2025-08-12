import { TestBed } from '@angular/core/testing';

import { ShadowDomService } from './shadowdom.service';

describe('ShadowdomService', () => {
  let service: ShadowDomService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShadowDomService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
