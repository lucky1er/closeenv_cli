import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../service/auth.service';
import { BrowserService } from '../service/browser.service';

function passwordPatternValidator(control: AbstractControl): { [key: string]: any } {
  if (!control.value) {
    return null;
  }
  // doit comporter au moins :
  //        1 majuscule
  //        1 minuscule
  //        1 chiffre
  // et doit compter au moins 7 positions (longueur mini)
  const regex = new RegExp('^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{7,}$');
  const valid = regex.test(control.value);
  return valid ? null : { patternMismatch: true };
}

function passwordMatchValidator(fg: FormGroup) {
  if (fg.get('password').value === fg.get('confirmPassword').value) {
    if (fg.get('confirmPassword').errors && fg.get('confirmPassword').errors.mismatch) {
      delete fg.get('confirmPassword').errors.mismatch;
    }
  } else {
    if (!fg.get('confirmPassword').errors || !fg.get('confirmPassword').errors.mismatch) {
      fg.get('confirmPassword').setErrors({mismatch: true});
    }
  }
  return null;
}

@Component({
  selector: 'app-password',
  templateUrl: './password.component.html',
  styleUrls: ['./password.component.css']
})
export class PasswordComponent {

  passwordForm: FormGroup;
  newRequestPasswordForm: FormGroup;
  tokenPass: string;
  newRequest: boolean;
  loading = false;
  submitted = false;
  errorBack = false;
  hideForm = false;
  warningMessage = '';
  warningMessageStrong = '';
  showWarningMessage = false;
  successMessage = '';
  showSuccessMessage = false;
  successAdditionalInfo = '';
  showSuccessAdditionalInfo = false;
  passwordApparent: boolean;
  confirmPasswordApparent: boolean;

  constructor(
    public fb: FormBuilder,
    public authService: AuthService,
    public browserService: BrowserService,
    private actRoute: ActivatedRoute,
    public router: Router
  ) {
    this.tokenPass = actRoute.snapshot.params.token;
    this.newRequest = (this.tokenPass === 'new');

    this.passwordForm = this.fb.group({
      password: ['', Validators.compose([Validators.required, passwordPatternValidator])],
      confirmPassword: ['', [Validators.required, Validators.minLength(7)]],
    }, {validator: passwordMatchValidator});

    this.newRequestPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  togglePasswordVisibility() {
    this.passwordApparent = !this.passwordApparent;
  }

  toggleConfirmPasswordVisibility() {
    this.confirmPasswordApparent = !this.confirmPasswordApparent;
  }

  validatePassword() {
    this.submitted = true;

    if (this.hasPasswordError || this.hasConfirmPasswordError) {
      // stop here if form is invalid
      return;
    }

    this.loading = true;

    // ajouter this.tokenPass dans objet à transmettre
    const newPasswordWrapper = {
      token: this.tokenPass,
      newPassword: this.passwordForm.value.password,
    };

    this.authService.passwordReset(newPasswordWrapper)
      .subscribe((result) => {
        if (result.status === 201) {
          this.successMessage = result.message;
          this.showSuccessMessage = true;
          this.successAdditionalInfo = 'Password.changed.success.action.to.follow';
          this.showSuccessAdditionalInfo = true;
          this.hideForm = true;
        }
        this.loading = false;
      }, (error) => {
        this.errorBack = true;
        this.loading = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] PasswordComponent.validatePassword() - 9 ', error);
        this.warningMessage = error;
        this.showWarningMessage = true;
      }, () => {
        // fin du subscribe
      });
  }

  switchNewForm() {
    this.tokenPass = 'new';
    this.newRequest = true;
    this.warningMessage = '';
    this.showWarningMessage = false;
  }

  newRequestPassword() {
    this.submitted = true;
    if (this.showWarningMessage) {
      this.warningMessage = '';
      this.showWarningMessage = false;
    }

    // stop here if form is invalid
    if (this.newRequestPasswordForm.invalid) {
      return;
    }

    this.loading = true;

    this.authService.passwordNewRequest(this.newRequestPasswordForm.value)
      .subscribe((result) => {
        if (result.status === 201) {
          this.successMessage = result.message;
          this.showSuccessMessage = true;
          this.successAdditionalInfo = 'Password.request.success.action.to.follow';
          this.showSuccessAdditionalInfo = true;
        }
        this.loading = false;
      }, (error) => {
        this.loading = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] PasswordComponent.newRequestPassword() - 9 ', error);
        this.warningMessage = error;
        this.showWarningMessage = true;
      }, () => {
        // fin du subscribe
      });
  }

  // convenience getter for easy access to form fields from template
  get f() {
    return this.passwordForm.controls;
  }

  get hasPasswordError() {
    return (this.f.password.errors && Object.keys(this.f.password.errors).length > 0);
  }

  get hasConfirmPasswordError() {
    return (this.f.confirmPassword.errors && Object.keys(this.f.confirmPassword.errors).length > 0);
  }
}
