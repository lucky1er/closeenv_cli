import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
//import { of } from 'rxjs';
//import { delay } from 'rxjs/operators';
import { ApiHttpService } from '../../../../general/service/api.http.service';

@Component({
  selector: 'app-report-users',
  templateUrl: './report-users.component.html',
  styleUrls: ['./report-users.component.css']
})
export class ReportUsersComponent implements OnInit {

  //@Input() user: User;
  //@Output() closeChildComponent = new EventEmitter<boolean>();

  warningMessage = '';
  showWarningMessage = false;
  dataLoading = false;
  countriesList: any[];
  targetCountry: string;
  usersCountByCity: any[];
  //grandTotal: number;

  constructor(
    private apiHttpService: ApiHttpService) { }

  ngOnInit(): void {
    this.countriesList = null;
    this.getListOfCountries();
  }

  getListOfCountries() {
    this.dataLoading = true;
    this.apiHttpService.getCountriesForUsersReport()
      .subscribe((countriesData) => {
        this.countriesList = countriesData;
        // console.log('[DEBUG] countries ', this.countriesList);
        this.dataLoading = false;
      },
      (error) => {
        // console.warn(error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        this.dataLoading = false;
      });
  }

  getReportData() {
    if (!this.countryTargeted()) {
      return ;
    }
    /*--*/
    this.dataLoading = true;
    this.apiHttpService.getReportUsers(this.targetCountry)
      .subscribe((usersData) => {
        this.usersCountByCity = usersData;
        // console.log('[DEBUG] usersCountByCity ', this.usersCountByCity);
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

  countryTargeted(): boolean {
    return (this.targetCountry && this.targetCountry.trim() !== '' && this.targetCountry.length > 1);
  }

  //backToParent(): void {
  //  this.closeChildComponent.emit(true);
  //}

}
