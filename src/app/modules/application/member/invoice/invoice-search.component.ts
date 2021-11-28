import { Component, OnInit, Input, Output, EventEmitter, ViewChild, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NgbModal, NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ApiHttpService } from '../../../general/service/api.http.service';
import { AuthService } from '../../../general/service/auth.service';
import { User } from '../../../../model/user';
import { Address } from 'src/app/model/address';

const keyEnsureErrorDisplay = 'ensure-error-display';
const pdfFileExtension = 'pdf';

@Component({
  selector: 'app-invoice-search',
  templateUrl: './invoice-search.component.html',
  styleUrls: ['./invoice-search.component.css']
})
export class InvoiceSearchComponent implements OnInit {

  @Input() user: User;
  @Input() languageCode: string;
  @Input() locale: string;
  @Output() closeChildComponent = new EventEmitter<boolean>();

  @ViewChild('modalInvoiceDownload') modalInvoiceDownload: any;
  //@ViewChild('invoiceDownloadLink') invoiceDownloadLink: any;

  targetYear: string;
  warningMessage = '';
  showWarningMessage = false;
  loadingAddresses = false;
  requesting = false;
  searchResult: any[];
  selectedInvoice: any;
  downloadModalType: string;
  downloading = false;
  userAddresses: Address[];
  modalOptions: NgbModalOptions;
  modalOpenRef: NgbModalRef;
  readonly fixCurrencySymbol = '€';
  downloadFileName: string;
  downloadFileUrl: SafeResourceUrl;

  constructor(
    private modalService: NgbModal,
    private sanitizer: DomSanitizer,
    private authService: AuthService,
    private apiHttpService: ApiHttpService,
    @Inject(DOCUMENT) private document: Document
    ) {
    this.downloadFileUrl = null;
    this.downloadFileName = null;
    this.searchResult = null;
    this.modalOpenRef = null;
    this.modalOptions = {
      backdrop: 'static',
      backdropClass: 'customBackdrop'
    };
  }

  ngOnInit(): void {
    const idUser = this.user ? this.apiHttpService.getIdFromIri(this.user.iri) : '0';
    this.targetYear = (new Date()).getFullYear() + ''; // année en cours par défaut
    this.selectedInvoice = null;
    this.downloadModalType = '';
    // appel API pour récupérer les adressses du user
    this.loadingAddresses = true;
    this.apiHttpService.getUserAddresses(idUser)
      .subscribe((arrayAddresses) => {
        this.userAddresses = arrayAddresses;
        this.loadingAddresses = false;
      }, (error) => {
        // console.warn('[API] getUserAddresses returns error ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.loadingAddresses = false;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  yearTargeted(): boolean {
    return (this.targetYear.trim() !== '' && this.targetYear.length === 4);
  }

  searchInvoices() {
    if (this.yearTargeted()) {

      this.searchResult = [];
      this.requesting = true;

      this.apiHttpService.getUserInvoices(this.targetYear, this.languageCode)
        .subscribe((userInvoices) => {
          this.searchResult = userInvoices;
          this.requesting = false;
        }, (error) => {
          //console.warn('[API] getUserInvoices - 9 ', error);
          this.warningMessage = error.errorMessage;
          this.showWarningMessage = true;
          this.requesting = false;
          of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
            this.authService.checkTokenExpiration(error, 1000, true);
          });
        });
    }
  }

  backToParent(): void {
    if (this.modalOpenRef) {
      this.modalOpenRef.close('close');
    }
    this.closeChildComponent.emit(true);
  }

  isSelectionCompleted(): boolean {
    if (!this.selectedInvoice || !this.selectedInvoice.customName || !this.selectedInvoice.customAid) {
      return false;
    }
    const nameValid = this.selectedInvoice.customName.trim() !== '' && this.selectedInvoice.customName.length > 2;
    const addressValid = this.selectedInvoice.customAid.trim() !== '' && this.selectedInvoice.customAid.trim() !== '0';
    return nameValid && addressValid;
  }

  downloadPdf(invoiceItem: any): void {
    // console.log('[DEBUG] downloadPdf() - 01 ', invoiceItem);
    let specModalOptions = { ...this.modalOptions };
    specModalOptions.size = 'lg';
    specModalOptions.windowClass = 'modal-xxl';
    specModalOptions.scrollable = true;

    this.selectedInvoice = invoiceItem;
    this.selectedInvoice.customName = this.user.firstName + ' ' + this.user.lastName;
    const downloadType = invoiceItem.first ? 'first' : 'direct';
    this.downloadModalType = 'Member.invoice.modal.download.'+ downloadType + '.title';

    this.modalOpenRef = this.modalService.open(this.modalInvoiceDownload, specModalOptions);
    this.modalOpenRef.result.then((result) => {
      // if (result === 'confirm') {
      //   this.doPdfDownload();
      // }
    }, (reason) => {
      // dismiss
      this.modalOpenRef = null;
    });

    if (!this.selectedInvoice.first) {
      // ce document a déjà été téléchargé (ré-édition)
      this.selectedInvoice.customName = null;
      this.selectedInvoice.customAid = null;
      this.doPdfDownload(); // lancer directement le téléchargement
    }
  }

  doPdfDownload(): void {
    // console.log('[DEBUG] doPdfDownload() - 01 ', this.selectedInvoice);
    this.downloading = true;
    // appel API de téléchargement de facture
    const invoiceDownloadBody = {
      customName: this.selectedInvoice.customName,
      customAid: this.selectedInvoice.customAid
    };
    this.apiHttpService.postInvoiceDownload(this.selectedInvoice.sid, invoiceDownloadBody)
      .subscribe(
        (data: Blob) => {
          const file = new Blob([data], {type: 'application/' + pdfFileExtension})
          this.downloadFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(file));
          this.downloadFileName = this.selectedInvoice.invoiceNumber + '.' + pdfFileExtension;
          const linkElement = this.document.getElementById('idownlink');
          of(pdfFileExtension).pipe(delay(400)).subscribe(value => {
            // console.log('[DEBUG] #', .invoiceDownloadLink.nativeElement.download, .invoiceDownloadLink.nativeElement.href);
            //this.invoiceDownloadLink.nativeElement.click();
            linkElement.click();
            this.downloading = false;
            this.selectedInvoice.first = false;
            if (this.modalOpenRef) {
              this.modalOpenRef.close('close'); // modal.close('confirm')
            }
          });
        },
        (error) => {
          // console.warn('[API] postInvoiceDownload error : ', error);
          this.warningMessage = error.errorMessage;
          this.showWarningMessage = true;
          this.downloading = false;
          if (this.modalOpenRef) {
            this.modalOpenRef.close('close');
          }
          of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
            this.authService.checkTokenExpiration(error, 1000, true);
          });
        }
      );
  }

}
