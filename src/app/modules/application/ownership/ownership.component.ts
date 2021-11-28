import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ApiHttpService } from '../../general/service/api.http.service';
import { AuthService } from '../../general/service/auth.service';
import { AddOnTranslationService } from '../../general/service/addOn.translation.service';
import { User } from '../../../model/user';
import { Place } from 'src/app/model/place';
import { Category } from 'src/app/model/category';

const keyEnsureErrorDisplay = 'ensure-error-display';

@Component({
  selector: 'app-ownership',
  templateUrl: './ownership.component.html',
  styleUrls: ['./ownership.component.css']
})
export class OwnershipComponent implements OnInit {

  tokenOwn: string;
  ownershipClaimer: User;
  claimedShop: Place;
  loading = false;
  submitted = false;
  buttonOperated = false;
  warningMessage = '';
  warningMessageStrong = '';
  showWarningMessage = false;
  successMessage = '';
  showSuccessMessage = false;
  successAdditionalInfo = '';
  showSuccessAdditionalInfo = false;
  baseCategories: Category[] = null;

  constructor(
    private apiHttpService: ApiHttpService,
    private authService: AuthService,
    public addonTranslator: AddOnTranslationService,
    private actRoute: ActivatedRoute,
    public router: Router
  ) {
    this.tokenOwn = actRoute.snapshot.params.token;
    this.ownershipClaimer = null;
    this.claimedShop = null;
  }

  ngOnInit(): void {
    // get data from tokenized request to populate this.ownershipClaimer and this.claimedShop
    this.loading = true;
    this.apiHttpService.ownershipDatas({token: this.tokenOwn})
      .subscribe((result) => {
        this.ownershipClaimer = result.user;
        this.claimedShop = result.shop;
        this.loading = false;
      }, (error) => {
        this.loading = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] ownershipDatas - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });

    this.apiHttpService.getBaseCategories()
      .subscribe((basedCategories: Category[]) => {
        this.baseCategories = basedCategories;
      }, (error) => {
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  incompleteData(): boolean {
    return (!this.ownershipClaimer || !this.claimedShop);
  }

  getShopCategoriesText(): string {
    let categoriesText = '';
    for (const categ of this.claimedShop.categories) {
      const refCateg: Category = this.baseCategories.find(el => el.code === categ);
      if (refCateg) {
        categoriesText += (categoriesText === '' ? '' : ', ') + this.addonTranslator.getOriginalTranslation(refCateg.label);
      }
    }

    return categoriesText;
  }

  confirmOwnership() {
    this.submitted = true;

    this.apiHttpService.ownershipConfirm({token: this.tokenOwn})
      .subscribe((result) => {
        this.successMessage = result.message;
        this.showSuccessMessage = true;
        this.buttonOperated = true;
        this.submitted = false;
      }, (error) => {
        this.submitted = false;
        this.buttonOperated = true;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] confirmOwnership() - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  denyOwnership() {
    this.submitted = true;

    this.apiHttpService.ownershipDeny({token: this.tokenOwn})
      .subscribe((result) => {
        this.successMessage = result.message;
        this.showSuccessMessage = true;
        this.buttonOperated = true;
        this.submitted = false;
      }, (error) => {
        this.submitted = false;
        this.buttonOperated = true;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] denyOwnership() - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

}
