import { Component, ElementRef, HostBinding, Input, Output, EventEmitter } from '@angular/core';
import { Highlightable, FocusableOption } from '@angular/cdk/a11y';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AuthService } from 'src/app/modules/general/service/auth.service';
import { ApiHttpService } from 'src/app/modules/general/service/api.http.service';
import { LookingFor } from '../../../../model/lookingFor';

const keyEnsureErrorDisplay = 'ensure-error-display';

@Component({
  selector: 'app-list-item-lookingfor',
  styles: [`
    .color-msg-info {color: darkgreen}
    .color-trash {color: orangered}
    .color-flag {color: darkgoldenrod}
    .table-badge-display {
      display: inline-table;
      font-weight: normal;
    }
    .btn-action-enabled {
      color: #007bff;
      cursor: pointer;
    }
    .btn-action-disabled {
      color: lightslategray;
      cursor: not-allowed;
    }
    .no-padding-horizontally {
      padding-right: 0;
      padding-left: 0;
    }
    .just-little-left-padding {
      padding-right: 0;
      padding-left: 5px;
    }
    .just-little-right-padding {
      padding-right: 0.3rem;
      padding-left: 0.4rem;
    }
    .item-minimized-padding {
      padding-top: 0.25rem;
      padding-right: 0.5rem;
      padding-bottom: 0.25rem;
      padding-left: 0.5rem;
    }
  `],
  template: `
    <div class="list-group-item list-group-item-action flex-column align-items-start item-selectable item-minimized-padding"
        [ngClass]="{'list-group-item-primary': active}" id="i-{{itemLookingFor.id}}" role="list-item" tabindex="-1">
        <div class="d-flex w-100 justify-content-between">
            <div class="col-2 col-sm-4 col-md-2 text-left just-little-right-padding">
                <small>{{ itemLookingFor.creationDate | date:'shortDate':undefined:locale }}&nbsp;</small>
            </div>
            <div class="col-9 col-sm-7 col-md-9 text-left just-little-left-padding"><small>{{ itemLookingFor.text }}</small></div>
            <div class="col-1 col-sm-1 col-md-1 no-padding-horizontally">
                <small [hidden]="isItemFromCurrentUser(itemLookingFor)">
                  <!-- un bouton pour passer le message en "unwanted", si ne l'est pas déjà -->
                    <i [hidden]="itemLookingFor.isUserUnwanted" class="fas fa-trash-alt fa-2x "
                      [ngClass]="{'btn-action-enabled': !isOfflineMode(), 'btn-action-disabled': isOfflineMode()}"
                      (click)="itemToggleUnwanted(itemLookingFor)">&nbsp;
                    </i>
                  <!-- un bouton pour annuler le flag "unwanted", s'i est true -->
                    <i [hidden]="!itemLookingFor.isUserUnwanted" class="fas fa-trash-restore-alt fa-2x "
                      [ngClass]="{'btn-action-enabled': !isOfflineMode(), 'btn-action-disabled': isOfflineMode()}"
                      (click)="itemToggleUnwanted(itemLookingFor)">&nbsp;
                    </i>
                  <!-- un bouton pour ouvrir la modale de réponse au message, si pas déjà répondu -->
                    <i [hidden]="itemLookingFor.answer" class="fas fa-reply fa-2x "
                      [ngClass]="{'btn-action-enabled': !isOfflineMode(), 'btn-action-disabled': isOfflineMode()}"
                      (click)="selectForAnswer(itemLookingFor)">
                    </i>
                  <!-- un bouton pour voir la réponse déjà existante -->
                    <i [hidden]="!itemLookingFor.answer" class="fas fa-envelope-open-text fa-2x btn-action-enabled"
                      (click)="selectForAnswer(itemLookingFor)">
                    </i>
                </small>
                <small [hidden]="!isItemFromCurrentUser(itemLookingFor)">
                    <i class="fas fa-share fa-2x btn-action-disabled"></i>
                </small>
            </div>
        </div>
    </div>
  `,
})
export class ListItemLookingForComponent implements Highlightable, FocusableOption {
  @Input() itemLookingFor: LookingFor;
  @Input() currentUserId: string;
  @Input() locale: string;
  @Output() statusChanged = new EventEmitter<boolean>();
  @Output() selectedToAnswer = new EventEmitter<LookingFor>();

  @HostBinding('class.active')
  public active = false;
  disabled: boolean;

  constructor(
    private element: ElementRef,
    private authService: AuthService,
    private apiHttpService: ApiHttpService
    ) {
  }

  isOfflineMode(): boolean {
    return this.apiHttpService.isOffline();
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

  public isItemFromCurrentUser(item: LookingFor): boolean {
    return (item.userId+'' === this.currentUserId+'');
  }

  public itemToggleUnwanted(item: LookingFor): void {
    if (this.isOfflineMode()) {
      return ;
    }

    this.apiHttpService.toggleLookingForUnwanted(item.id)
      .subscribe((flag) => {
        item.isUserUnwanted = flag;
        this.statusChanged.emit(true); // parent have to refresh filter
      }, (error) => {
        console.warn('[API] toggleLookingForUnwanted() returns error ', error);
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  public selectForAnswer(item: LookingFor): void {
    if (!this.isOfflineMode() || item.answer) {
      this.selectedToAnswer.emit(item);
    }
  }
}
