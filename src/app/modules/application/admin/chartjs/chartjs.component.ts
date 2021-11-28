import { Component, OnInit } from '@angular/core';
import { ChartOptions, ChartType, ChartDataSets } from 'chart.js';
import { Color, BaseChartDirective, Label } from 'ng2-charts';
import { ApiHttpService } from '../../../general/service/api.http.service';

@Component({
  selector: 'app-chartjs',
  templateUrl: './chartjs.component.html',
  styleUrls: ['./chartjs.component.css']
})
export class ChartjsComponent implements OnInit {

  public type: ChartType = 'bar';

  public labels: Label[] = ['Users', 'Countries', 'Orders', 'Cities', 'Addresses'];

  public datasets: ChartDataSets[] = [
    {
      label: 'Counters',
      data: [],
      backgroundColor: [
        'rgba(255, 99, 132, 0.2)',
        'rgba(54, 162, 235, 0.2)',
        'rgba(255, 206, 86, 0.2)',
        'rgba(75, 192, 192, 0.2)',
        //'rgba(153, 102, 255, 0.2)',
        'rgba(255, 159, 64, 0.2)'
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(75, 192, 192, 1)',
        //'rgba(153, 102, 255, 1)',
        'rgba(255, 159, 64, 1)'
      ],
      borderWidth: 1
    }];

  public options: ChartOptions = {
    scales: {
      yAxes: [{
        ticks: {
          beginAtZero: true
        }
      }]
    }
  };

  constructor(private apiHttpService: ApiHttpService) { }

  ngOnInit(): void {
    this.apiHttpService.getStatsCounters()
      .subscribe((statsData) => {
        // console.log('[DEBUG] stats data ', statsData);
        this.datasets[0].data.push(statsData['nbUsers']);
        this.datasets[0].data.push(statsData['nbCountries']);
        this.datasets[0].data.push(statsData['nbOrders']);
        this.datasets[0].data.push(statsData['nbCities']);
        this.datasets[0].data.push(statsData['nbAddresses']);
      },
      (error) => {
        console.warn(error);
        //this.dataLoading = false;
      });
  }

}
