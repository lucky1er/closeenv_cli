import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { RelocateComponent } from './relocate.component';
import { AppConfigService } from 'src/app/app.config.service';
import { HttpClientModule } from '@angular/common/http';

const appConfigData: any = require('src/assets/params/settings.json');

export class AppConfigFactory {
  // only one public method in the original AppConfigService
  public config: any = appConfigData;
}

describe('RelocateComponent', () => {
  let component: RelocateComponent;
  let fixture: ComponentFixture<RelocateComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        RouterTestingModule,
        TranslateModule.forRoot(),
        HttpClientModule
      ],
      declarations: [ RelocateComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    TestBed.configureTestingModule({
      // court-circuite l'instanciation du singleton AppConfigService,
      // dont la requête http.get('../assets/params/settings.json') n'a pas le temps d'aboutir
      providers: [
        RelocateComponent,
        {
          provide: AppConfigService,
          useClass: AppConfigFactory
        },
      ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RelocateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
