import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MapVicinityComponent } from './map-vicinity.component';
import { TranslateModule } from '@ngx-translate/core';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { HttpClientModule } from '@angular/common/http';

describe('MapVicinityComponent', () => {
  let component: MapVicinityComponent;
  let fixture: ComponentFixture<MapVicinityComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot(),
        LeafletModule,
        HttpClientModule
      ],
      declarations: [ MapVicinityComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MapVicinityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
