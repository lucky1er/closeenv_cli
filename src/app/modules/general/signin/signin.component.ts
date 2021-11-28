import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../service/auth.service';
import { AddOnTranslationService } from '../service/addOn.translation.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.css'],
  // providers: [ TranslateService ]
})
export class SigninComponent implements OnInit {

  // réviser par rapport à base de https://jasonwatmore.com/post/2020/04/28/angular-9-user-registration-and-login-example-tutorial
  signinForm: FormGroup;
  loading = false;
  submitted = false;
  warningMessage = '';
  warningMessageStrong = '';
  showWarningMessage = false;
  hideForm = false;

  constructor(
    public fb: FormBuilder,
    public authService: AuthService,
    public addonTranslator: AddOnTranslationService,
    private actRoute: ActivatedRoute,
    public router: Router
  ) {
    // optional query parameter
    actRoute.queryParamMap
      .subscribe(params => {
        const msgWarn = params.get('msgWarn');
        if (msgWarn && typeof msgWarn === 'string') {
          // afficher message d'alerte
          this.warningMessage = msgWarn;
          this.showWarningMessage = true;
        }
      });

    this.signinForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(7)]]
    });
  }

  ngOnInit(): void {
    this.addonTranslator.checkMetaTagInit();
    //const routeParamLang = this.actRoute.snapshot.paramMap.get('lang');
    this.addonTranslator.checkRouteParamLang();
  }

  loginUser() {
    this.submitted = true;

    // stop here if form is invalid
    if (this.signinForm.invalid) {
      return;
    }

    this.loading = true;
    this.warningMessage = '';
    this.showWarningMessage = false;

    this.authService.signIn(this.signinForm.value)
      .subscribe((result) => {
        this.loading = false;
        this.hideForm = true;
        this.authService.setCurrentUser(result.token, this.signinForm.value.email);
      }, (error) => {
        this.loading = false;
        // afficher l'erreur sur la page du form
        this.warningMessage = error;
        this.showWarningMessage = true;
      }, () => {
        // fin du subscribe
      });
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.signinForm.controls;
  }
}
