import { Component, ElementRef } from '@angular/core';
import { Input, HostBinding } from '@angular/core';
import { Highlightable, FocusableOption } from '@angular/cdk/a11y';
import { LookingFor } from '../../../../model/lookingFor';

@Component({
  selector: 'app-lookingfor-item',
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
  template: `
    <div class="list-group-item list-group-item-action flex-column align-items-start item-selectable item-minimized-padding"
        [ngClass]="{'list-group-item-primary': active}" id="i-{{itemLookingFor.id}}" role="list-item" tabindex="-1">
        <div class="d-flex w-100 align-items-end">
            <div class="col-12 text-left no-padding-horizontally">
                <span class="float-left badge badge-secondary badge-pill table-badge-display">
                    {{ itemLookingFor.creationDate | date:'shortDate':undefined:locale }}
                </span>
                <small class="mb-1 ml-2">
                    {{ itemLookingFor.text }}
                </small>
            </div>
        </div>
    </div>
  `,
})
export class LookingForListItemComponent implements Highlightable, FocusableOption {
  @Input() itemLookingFor: LookingFor;
  @Input() locale: string;

  @HostBinding('class.active')
  public active = false;
  disabled: boolean;

  constructor(private element: ElementRef) {
  }

  focus() {
    // console.log('[LookingForListItemComponent] focus() ', this.element.nativeElement.textContent);
    this.setActiveStyles();
    this.element.nativeElement.focus();
  }

  click() {
    // console.log('[LookingForListItemComponent] click() ', this.element.nativeElement.textContent);
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

  public getNativeElement(): any {
    return this.element.nativeElement;
  }
}
