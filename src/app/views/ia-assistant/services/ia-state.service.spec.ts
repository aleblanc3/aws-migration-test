import { TestBed } from '@angular/core/testing';

import { IaStateService } from './ia-state.service';

describe('IaStateService', () => {
  let service: IaStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IaStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
