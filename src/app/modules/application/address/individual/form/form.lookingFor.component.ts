import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import isEmpty from 'lodash-es/isEmpty';

import { Address } from 'src/app/model/address';
import { Answer } from 'src/app/model/answer';
import { LookingFor } from 'src/app/model/lookingFor';
import { AuthService } from 'src/app/modules/general/service/auth.service';
import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';

const keyEnsureErrorDisplay = 'ensure-error-display';
const keyLabelProperty = 'label';

@Component({
  selector: 'app-form-lookingfor',
  templateUrl: './form.lookingFor.component.html',
  styleUrls: ['./form.lookingFor.component.css']
})
export class FormLookingForComponent implements OnInit {

  @Input() lookingFor: LookingFor;
  @Input() address: Address;
  @Input() locale: string;
  @Output() lookingForValidated = new EventEmitter<LookingFor>();
  @Output() closeWithoutValidation = new EventEmitter<boolean>();
  @Output() closeAfterRemoval = new EventEmitter<boolean>();
  @ViewChild('modalAnswersView') modalAnswersView: any;

  formLookingFor: FormGroup;
  modalOptions: NgbModalOptions;
  submitted = false;
  requesting = false;
  warningMessage = '';
  showWarningMessage = false;
  successMessage = '';
  showSuccessMessage = false;
  answersLoading = false;
  answerItems: Answer[] = null;

  constructor(
    public fb: FormBuilder,
    private authService: AuthService,
    private apiHttpService: ApiHttpService,
    private translateService: TranslateService,
    private modalService: NgbModal
  ) {
    this.formLookingFor = this.fb.group({
      text: ['', [Validators.required, Validators.minLength(30), Validators.maxLength(350)]],
      contacts: [''],
      active: [true],
      // hidden fields
      id: [''],
      address: [''],
      creationDate: [''],
    });

    this.modalOptions = {
      backdrop: 'static',
      backdropClass: 'customBackdrop'
    };
  }

  ngOnInit(): void {
    // console.log('[DEBUG] ngOnInit() ', this.lookingFor);
    if (this.lookingFor) {
      this.formLookingFor.patchValue({
        id: this.lookingFor.id,
        address: this.lookingFor.address,
        creationDate: this.lookingFor.creationDate,
        text: this.lookingFor.text,
        contacts: this.lookingFor.contacts,
        active: this.lookingFor.active
      });
    }
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.formLookingFor.controls;
  }

  getAddContactItemText(): string {
    const contactAddText = this.translateService.instant('Individual.form.lookingFor.contacts.addItem.text');
    return contactAddText;
  }

  backToParent(): void {
    this.closeWithoutValidation.emit(true);
  }

  isEmptyData(data): boolean {
    const dataType = typeof data;
    let empty = false;
    switch (dataType) {
      case 'string':
        empty = (data.trim() === '');
        break;
      case 'number':
        empty = (data === 0);
        break;
      case 'object':
        empty = isEmpty(data);
        break;
      case 'undefined':
    }
    return empty;
  }

  lookingForApiSaved(): boolean {
    let lookingForId = '';
    if (this.lookingFor.id) {
      lookingForId = this.lookingFor.id;
    }
    return !this.isEmptyData(lookingForId);
  }

  lookingForTextEditable(): boolean {
    return this.lookingFor.emptyAnswers;
  }

  isSaveAllowed(): boolean {
    return !this.requesting && this.lookingFor.active && !this.apiHttpService.isOffline();
  }

  saveLookingFor() {
    if (!this.isSaveAllowed()) {
      return;
    }

    this.submitted = true;
    // console.log('[DEBUG] label.errors ', this.f.label.errors);

    // stop here if form is invalid
    if (this.formLookingFor.invalid) {
      // console.log('[DEBUG] controle errors on field text ', this.f.text.errors);
      return;
    }

    this.rebuildContactsList();

   // console.log('[DEBUG] controle APRÈS formLookingFor.value ', this.formLookingFor.value);

    this.requesting = true;

    if (this.lookingForApiSaved()) {
      this.savePreLookingFor();
    } else {
      this.saveNewLookingFor();
    }
  }

  rebuildContactsList() {
    /* retraiter les valeurs de contacts (ng-select) */
    let newContactsList = [];

    if (this.formLookingFor.value.contacts) {
      let isObject = null;
      let itemObjectFound = false;

      for (let contactItem of this.formLookingFor.value.contacts) {
        isObject = contactItem.hasOwnProperty(keyLabelProperty);
        // chaque item doit être une string (pas un objet)
        newContactsList.push(isObject ? contactItem[keyLabelProperty] : contactItem);
        if (isObject) {
          itemObjectFound = true;
        }
      }

      if (itemObjectFound) {
        this.formLookingFor.value.contacts = newContactsList;
      }
    } else {
      this.formLookingFor.value.contacts = newContactsList;
    }
  }

  saveNewLookingFor() {
    this.formLookingFor.value.id = null;
    this.apiHttpService.postLookingFor(this.formLookingFor.value)
      .subscribe((savedLookingFor) => {
        // console.log('[BRANCHEMENT-API] postLookingFor - 2 ', savedLookingFor);
        // gestion retour vers le composant parent
        this.lookingForValidated.emit(savedLookingFor);
        this.requesting = false;
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[API] postLookingFor - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  savePreLookingFor() {
    this.apiHttpService.putLookingFor(this.formLookingFor.value)
      .subscribe((savedLookingFor) => {
        // console.log('[BRANCHEMENT-API] putLookingFor - 2 ', savedLookingFor);
        // gestion retour vers le composant parent
        this.lookingForValidated.emit(savedLookingFor);
        this.requesting = false;
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[API] putLookingFor - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  isRemoveAllowed(): boolean {
    return this.lookingForApiSaved() && this.lookingForTextEditable() && !this.apiHttpService.isOffline();
  }

  openConfirmModal(content) {
    if (this.isRemoveAllowed()) {
      this.modalService.open(content, this.modalOptions).result.then((result) => {
        if (result === 'confirm') {
          this.removeLookingFor();
        }
      }, (reason) => {});
    }
  }

  removeLookingFor(): void {
    this.requesting = true;

    this.apiHttpService.deleteLookingFor(this.lookingFor)
      .subscribe((result) => {
        // console.log('[BRANCHEMENT-API] deleteLookingFor - 1 ', result);
        this.requesting = false;
        // gestion retour vers le composant parent
        this.closeAfterRemoval.emit(true);
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[API] deleteLookingFor - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  getTooltipTextAnswerContacts(itemAnswer: Answer): string {
    let listContacts = '';
    if (itemAnswer.contacts && itemAnswer.contacts.length) {
      for (const contact of itemAnswer.contacts) {
        listContacts += (listContacts === '' ? '' : ', ') + contact;
      }
    }
    return listContacts;
  }

  showAnswersView() {
    let specModalOptions = { ...this.modalOptions };
    specModalOptions.size = 'lg';
    specModalOptions.windowClass = 'modal-xxl';
    this.answerItems = null;
    this.answersLoading = true;

    this.modalService.open(this.modalAnswersView, specModalOptions).result.then((result) => {
      // console.log('[MODAL]  then() ', result);
    }, (reason) => {
      // dismiss
    });

    this.apiHttpService.getLookingForAnswers(this.lookingFor)
      .subscribe((result) => {
        // console.log('[BRANCHEMENT-API] FormMessageComponent - getShopMessageDeliveries - 1 ', result);
        this.answerItems = result;
        this.answersLoading = false;
      }, (error) => {
        this.answersLoading = false;
        // afficher l'erreur sur la page du form
        // console.warn('[API] getLookingForAnswers - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  checkNewly(itemAnswer: Answer) {
    if (!itemAnswer.wasRead) {
      // marquer la réponse comme lue
      this.apiHttpService.readLookingForAnswer(itemAnswer.id)
        .subscribe((result) => {
          itemAnswer.wasRead = true;
        }, (error) => {
          of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
            this.authService.checkTokenExpiration(error, 1000, true);
          });
        });
    }
  }
}
