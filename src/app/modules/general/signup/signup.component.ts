import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../service/auth.service';
import { BrowserService } from '../service/browser.service';
import { LocationService, keySuggestedAddressProperties } from 'src/app/modules/general/service/location.service';
import { AddOnTranslationService } from '../service/addOn.translation.service';
import { Address } from 'src/app/model/address';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css']
})
export class SignupComponent implements OnInit {

  lastPosition: any;
  lastAddress: string;
  signupForm: FormGroup;
  loading = false;
  submitted = false;
  warningMessage = '';
  warningMessageStrong = '';
  showWarningMessage = false;
  successMessage = '';
  showSuccessMessage = false;
  successAdditionalInfo = '';
  showSuccessAdditionalInfo = false;
  searchLocation: any = {
    type: 'amenity',
    skipIcons: true,
    skipDetails: true,
    biasByCountryCode: null,
  };

  constructor(
    public fb: FormBuilder,
    public authService: AuthService,
    public browserService: BrowserService,
    public addonTranslator: AddOnTranslationService,
    private locationService: LocationService
    ) {

    this.signupForm = this.fb.group({
      checkPrivacyPolicy: [false, Validators.requiredTrue],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      country: ['', [Validators.required, Validators.minLength(3)]],
      city: ['', [Validators.required, Validators.minLength(3)]],
      postCode: [''],
      // hidden fields
      county: [''],
      administrative: [''],
      latitude: [''],
      longitude: [''],
      countryCode: [''],
      languageCode: ['']
    });
  } // constructor

  ngOnInit(): void {
    this.addonTranslator.checkMetaTagInit();
    this.addonTranslator.checkRouteParamLang();

    this.lastPosition = this.browserService.getLocalStorageItem('position');
    if (this.lastPosition) {
      this.refreshAddressForm(this.lastPosition);
    }
    this.signupForm.patchValue({
      languageCode: this.browserService.getLocalStorageItem('locale')
    });
  }

  refreshAddressFromSuggestion(selectedSuggestion: any): void {
    if (selectedSuggestion.hasOwnProperty(keySuggestedAddressProperties) && selectedSuggestion[keySuggestedAddressProperties]
      && typeof selectedSuggestion[keySuggestedAddressProperties] === 'object') {
      let convertedAddress = new Address(null, '', '', '', '', '');
      this.locationService.addressMappingFromSuggestion(convertedAddress, selectedSuggestion[keySuggestedAddressProperties]);
      this.refreshAddressForm(convertedAddress);
    }
  }

  refreshAddressForm(givenAddress: any): void {
    if (givenAddress.addressLabel && givenAddress.addressLabel.trim() !== '') {
      this.signupForm.patchValue({
        // populate address form fields with convertedAddress properties
        address: givenAddress.addressLabel,
        city: givenAddress.city ? givenAddress.city : '',
        postCode: givenAddress.postCode ? givenAddress.postCode : '',
        country: givenAddress.country ? givenAddress.country : '',
        // hidden form fields
        county: givenAddress.county ? givenAddress.county : '',
        administrative: givenAddress.administrative ? givenAddress.administrative : '',
        latitude: givenAddress.latitude ? '' + givenAddress.latitude : '',
        longitude: givenAddress.longitude ? '' + givenAddress.longitude : '',
        countryCode: givenAddress.countryCode ? givenAddress.countryCode : ''
      });
    }
  }

  registerUser() {
    this.submitted = true;

    // console.log('[A-BRANCHER] SignupComponent.registerUser() - 0 ', this.f.email.errors, this.signupForm.invalid);

    // stop here if form is invalid
    if (this.signupForm.invalid) {
      return;
    }

    this.loading = true;

    // recopie userObject = { ...this.signupForm.value }; - autre technique possible: userObject = Object.assign({}, this.signupForm.value)
    // const userObject = User.populateFromJson(this.signupForm.value);
    // inutile de passer par un autre objet, on a déjà tout ce qu'il faut dans this.signupForm.value

    // console.log('[BRANCHEMENT-API] SignupComponent.registerUser() - 1 ', this.signupForm.value);

    // BRANCHEMENT API
    this.authService.signUp(this.signupForm.value)
      .subscribe((result) => {
        // console.log('[BRANCHEMENT-API] SignupComponent.registerUser() - 2 ', result);
        if (result.status === 201) {
          this.successMessage = result.message;
          this.showSuccessMessage = true;
          this.successAdditionalInfo = 'Signup.success.action.to.follow';
          this.showSuccessAdditionalInfo = true;
        }
        this.loading = false;
      }, (error) => {
        this.loading = false;
        // afficher l'erreur sur la page du form
        console.warn('[API] registerUser signup error ', error);
        this.warningMessage = error;
        this.showWarningMessage = true;
      }, () => {
        // fin du subscribe
      });
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.signupForm.controls;
  }

}
