import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ApiHttpService } from '../../../general/service/api.http.service';
import { User } from '../../../../model/user';

@Component({
  selector: 'app-preferences',
  templateUrl: './preferences.component.html',
  styleUrls: ['./preferences.component.css']
})
export class PreferencesComponent {

  @Input() user: User;
  @Output() closeChildComponent = new EventEmitter<boolean>();

  @ViewChild('userDownloadLink') userDownloadLink: any;

  userDataLoading = false;
  userDataFilename = '';
  userDataDownloadURL: SafeResourceUrl;

  constructor(
    private sanitizer: DomSanitizer,
    private apiHttpService: ApiHttpService) { }

  getUserData() {
    if (this.user) {
      this.userDataLoading = true;
      const userApiGen = '/api/users/';
      const apiGetUser = this.user.iri.substring(this.user.iri.indexOf(userApiGen));
      const jsonFileName = apiGetUser.replace(userApiGen, 'user-data') + '.json';
      this.apiHttpService.getUserData(apiGetUser)
        .subscribe((userData) => {
          // creating a blob object from json data
          const blob:any = new Blob([ JSON.stringify(userData) ], { type: 'application/json' });
          this.userDataDownloadURL = this.sanitizer.bypassSecurityTrustResourceUrl(window.URL.createObjectURL(blob));
          this.userDataFilename = jsonFileName;
          of(jsonFileName).pipe(delay(500)).subscribe(value => {
            this.userDownloadLink.nativeElement.click();
          });
          this.userDataLoading = false;
        },
        (error) => {
          console.warn(error);
          this.userDataLoading = false;
        },
        () => {
          // console.log('End of user-data loading');
        });
    }
  }

  updateFlagEmailFromMerchant() {
    const userId = this.apiHttpService.getIdFromIri(this.user.iri);
    this.apiHttpService.updateUser(userId, {emailFromMerchant: this.user.emailFromMerchant})
      .subscribe((patchedUser) => {
        }, (error) => {
          console.warn('updateUser - 9 ', error);
      });
  }

  updateFlagEmailFromAsso() {
    const userId = this.apiHttpService.getIdFromIri(this.user.iri);
    this.apiHttpService.updateUser(userId, {emailFromAsso: this.user.emailFromAsso})
      .subscribe((patchedUser) => {
        }, (error) => {
          console.warn('updateUser - 9 ', error);
      });
  }

  updateFlagEmailSiteNews() {
    const userId = this.apiHttpService.getIdFromIri(this.user.iri);
    this.apiHttpService.updateUser(userId, {emailSiteNews: this.user.emailSiteNews})
      .subscribe((patchedUser) => {
        }, (error) => {
          console.warn('updateUser - 9 ', error);
      });
  }

  backToParent(): void {
    this.closeChildComponent.emit(true);
  }

}
