import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { routeLangParamStub } from '../service/addOn.translation.service';
import { AssociationComponent } from './association.component';

describe('NotFoundComponent', () => {
  let component: AssociationComponent;
  let fixture: ComponentFixture<AssociationComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot()
      ],
      declarations: [ AssociationComponent ],
      providers: [
        { 
          provide: ActivatedRoute, 
          useValue: routeLangParamStub,
        }
      ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AssociationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
