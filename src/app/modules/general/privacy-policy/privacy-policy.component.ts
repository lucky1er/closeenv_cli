import { Component, OnInit } from '@angular/core';
import { AddOnTranslationService } from '../service/addOn.translation.service';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.css']
})
export class PrivacyPolicyComponent implements OnInit {

  constructor(private addonTranslator: AddOnTranslationService) { }

  ngOnInit(): void {
    this.addonTranslator.checkMetaTagInit();
    this.addonTranslator.checkRouteParamLang();
  }

}
