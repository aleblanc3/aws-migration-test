import { TestBed } from '@angular/core/testing';

import { IaTreeService } from './ia-tree.service';

describe('IaTreeService', () => {
  let service: IaTreeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IaTreeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
