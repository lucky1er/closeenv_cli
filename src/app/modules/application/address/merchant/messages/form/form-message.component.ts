import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { NgbModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import isEmpty from 'lodash-es/isEmpty';

import { Place } from 'src/app/model/place';
import { ShopMessage } from 'src/app/model/shopMessage';
import { AuthService } from 'src/app/modules/general/service/auth.service';
import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';
import { BrowserService } from 'src/app/modules/general/service/browser.service';
import { AddOnTranslationService } from 'src/app/modules/general/service/addOn.translation.service';

const keyEnsureErrorDisplay = 'ensure-error-display';
const editorPlugins = [
  'advlist autolink lists link charmap preview anchor',
  'searchreplace visualblocks code fullscreen',
  'insertdatetime media table paste code help wordcount'
];
const editorToolbar =
'undo redo | formatselect | backcolor | bold italic | \
bullist numlist | selectall | removeformat | help';

// cf. exemple TinyMCE avec reactive form : https://www.tiny.cloud/blog/angular-rich-text-editor/ 

declare let tinymce: any;

@Component({
  selector: 'app-form-message',
  templateUrl: './form-message.component.html',
  styleUrls: ['./form-message.component.css'],
})
export class FormMessageComponent implements OnInit, OnDestroy {

  @Input() message: ShopMessage;
  @Input() place: Place;
  @Output() messageValidated = new EventEmitter<ShopMessage>();
  @Output() closeWithoutValidation = new EventEmitter<boolean>();
  @Output() closeAfterRemoval = new EventEmitter<boolean>();
  @ViewChild('modalDeliveryReport') modalDeliveryReport: any;

  messageForm: FormGroup;
  messageBodyFormFieldName: string;
  editorUniqid: string;
  editorConfig: any;
  requesting = false;
  submitted = false;
  reportLoading = false;
  deliveryItems = null;
  warningMessage = '';
  warningMessageStrong = '';
  showWarningMessage = false;
  successMessage = '';
  showSuccessMessage = false;
  successAdditionalInfo = '';
  showSuccessAdditionalInfo = false;
  minDateFrom: string;
  readonly minRequiredWordsCount: number;
  modalOptions: NgbModalOptions;
  locale: string;

  constructor(
    public fb: FormBuilder,
    private authService: AuthService,
    private apiHttpService: ApiHttpService,
    private browserService: BrowserService,
    private translateService: TranslateService,
    private addonTranslator: AddOnTranslationService,
    private modalService: NgbModal,
  ) {

    this.locale = this.addonTranslator.getDeterminedLocale();
    this.minRequiredWordsCount = 40;
    const editorLocale = this.locale.replace('-', '_');

    this.messageForm = this.fb.group({
      label: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(40)]],
      languageCode: [''],
      validFrom: ['', [Validators.required]],
      validTo: ['', [Validators.required]],
      text: ['', [Validators.required, Validators.minLength(50)]],
      toBeSent: [true],
      lockedForSending: [false],
      // hidden fields
      id: [''],
      shop: [''],
      asso: ['']
    });

    this.editorUniqid = 'tinymce' + Date.now();

    this.messageBodyFormFieldName = 'text';
    this.editorConfig = {
      height: 400,
      menubar: false,
      plugins: editorPlugins,
      toolbar: editorToolbar,
    };
    if (editorLocale !== 'en_US') {
      this.editorConfig.language = editorLocale;
      this.editorConfig.language_url = '/assets/tinymce/langs/' + editorLocale + '.js'; // site absolute URL
    }
    // cf. https://www.ngdevelop.tech/loading-external-libraries-from-cdn-in-angular-application/
    //this.extScriptService.loadScript('tinymce');
    this.modalOptions = {
      backdrop: 'static',
      backdropClass: 'customBackdrop'
    };
  }

  ngOnInit(): void {
    if (this.message) {
      const languageCode = this.message.languageCode ? this.message.languageCode : this.browserService.getLocalStorageItem('locale'); 
      const strDateFrom = this.message.validFrom ? this.message.validFrom.substring(0, 10) : '';
      const strDateTo = this.message.validTo ? this.message.validTo.substring(0, 10) : '';
      // console.log('[DEBUG] strDateFrom ', strDateFrom);
      // console.log('[DEBUG] strDateTo ', strDateTo);

      if (!this.messageEditable()) {
        this.messageForm.disable();
        this.minDateFrom = strDateFrom;
      } else {
        // console.log('[DEBUG] message.id ', this.message.id);
        if (this.message.id && typeof this.message.id === 'number') {
          // message pré-existant : ne pas obliger à changer la date de début de validité
          this.minDateFrom = strDateFrom;
        } else {
          this.minDateFrom = new Date().toISOString().substring(0, 10);
        }
      }

      const isPlaceAsso = Place.isAssociation(this.place);
      const shopIdent = isPlaceAsso ? null : this.message.shop;
      const assoIdent = isPlaceAsso ? this.message.asso : null;
  
      this.messageForm.patchValue({
        id: this.message.id,
        shop: shopIdent,
        asso: assoIdent,
        label: this.message.label,
        languageCode: languageCode,
        validFrom: strDateFrom,
        validTo: strDateTo,
        text: this.message.text,
        toBeSent: this.message.toBeSent,
        lockedForSending: this.message.lockedForSending
      });
    }
  }

  onEditorReady(eventObject) {
    // console.log('[DEBUG] onEditorReady() ', eventObject);
    if (!this.messageEditable()) {
      const editor = this.getEditor();
      if (editor) {
        // console.log('[DEBUG] ctrlModEdit ', editor.mode.get());
        if (editor.mode.get() === 'design') {
          editor.mode.set('readonly');
        }
      }
    }
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

  messageApiSaved(): boolean {
    let messageId = '';
    // console.log('[DEBUG] this.message ', this.message);
    if (this.message.id) {
      messageId = this.message.id;
    }
    return !this.isEmptyData(messageId);
  }

  messageAlreadySent(): boolean {
    let numberOfRecipients = 0;
    if (this.message && this.message.numberOfRecipients) {
      numberOfRecipients = this.message.numberOfRecipients;
    }
    return (numberOfRecipients !== 0);
  }

  messageEditable(): boolean {
    let editable = false;
    if (
      this.message && (!this.message.lockedForSending || this.message.unlocked || !this.message.toBeSent)
      && !this.apiHttpService.isOffline()
    ) {
      editable = true;
    }
    return editable;
  }

  backToParent(): void {
    this.closeWithoutValidation.emit(true);
  }

  saveMessage() {
    this.submitted = true;

    // console.log('[DEBUG] label.errors ', this.f.label.errors);

    // stop here if form is invalid
    if (this.messageForm.invalid || this.hasErrorFromDateMin() || this.hasErrorInconsistentDates() || this.hasErrorMessageText()) {
      // console.log('[DEBUG] controle errors on field text ', this.f.text.errors);
      return;
    }

    this.requesting = true;

    if (this.messageApiSaved()) {
      this.saveMessagePre();
    } else {
      this.saveMessageNew();
    }
    //
  }

  saveMessageNew() {
    this.messageForm.value.id = null;
    this.apiHttpService.postMessage(this.place, this.messageForm.value)
      .subscribe((savedMessage) => {
        // console.log('[BRANCHEMENT-API] FormMessageComponent - postMessage - 2 ', savedMessage);
        // gestion retour vers le composant parent
        this.messageValidated.emit(savedMessage);
        this.requesting = false;
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] FormMessageComponent - postAddress - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
    //
  }

  saveMessagePre() {
    //
    this.apiHttpService.putMessage(this.place, this.messageForm.value)
      .subscribe((savedMessage) => {
        // console.log('[BRANCHEMENT-API] FormMessageComponent - putMessage - 2 ', savedMessage);
        // gestion retour vers le composant parent
        this.messageValidated.emit(savedMessage);
        this.requesting = false;
      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] FormMessageComponent - putAddress - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
    //
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.messageForm.controls;
  }

  hasErrorFromDateMin(): boolean {
    return (typeof this.f.validFrom.value !== 'string' || this.f.validFrom.value < this.minDateFrom);
  }
  // this.f.validFrom.errors = {min: true};
  hasErrorInconsistentDates(): boolean {
    return (typeof this.f.validFrom.value === 'string' && typeof this.f.validTo.value === 'string'
      && this.f.validTo.value < this.f.validFrom.value);
  }

  hasErrorMessageText(): boolean {
    const editor = this.getEditor();
    let wordsCounter = 0;
    if (editor) {
      wordsCounter = editor.plugins.wordcount.getCount();
      // console.log('[DEBUG] wordsCounter ', wordsCounter);
    }
    return (wordsCounter < this.minRequiredWordsCount);
  }

  getEditor() {
    return tinymce ? tinymce.get(this.editorUniqid) : null;
  }

  getTextTypeDelivery(itemDelivery): string {
    const typeDelivery = itemDelivery.sendingMail ? 'email' : 'view';
    return this.translateService.instant('Merchant.shop.message.modal.delivery.type.' + typeDelivery);
  }

  hasMailingError(itemDelivery): boolean {
    return itemDelivery.sendingMail && (typeof itemDelivery.sendingMailError === 'string' && itemDelivery.sendingMailError.trim() !== '');
  }

  getTextMailingError(itemDelivery): string {
    return this.hasMailingError(itemDelivery) ? this.translateService.instant('Merchant.shop.message.modal.delivery.type.email.error') : '';
  }

  getIconClassMailing(itemDelivery): string {
    return this.hasMailingError(itemDelivery) ? 'fa-exclamation-triangle' : 'fa-check-circle';
  }

  getTooltipTextMailingError(itemDelivery): string {
    return itemDelivery.sendingMail ? itemDelivery.sendingMailError : '';
  }

  showDeliveryReport() {
    // console.log('[DEBUG] controle avant ', (this.message ? this.message.id : 0));
    let specModalOptions = { ...this.modalOptions };
    specModalOptions.size = 'lg';
    specModalOptions.windowClass = 'modal-xxl';
    this.deliveryItems = null;
    this.reportLoading = true;

    this.modalService.open(this.modalDeliveryReport, specModalOptions).result.then((result) => {
      // console.log('[MODAL]  then() ', result);
    }, (reason) => {
      // dismiss
    });

    this.apiHttpService.getShopMessageDeliveries(this.place, this.message.id)
      .subscribe((result) => {
        // console.log('[BRANCHEMENT-API] FormMessageComponent - getShopMessageDeliveries - 1 ', result);
        this.deliveryItems = result;
        this.reportLoading = false;
      }, (error) => {
        this.reportLoading = false;
        // afficher l'erreur sur la page du form
        // console.warn('[API] FormMessageComponent - getShopMessageDeliveries - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  openConfirmModal(content) {
    this.modalService.open(content, this.modalOptions).result.then((result) => {
      if (result === 'confirm') {
        this.removeMessage();
      }
    }, (reason) => {});
  }

  removeMessage(): void {
    this.requesting = true;

    this.apiHttpService.deleteMessage(this.place, this.message)
      .subscribe((result) => {
        // console.log('[BRANCHEMENT-API] FormMessageComponent - deleteMessage - 1 ', result);
        this.requesting = false;
        // gestion retour vers le composant parent (MemberComponent)
        this.closeAfterRemoval.emit(true);

      }, (error) => {
        this.requesting = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] FormMessageComponent - deleteMessage - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
    //
  }

  ngOnDestroy():void {
    // retrieve the editor instance
    const editor = this.getEditor(); // tinymce.get(this.editorUniqid);
    if (editor) {
      tinymce.remove(editor);
      editor.destroy();
      //editor = null;
    }
  }
}
