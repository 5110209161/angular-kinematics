import { TestBed } from '@angular/core/testing';

import { SignalRService } from './signalR.service';

describe('SignalRService', () => {
  let service: SignalRService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SignalRService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
