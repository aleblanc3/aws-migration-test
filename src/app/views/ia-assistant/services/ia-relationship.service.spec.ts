import { TestBed } from '@angular/core/testing';

import { IaRelationshipService } from './ia-relationship.service';

describe('IaRelationshipService', () => {
  let service: IaRelationshipService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IaRelationshipService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
