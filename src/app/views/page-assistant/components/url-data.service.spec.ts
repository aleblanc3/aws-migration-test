import { TestBed } from '@angular/core/testing';

import { UrlDataService } from './url-data.service';

describe('UrlDataService', () => {
  let service: UrlDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UrlDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
