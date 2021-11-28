import { Component, OnInit } from '@angular/core';
import { AddOnTranslationService } from '../service/addOn.translation.service';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css']
})
export class ContactComponent implements OnInit {

  constructor(private addonTranslator: AddOnTranslationService) { }

  ngOnInit(): void {
    this.addonTranslator.checkMetaTagInit();
    this.addonTranslator.checkRouteParamLang();
  }

  getCurrentLanguageCode(): string {
    return this.addonTranslator.getTranslationDefaultLang();
  }
}
