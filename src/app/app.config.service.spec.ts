import { TestBed } from '@angular/core/testing';

import { AppConfigService } from './app.config.service';
import { HttpClientModule } from '@angular/common/http';

describe('AppConfigService', () => {
  let service: AppConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule
      ],
    });
    service = TestBed.inject(AppConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
