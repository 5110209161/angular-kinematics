import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CollaRobotComponent } from './colla-robot.component';

describe('CollaRobotComponent', () => {
  let component: CollaRobotComponent;
  let fixture: ComponentFixture<CollaRobotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CollaRobotComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CollaRobotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
