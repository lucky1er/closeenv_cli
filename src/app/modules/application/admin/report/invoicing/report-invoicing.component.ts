import { Component, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ApiHttpService } from '../../../../general/service/api.http.service';
import { appLocaleCodes } from '../../../../general/service/addOn.translation.service';
//import { registerLocaleData } from '@angular/common';
//import localeFr from '@angular/common/locales/fr';
//registerLocaleData(localeFr, appLocaleCodes.fr); // the second parameter 'fr-FR' is optional

const pdfFileExtension = 'pdf';
//const keyEnsureErrorDisplay = 'ensure-error-display';

@Component({
  selector: 'app-report-invoicing',
  templateUrl: './report-invoicing.component.html',
  styleUrls: ['./report-invoicing.component.css']
})
export class ReportInvoicingComponent implements OnInit {

  @ViewChild('invoiceDownloadLink') invoiceDownloadLink: any;

  locale = appLocaleCodes.fr;
  warningMessage = '';
  showWarningMessage = false;
  dataLoading = false;
  targetYear: string;
  invoicingByPeriod: any[];
  grandTotal: number;
  showDetail = false;
  invoicingPeriodDetails: any[];
  downloading = false;
  downloadFileName: string;
  downloadFileUrl: SafeResourceUrl;

  constructor(
    private sanitizer: DomSanitizer,
    private apiHttpService: ApiHttpService) { }

  ngOnInit(): void {
    this.targetYear = (new Date()).getFullYear() + ''; // année en cours par défaut
    this.getReportData();
  }

  yearTargeted(): boolean {
    return (this.targetYear.trim() !== '' && this.targetYear.length === 4);
  }

  getReportData() {
    /*--*/
    if (!this.yearTargeted()) {
      return ;
    }
    /*--*/
    this.dataLoading = true;
    this.apiHttpService.getReportInvoicing(this.targetYear)
      .subscribe((invoicingData) => {
        this.invoicingByPeriod = invoicingData;
        // console.log('[DEBUG] invoicingByPeriod ', this.invoicingByPeriod);
        this.dataLoading = false;
      },
      (error) => {
        // console.warn(error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.dataLoading = false;
      });
    /*--*/
  }

  isYearCumulationItem(item): boolean {
    return item.per.startsWith('Cumul');
  }

  isPeriodArchiveNull(item): boolean {
    return (item.archiveStatus === null);
  }

  isPeriodArchiveZero(item): boolean {
    return (item.archiveStatus === 0);
  }

  isPeriodArchiveRequested(item): boolean {
    return (item.archiveStatus === 1);
  }

  isPeriodArchiveExisting(item): boolean {
    return (item.archiveStatus === 2);
  }

  reqArchiveInvoicingPeriod(item) {
    if (!this.isPeriodArchiveZero(item)) {
      return ;
    }

    this.apiHttpService.getInvoicingPeriodArchivingRequest(item.per)
      .subscribe((archivingReq) => {
        // console.log('[DEBUG] reqArchiveInvoicingPeriod - retour ', archivingReq);
        item.archiveStatus = 1;
      },
      (error) => {
        // console.warn(error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.dataLoading = false;
      });
  }

  getInvoicingDetail(invoicingPeriod: string) {
    this.invoicingPeriodDetails = null;
    this.dataLoading = true;
    this.showDetail = true;
    this.apiHttpService.getReportInvoicingDetail(invoicingPeriod)
      .subscribe((invoicingDetails) => {
        this.invoicingPeriodDetails = invoicingDetails;
        // console.log('[DEBUG] invoicingPeriodDetails ', this.invoicingPeriodDetails);
        this.dataLoading = false;
      },
      (error) => {
        // console.warn(error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.dataLoading = false;
      });
  }

  doPdfDownload(invoiceItem: any): void {
    // console.log('[DEBUG] doPdfDownload() - 01 ', this.selectedInvoice);
    this.downloading = true;
    // appel API de téléchargement de facture
    this.apiHttpService.postInvoiceDownload(invoiceItem.sid, {customName: null, customAid: null})
      .subscribe(
        (data: Blob) => {
          const file = new Blob([data], {type: 'application/' + pdfFileExtension})
          this.downloadFileUrl = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(file));
          this.downloadFileName = invoiceItem.invoiceNumber + '.' + pdfFileExtension;
          //const linkElement = this.document.getElementById('idownlink');
          of(pdfFileExtension).pipe(delay(400)).subscribe(value => {
            // console.log('[DEBUG] #', .invoiceDownloadLink.nativeElement.download, .invoiceDownloadLink.nativeElement.href);
            this.invoiceDownloadLink.nativeElement.click();
            //linkElement.click();
            this.downloading = false;
          });
        },
        (error) => {
          // console.warn('[API] postInvoiceDownload error : ', error);
          this.warningMessage = error.errorMessage;
          this.showWarningMessage = true;
          this.downloading = false;
          //of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          //  this.authService.checkTokenExpiration(error, 1000, true);
          //});
        }
      );
  }

  backToAggregates() {
    this.showDetail = false;
  }

  //backToParent(): void {
  //  this.closeChildComponent.emit(true);
  //}

}
