import { Component, OnInit } from '@angular/core';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AuthService } from '../../general/service/auth.service';
import { ApiHttpService } from '../../general/service/api.http.service';
import { AddOnTranslationService, appLocaleCodes } from '../../general/service/addOn.translation.service';
import { AppConfigService } from 'src/app/app.config.service';
import { MapComponentService } from 'src/app/modules/general/map/map.component.service';
import { User } from '../../../model/user';
import { Subscription, offerTypes } from '../../../model/subscription';
import { TranslateService } from '@ngx-translate/core';
import { registerLocaleData, formatDate } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

registerLocaleData(localeFr, appLocaleCodes.fr); // the second parameter 'fr-FR' is optional

const keyEnsureErrorDisplay = 'ensure-error-display';
const keyMessageTypeOffer = 'offer';
const keyMessageType = 'type';
const keyMessageText = 'text';
const keyMessageValid = 'validTo';
const keySubscriptionTry = 'try';
const lengthDateIsoFormat = 10; // 'AAAA-MM-JJ'

@Component({
  selector: 'app-member',
  templateUrl: './member.component.html',
  styleUrls: ['./member.component.css']
})
export class MemberComponent implements OnInit {

  locale: string;
  currentLangCode = '';
  userConnected: User = null;
  currentSubscription: Subscription = null;
  latestSubscription: Subscription = null;
  newSubscriptionAllowed = null; // will be determined by refreshFlagActionSubscribe()
  subscriptionToOrder: Subscription = null;
  nextSubscripDate = null;
  availableOffers: any;
  infoMessages = null;
  showInfoMessages = false;
  showWarningMessage = false;
  warningMessage = '';
  warningMessageStrong = '';
  warningMessageCloseable = false;
  successMessage = '';
  showSuccessMessage = false;
  nbPotentialLocalCustomers = 0;
  tooltipTextUsersFoundInVicinity = '';
  linkToOwnershipClaim = '';
  showUserPreferences = false;
  showUserInvoices = false;

  constructor(
    private translateService: TranslateService,
    public addonTranslator: AddOnTranslationService,
    private authService: AuthService,
    private apiHttpService: ApiHttpService,
    private mapService: MapComponentService,
    private configService: AppConfigService) { }

  ngOnInit(): void {
    this.currentLangCode = this.addonTranslator.getTranslationDefaultLang();
    this.locale = this.addonTranslator.getDeterminedLocale();

    if (this.apiHttpService.isOffline() || this.authService.shouldUserBeRefreshed()
      || this.authService.lastUserRefreshOutdated()) {
      // un petit rafraichissement est nécessaire
      this.apiHttpService.connectivityChecking()
        .subscribe(connectivityResult => { // nothing to do here (all is done on complete)
        }, errorToSkip => { // nothing to do
        }, () => {
          // Connectivity checking is complete => always follow with the api-me
          this.authService.apiMeObservable().subscribe(resultMe => {
            this.authService.setUserDataFromJson(resultMe);
            this.updateFromUserConnected();
            this.checkOfflineDuration();
          }, errorMe => {
            this.warningMessageStrong = '';
            this.warningMessage = errorMe.errorMessage;
            this.showWarningMessage = true;
            of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
              this.authService.checkTokenExpiration(errorMe, 1000, true);
            });
          });
        });

    } else {
      if (this.currentSubscription === null && this.latestSubscription === null) {
        this.updateFromUserConnected();
      }
    }
  }

  updateFromUserConnected(): void {
    this.userConnected = this.authService.userConnected;
    this.availableOffers = this.authService.currentOffers;
    this.nextSubscripDate = this.authService.nextSubscriptionDate;
    this.subscriptionToOrder = new Subscription('', '', this.nextSubscripDate, '', false);
    this.getSubscriptions();
    this.getMessagesToDeliver();

    this.apiHttpService.ownershipOpinion()
    .subscribe((resp) => {
      if (typeof resp.token === 'string' && resp.token.trim() !== '') {
        this.linkToOwnershipClaim = '/ownership/' + resp.token.trim();
      }
    }, (error) => {
      console.warn(error);
    });
  }

  checkOfflineDuration(): void {
    if (this.apiHttpService.isOffline() && this.authService.lastUserRefreshWithConnectivityOutdated()) {
      this.warningMessageStrong = 'Message.strong.alert';
      this.warningMessage = 'OffLine.duration.too.long.warning';
      this.showWarningMessage = true;
    }
  }

  isOfflineMode(): boolean {
    return this.apiHttpService.isOffline();
  }

  openPreferences() {
    this.showUserPreferences = true;
  }

  closePreferences() {
    this.showUserPreferences = false;
  }

  openInvoiceSearch() {
    this.currentLangCode = this.addonTranslator.getTranslationDefaultLang();
    this.showUserInvoices = true;
  }

  closeInvoiceSearch() {
    this.showUserInvoices = false;
  }

  getUserIri(): string {
    return this.userConnected ? this.userConnected.iri : '';
  }

  getTextLatestExpiredOrNot() {
    let textLatestTime = '';
    if (this.currentSubscription) {
      // the Latest follow the Current, so it is not expired
      textLatestTime = '' + this.latestSubscription.monthsDuration + ' '
        + this.translateService.instant('Member.subscrip.latest.number.months');
    } else {
      textLatestTime = this.translateService.instant('Member.subscrip.latest.expired');
    }
    return textLatestTime;
  }

  isLatestAlsoCurrentSubscription(): boolean {
    let latestAndCurrentAreTheSame = false;
    if (this.userConnected && typeof this.userConnected.idLatestSubscription === 'string'
      && typeof this.userConnected.idCurrentSubscription === 'string') {
        latestAndCurrentAreTheSame = (this.userConnected.idLatestSubscription === this.userConnected.idCurrentSubscription);
    }
    return latestAndCurrentAreTheSame;
  }

  getSubscriptions(): void {
    /**
     * Si userConnected.idLatestSubscription === userConnected.idCurrentSubscription
     *    il faut initialiser seulement currentSubscription (actif).
     */
    const latestSubscriptionAlsoCurrent = this.isLatestAlsoCurrentSubscription();

    if (this.userConnected && typeof this.userConnected.idLatestSubscription === 'string') {
      // appel API pour récupérer le dernier abonnement
      this.apiHttpService.getSubscription(this.userConnected.idLatestSubscription)
        .subscribe((subscrip) => {
          if (latestSubscriptionAlsoCurrent) {
            const dateNow = new Date().toISOString().substring(0, lengthDateIsoFormat);
            if (subscrip.endingDate.substring(0, lengthDateIsoFormat) >= dateNow) {
              // si le résultat de la requête api vient du cache, on peut se retrouver avec un faux CurrentSubscription,
              // d'où la nécessité du test précédent par rapport à dateNow
              this.currentSubscription = subscrip;
            }
          } else {
            this.latestSubscription = subscrip;
          }
          this.refreshFlagActionSubscribe();
        }, (error) => {
          this.warningMessageStrong = '';
          this.warningMessage = error.errorMessage;
          this.showWarningMessage = true;
          of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
            this.authService.checkTokenExpiration(error, 1000, true);
          });
        });
    } else {
      if (this.userConnected) {
        this.refreshFlagActionSubscribe();
      }
    }

    if (this.userConnected && typeof this.userConnected.idCurrentSubscription === 'string') {
      if (latestSubscriptionAlsoCurrent) {
        // this.authService.activeUserSubscription = true; --> le nécessaire est fait dans this.refreshFlagActionSubscribe()
      } else {
        // appel API pour récupérer l'abonnement en cours (si différent du dernier)
        this.apiHttpService.getSubscription(this.userConnected.idCurrentSubscription)
          .subscribe((subscrip) => {
            this.currentSubscription = subscrip;
            // this.authService.activeUserSubscription = true; --> le nécessaire est fait dans this.refreshFlagActionSubscribe()
            this.refreshFlagActionSubscribe();
          }, (error) => {
            this.warningMessageStrong = '';
            this.warningMessage = error.errorMessage;
            this.showWarningMessage = true;
            of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
              this.authService.checkTokenExpiration(error, 1000, true);
            });
          });
      }
    }
  }

  refreshFlagActionSubscribe(): boolean {
    /*
     * Pour activer le composant SubscriptionOrder, mettre newSubscriptionAllowed à true.
     * Ne pas activer dans les conditions suivantes :
     *      * il n'existe pas d'offre disponible (dans this.availableOffers),
     *      * il y a déjà un Current + un Latest (distincts),
     *      * il reste plus de 10 jours de validité sur le Current.
    */
    let noSubscriptionYet = true;
    let newSubscriptionAllowed = true;

    if (this.userConnected ) {
      if (this.hasMerchantSubscription()) {
        this.authService.userConnected.merchantSubscriber = true;
        this.retrieveNumberOfUsersAroundAddress();
      }

      const hasLatestSubscription = (typeof this.userConnected.idLatestSubscription === 'string');
      const hasCurrentSubscription = (typeof this.userConnected.idCurrentSubscription === 'string');
      if (hasLatestSubscription || hasCurrentSubscription) {
        noSubscriptionYet = false;
      }

      if (noSubscriptionYet) {
        if (this.userConnected.numberDaysSinceCreation < 31) {
          const dateNow = new Date().toISOString().substring(0, lengthDateIsoFormat);
          // permettre au nouveau user de découvrir l'appli sans avoir à s'abonner (le 1er mois seulement)
          this.currentSubscription = new Subscription(keySubscriptionTry, '', dateNow, '', true);
          this.currentSubscription.type === offerTypes[0];
          this.currentSubscription.numberDaysLeft = Math.min(10, (31 - this.userConnected.numberDaysSinceCreation));
          this.authService.activeUserSubscription = true;
        }
      } else {
        if (hasLatestSubscription && hasCurrentSubscription &&
          this.userConnected.idLatestSubscription !== this.userConnected.idCurrentSubscription) {
          newSubscriptionAllowed = false;
        } else {
          if (this.currentSubscription && this.currentSubscription.numberDaysLeft > 10) {
            newSubscriptionAllowed = false;
          }
        }

        if (this.currentSubscription && this.currentSubscription.paymentValidated) {
          this.authService.activeUserSubscription = true;
        }
      }
    }

    // de plus, la souscription d'un abonnement requiert une connection
    this.newSubscriptionAllowed = newSubscriptionAllowed && !this.apiHttpService.isOffline();

    this.checkMessages();

    return newSubscriptionAllowed;
  }

  isCurrentTrialOffer(): boolean {
    return (this.currentSubscription && this.currentSubscription.id === keySubscriptionTry);
  }

  getCurrentSubcriptionTitle(): string {
    let currentSubcriptionText = this.currentSubscription.paymentValidated ? 'Member.subscrip.current.title' : 'Member.subscrip.waiting.for.payment';
    
    if (this.isCurrentTrialOffer()) {
      currentSubcriptionText = 'Member.subscrip.current.try.title';
    }

    return currentSubcriptionText;
  }

  checkMessages(): void {
    if (this.infoMessages && this.infoMessages.length // initialized by getMessagesToDeliver()
      && this.newSubscriptionAllowed !== null // initialized (true|false) by refreshFlagActionSubscribe()
    ) {
      this.filterMessagesTypeOffer();
    }
  }

  getMessagesToDeliver(): void {
    this.apiHttpService.getPendingMessages()
      .subscribe((messages) => {
        this.infoMessages = messages;
        this.checkMessages();
      }, (error) => {
        this.warningMessageStrong = '';
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      });
  }

  filterMessagesTypeOffer(): void {
    const listMessagesToDisplay = [];
    if (!this.newSubscriptionAllowed && this.infoMessages && this.infoMessages.length) {
      for (let i = 0, len = this.infoMessages.length; i < len; i++) {
        if (this.infoMessages[i].hasOwnProperty(keyMessageType) && this.infoMessages[i][keyMessageType] === keyMessageTypeOffer) {
          // message to ignore
        } else {
          // message to display
          listMessagesToDisplay.push(this.infoMessages[i]);
        }
      }
      this.infoMessages = listMessagesToDisplay; // new filtered list
    }

    if (this.infoMessages && this.infoMessages.length) {
      this.showInfoMessages = true; // pour affichage infoMessages dans la vue
    }
  }

  refreshSubscriptionsWithOrdered(orderedSubscription: Subscription): void {
    if (this.currentSubscription && !this.isCurrentTrialOffer()) {
      // le nouvel abonnement prend la place du Latest
      this.latestSubscription = orderedSubscription;
      if (this.userConnected) {
        this.userConnected.idLatestSubscription = '' + orderedSubscription.id;
      }
    } else {
      // le nouvel abonnement devient le Current
      this.currentSubscription = orderedSubscription;
      if (orderedSubscription.paymentValidated) {
        this.authService.activeUserSubscription = true;
      }
      if (this.userConnected) {
        this.userConnected.idCurrentSubscription = '' + orderedSubscription.id;
        this.userConnected.idLatestSubscription = this.userConnected.idCurrentSubscription;
      }
      // l'ancien Latest n'est plus le dernier
      this.latestSubscription = null;
    }
    this.newSubscriptionAllowed = false;
    if (orderedSubscription.paymentValidated) {
      this.successMessage = 'Member.subscrip.component.submit.order.success';
    } else {
      this.successMessage = 'Member.subscrip.component.submit.order.waiting.payment';
    }

    this.showSuccessMessage = true;
  }

  hasMerchantSubscription(): boolean {
    return (this.currentSubscription && this.currentSubscription.type === offerTypes[1]);
  }

  retrieveNumberOfUsersAroundAddress(): void {
    this.apiHttpService.getUsersDataAroundAddress(this.userConnected.addressId, true)
    .subscribe((dataUsers) => {
      let nbLocalCustomers = 0;
      const startingPoint = { latitude: this.userConnected.latitude, longitude: this.userConnected.longitude };
      const distanceMax = (this.configService.config.heerApiRadius + this.configService.config.toleranceMargin);
      for (const localCustomer of dataUsers) {
        if (localCustomer.email !== this.userConnected.email && typeof localCustomer.coords === 'object') {
          // calculer la distance entre startingPoint et ces coords (latitude, longitude)
          const distance = this.mapService.getDistanceBetweenTwoPoints(startingPoint, localCustomer.coords);
          if (distance <= distanceMax) {
            nbLocalCustomers++;
          }
        }
      }
      this.tooltipTextUsersFoundInVicinity = nbLocalCustomers + ' '
        + this.translateService.instant('Member.users.potential.customers.tooltip.text');
      this.nbPotentialLocalCustomers = nbLocalCustomers;
    }, (error) => {
      of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
        this.authService.checkTokenExpiration(error, 1000, true);
      });
    });
  }

  secondaryPageShown(): boolean {
    return this.showUserPreferences || this.showUserInvoices;
  }
}
