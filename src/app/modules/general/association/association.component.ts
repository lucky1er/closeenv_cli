import { Component, OnInit } from '@angular/core';
import { AddOnTranslationService } from '../service/addOn.translation.service';

@Component({
  selector: 'app-association',
  templateUrl: './association.component.html',
  styleUrls: ['./association.component.css']
})
export class AssociationComponent implements OnInit {

  constructor(private addonTranslator: AddOnTranslationService) { }

  ngOnInit(): void {
    this.addonTranslator.checkMetaTagInit();
    this.addonTranslator.checkRouteParamLang();
  }

}
