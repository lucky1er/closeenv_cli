import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { formatDate } from '@angular/common';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/modules/general/service/auth.service';
import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';
import { LookingFor } from 'src/app/model/lookingFor';
import { Answer } from 'src/app/model/answer';

const keyEnsureErrorDisplay = 'ensure-error-display';
const keyLabelProperty = 'label';

@Component({
  selector: 'app-looking-for-answer',
  templateUrl: './answer.component.html',
  styleUrls: ['./answer.component.css']
})
export class AnswerComponent implements OnInit {

  @Input() locale: string;
  @Input() lookingFor: LookingFor;
  @Output() answerValidated = new EventEmitter<Answer>();
  @Output() closeWithoutValidation = new EventEmitter<LookingFor>();
  @Output() closeAfterRemoval = new EventEmitter<LookingFor>();

  formAnswer: FormGroup;
  submitted = false;
  requesting = false;
  warningMessage = '';
  showWarningMessage = false;

  constructor(
    public fb: FormBuilder,
    private translateService: TranslateService,
    private authService: AuthService,
    private apiHttpService: ApiHttpService,
    ) {
    this.formAnswer = this.fb.group({
      text: ['', [Validators.required, Validators.minLength(30), Validators.maxLength(350)]],
      contacts: [''],
      // hidden fields
      id: [''],
      user: [''],
      lookingFor: [''],
      creationDate: [''],
    });
  }

  ngOnInit(): void {
    // console.log('[DEBUG] trace locale 9 ', this.locale);

    if (this.lookingFor && this.lookingFor.answer) {
      this.formAnswer.patchValue({
        id: this.lookingFor.answer.id,
        user: this.lookingFor.answer.user, // IRI du user courant
        lookingFor: this.lookingFor.answer.lookingFor, // IRI du LookingFor
        creationDate: this.lookingFor.answer.creationDate,
        text: this.lookingFor.answer.text,
        contacts: this.lookingFor.answer.contacts
      });
    }
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.formAnswer.controls;
  }

  getAddContactItemText(): string {
    const contactAddText = this.translateService.instant('Individual.form.lookingFor.contacts.addItem.text');
    return contactAddText;
  }

  getLookingForCreationDateText(): string {
    let creationDateText = this.translateService.instant('Individual.vicinity.form.answer.header.lookingFor.senton');
    if (creationDateText.trim() !== '') {
      creationDateText = creationDateText.trim() + ' ';
    }
    creationDateText += formatDate(this.lookingFor.creationDate, 'shortDate', this.locale);
    // formatDate(value: string | Date, format: string, locale: string)
    return creationDateText;
  }

  getAnswerDateAdditionalText(): string {
    if (!this.lookingFor.answer || this.lookingFor.answer.id === '') {
      return '';
    }
    let answerDateText = this.translateService.instant('Individual.vicinity.form.answer.header.lookingFor.senton');
    if (answerDateText.trim() !== '') {
      answerDateText = answerDateText.trim() + ' ';
    }
    answerDateText += formatDate(this.lookingFor.answer.creationDate, 'shortDate', this.locale);
    // formatDate(value: string | Date, format: string, locale: string)
    return ', ' + answerDateText;
  }

  getLookingForContactsTextHtml(): string {
    let lfContactsText = '';

    if (this.lookingFor && this.lookingFor.contacts && this.lookingFor.contacts.length) {
      lfContactsText = this.translateService.instant('Individual.vicinity.form.answer.header.lookingFor.contacts');

      for (let contactItem of this.lookingFor.contacts) {
        if (typeof contactItem === 'string') {
          lfContactsText += '&nbsp;&nbsp;' + contactItem;
        }
      }
    }

    return lfContactsText;
  }

  answerAlreadyExists(): boolean {
    return (this.lookingFor.answer.id && this.lookingFor.answer.id !== '');
  }

  answerExistsAndNotShown(): boolean {
    return (this.answerAlreadyExists() && !this.lookingFor.answer.wasShown);
  }

  backToParent(): void {
    this.closeWithoutValidation.emit(this.lookingFor);
  }

  isSaveAnswerAllowed(): boolean {
    return !this.apiHttpService.isOffline() && !this.requesting && !this.answerAlreadyExists();
  }

  saveAnswer() {
    if (this.apiHttpService.isOffline()) {
      return;
    }

    this.submitted = true;
    // console.log('[DEBUG] label.errors ', this.f.label.errors);

    // stop here if form is invalid
    if (this.formAnswer.invalid) {
      // console.log('[DEBUG] controle errors on field text ', this.f.text.errors);
      return;
    }

    this.rebuildContactsList();

   // console.log('[DEBUG] controle APRÈS formAnswer.value ', this.formAnswer.value);

    this.requesting = true;

    this.formAnswer.value.id = null;
    this.apiHttpService.postAnswer(this.formAnswer.value)
      .subscribe((savedAnswer) => {
        // console.log('[BRANCHEMENT-API] postAnswer - 2 ', savedAnswer);
        // gestion retour vers le composant parent
        this.answerValidated.emit(savedAnswer);
        this.requesting = false;
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[API] postAnswer - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  rebuildContactsList() {
    /* retraiter les valeurs de contacts (ng-select) */
    let newContactsList = [];

    if (this.formAnswer.value.contacts) {
      let isObject = null;
      let itemObjectFound = false;

      for (let contactItem of this.formAnswer.value.contacts) {
        isObject = contactItem.hasOwnProperty(keyLabelProperty);
        // chaque item doit être une string (pas un objet)
        newContactsList.push(isObject ? contactItem[keyLabelProperty] : contactItem);
        if (isObject) {
          itemObjectFound = true;
        }
      }

      if (itemObjectFound) {
        this.formAnswer.value.contacts = newContactsList;
      }
    } else {
      this.formAnswer.value.contacts = newContactsList;
    }
  }

  isRemoveAnswerAllowed(): boolean {
    return !this.apiHttpService.isOffline() && this.answerExistsAndNotShown();
  }

  removeAnswer(): void {
    if (this.apiHttpService.isOffline()) {
      return;
    }

    this.requesting = true;

    this.apiHttpService.deleteAnswer(this.lookingFor.answer)
      .subscribe((result) => {
        // console.log('[BRANCHEMENT-API] deleteAnswer - 1 ', result);
        this.requesting = false;
        // gestion retour vers le composant parent
        this.closeAfterRemoval.emit(this.lookingFor);
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[API] deleteAnswer - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

}
