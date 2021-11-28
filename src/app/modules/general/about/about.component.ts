import { Component, OnInit } from '@angular/core';
import { AddOnTranslationService } from '../service/addOn.translation.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css']
})
export class AboutComponent implements OnInit {

  constructor(public addonTranslator: AddOnTranslationService) { }

  ngOnInit(): void {
    this.addonTranslator.checkMetaTagInit();
    this.addonTranslator.checkRouteParamLang();
  }

}
