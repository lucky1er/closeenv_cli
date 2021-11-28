import { Component, ElementRef } from '@angular/core';
import { Input, HostBinding } from '@angular/core';
import { Highlightable, FocusableOption } from '@angular/cdk/a11y';
import { Place } from 'src/app/model/place';

@Component({
  selector: 'app-place-item',
  styles: [`
    .color-msg-info {color: darkgreen}
    .color-trash {color: orangered}
    .color-flag {color: darkgoldenrod}
    .table-badge-display {
      display: inline-table;
      font-weight: normal;
    }
    .item-minimized-padding {
      padding-right: 0.5rem;
      padding-left: 0.5rem;
    }
    .no-padding-horizontally {
      padding-left: 0;
      padding-right: 0;
    }
  `],
  //host: { tabindex: '-1' },
  template: `
    <div class="list-group-item list-group-item-action flex-column align-items-start item-selectable item-minimized-padding"
        [ngClass]="{'list-group-item-primary': active}" id="i-{{itemPlace.id}}" role="list-item" tabindex="-1">
        <div class="d-flex w-100 align-items-end ">
            <div class="col-12 text-left no-padding-horizontally">
                <i *ngIf="itemPlace.popupMessage" class="fas fa-info-circle color-msg-info"></i>
                <small class="mb-1">
                    <i *ngIf="itemPlace.logicalRemoval" class="fas fa-trash-alt color-trash"></i>
                    <i *ngIf="!itemPlace.logicalRemoval && itemPlace.flags.length" class="fas fa-flag-checkered color-flag"></i>
                    {{ getLabel() }}
                </small>
                <span class="float-right badge badge-secondary badge-pill table-badge-display">{{ getKilometDistance() }}</span>
            </div>
        </div>
    </div>
  `,
})
export class PlaceItemComponent implements Highlightable, FocusableOption {
  @Input() itemPlace: Place;

  @HostBinding('class.active')
  public active = false;
  disabled: boolean;

  constructor(private element: ElementRef) {
  }

  focus() {
    // console.log('[PlaceItemComponent] focus() ', this.element.nativeElement.textContent);
    this.setActiveStyles();
    this.element.nativeElement.focus();
  }

  click() {
    // console.log('[PlaceItemComponent] click() ', this.element.nativeElement.textContent);
    this.element.nativeElement.click();
  }

  public setActiveStyles(): void {
    this.active = true;
    this.element.nativeElement.setAttribute('tabindex', '0');
  }

  public setInactiveStyles(): void {
    this.active = false;
    this.element.nativeElement.setAttribute('tabindex', '-1');
  }

  public getLabel(): string {
    return this.itemPlace.title + ', ' + this.itemPlace.address;
  }

  public getKilometDistance(): string {
    const kmDist = this.itemPlace.distance / 1000;
    return kmDist.toFixed(3) + ' km';
  }

  public getNativeElement(): any {
    return this.element.nativeElement;
  }
}
