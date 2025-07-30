import { TestBed } from '@angular/core/testing';

import { UploadSettingsService } from './upload-state.service';

describe('UploadSettingsService', () => {
  let service: UploadSettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UploadSettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
