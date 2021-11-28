import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { formatNumber } from '@angular/common';
import { of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Subscription, offerTypes } from '../../../../model/subscription';
import { AddOnTranslationService } from '../../../general/service/addOn.translation.service';
import { AppConfigService } from 'src/app/app.config.service';
import { ApiHttpService } from '../../../general/service/api.http.service';
import { AuthService } from '../../../general/service/auth.service';
import { ExternalScriptService } from '../../../general/service/external.script.service';
import { User } from '../../../../model/user';

declare let paypal: any; // cf. https://www.ngdevelop.tech/loading-external-libraries-from-cdn-in-angular-application/

const ppLangCode = 'en';
const orderLabelPrefix = 'Subscription';
const fixCurrencyCode = 'EUR';
const euroCurrency = ['euro', 'euros']; // 0:singular, 1:plural
const keyEnsureErrorDisplay = 'ensure-error-display';

@Component({
  selector: 'app-subscription-order',
  templateUrl: './subscription-order.component.html',
  styleUrls: ['./subscription-order.component.css']
})
export class SubscriptionOrderComponent implements OnInit {

  @Input() userIri: string;
  @Input() userInfos: User;
  @Input() offers: any;
  @Input() newSubscription: Subscription;
  @Input() locale: string;
  @Input() languageCode: string;
  @Output() newSubscriptionValidated = new EventEmitter<Subscription>();
  @ViewChild('ppButtonContainer') paypalElement: any;
  displayFormError = false;
  displayCheckError = false;
  checkSellingTerms = false;
  loading = false;
  successMessage = '';
  showSuccessMessage = false;
  warningMessage = '';
  showWarningMessage = false;
  orderPaymentProcessing = false;
  mandatoryCheckFrozen = false;

  constructor(
    public addonTranslator: AddOnTranslationService,
    private authService: AuthService,
    private apiHttpService: ApiHttpService,
    private configService: AppConfigService,
    private extScriptService: ExternalScriptService) {
  }

  ngOnInit(): void {
    this.apiHttpService.connectivityChecking()
      .subscribe(connectivityResult => {
        if (connectivityResult) {
          // seulement si connectivité effective
          this.apiHttpService.getContextApp()
          .subscribe((contextApp: any) => {
            // console.log('[DEBUG]  getContextApp() ', contextApp.env);
            // Dynamically Loading External Library from CDN
            // cf. https://www.ngdevelop.tech/loading-external-libraries-from-cdn-in-angular-application/
            this.extScriptService.initScripts(contextApp.env);
            this.extScriptService.loadScript('paypal');
          }, (error) => {
            console.warn('Initialization error for payment module ', error);
          });
        }
      }, errorToSkip => { // nothing to do
      });
  }

  activatedMerchant(): boolean {
    // Merchant features not yet implemented
    return this.configService.config.allowMerchantSubscription;
  }

  getActivatedMerchantIri(): string {
    if (this.activatedMerchant() && this.offers.hasOwnProperty(offerTypes[1])) {
      // console.log('[DEBUG] m iri ', this.offers[offerTypes[1]].iri);
      return this.offers[offerTypes[1]].iri;
    } else {
      return '0';
    }
  }

  checkSelection(): void {
    // console.log('[DEBUG] SubscriptionOrderComponent, checkSelection() ', this.newSubscription.offer);
    if (this.hasOfferSelected() && this.displayFormError) {
      this.displayFormError = false;
    }
    this.displayCheckError = !this.checkSellingTerms;

    if (this.hasOfferSelected() && this.checkSellingTerms && this.amountToBePaid()) {
      this.handlePaypalButton(this.getEuroTotalOrder(), this.getSubscriptionOrderLabel());
    }
  }

  hasOfferSelected(): boolean {
    // console.log('[DEBUG] Offer Selected ', this.newSubscription.offer);
    return (typeof this.newSubscription.offer === 'string' && this.newSubscription.offer !== '0');
  }

  amountToBePaid(): boolean {
    return (this.getEuroTotalOrder() > 0);
  }

  displayEuroAmount(amount: number): string {
    // console.log('[DEBUG] SubscriptionOrderComponent, displayEuroAmount() ', typeof amount);
    const formatted = formatNumber(amount, this.locale, '1.2-2');
    // console.log('[DEBUG] SubscriptionOrderComponent, displayEuroAmount() ', typeof formatted);
    const currency = formatted === '0' ? euroCurrency[0] : euroCurrency[1];
    return formatted + ' ' + currency;
  }

  getEuroTotalOrder(): number {
    let totalOrder = 0;
    const selectedOfferIri = this.newSubscription.offer;
    if (typeof selectedOfferIri === 'string') {
      const offer = this.getOfferByIri(selectedOfferIri);
      if (offer !== null) {
        totalOrder = this.getObjectPropertyValue('price', offer);
      }
    }
    // console.log('[DEBUG] SubscriptionOrderComponent, getEuroTotalOrder() ', typeof selectedOfferId, this.offers);
    return totalOrder;
  }

  getEuroTotalOrderToDisplay(): string {
    let totalToDisplay = '--';
    const totalPrice = this.getEuroTotalOrder();
    if (totalPrice !== null) {
      totalToDisplay = this.displayEuroAmount(totalPrice);
    }
    return totalToDisplay;
  }

  getSubscriptionOrderLabel(): string {
    let subscriptionLabel = orderLabelPrefix;
    const selectedOfferIri = this.newSubscription.offer;
    if (typeof selectedOfferIri === 'string') {
      const offer = this.getOfferByIri(selectedOfferIri);
      if (offer !== null) {
        const subscriptionLabelObject = this.getObjectPropertyValue('label', offer);
        if (subscriptionLabelObject) {
          subscriptionLabel = this.getObjectPropertyValue(ppLangCode, subscriptionLabelObject);
          if (subscriptionLabel) {
            subscriptionLabel = orderLabelPrefix + ' ' + decodeURI(subscriptionLabel);
          }
        }
        const duration = this.getObjectPropertyValue('duration', offer);
        const startsFrom = this.newSubscription.startingDate;
        if (duration && startsFrom) {
          subscriptionLabel += ' (' + duration + 'm from ' + startsFrom + ')';
        }
      }
    }
    return subscriptionLabel;
  }

  getOfferByIri(selectedOfferIri): any {
    const individual = offerTypes[0];
    const merchant = offerTypes[1];
    if (this.offers.hasOwnProperty(individual)) {
      const iriOffer = this.getObjectPropertyValue('iri', this.offers[individual]);
      if (iriOffer !== null && iriOffer === selectedOfferIri) {
        return this.offers[individual];
      }
    }
    if (this.offers.hasOwnProperty(merchant)) {
      const iriOffer = this.getObjectPropertyValue('iri', this.offers[merchant]);
      if (iriOffer !== null && iriOffer === selectedOfferIri) {
        return this.offers[merchant];
      }
    }
    return null;
  }

  getObjectPropertyValue(theProperty: string, theObject: any): any {
    let propertyValue = null;
    if (theObject.hasOwnProperty(theProperty)) {
      propertyValue = theObject[theProperty];
    }
    return propertyValue;
  }


  handlePaypalButton(orderTotalAmount: number, subscriptionLabel: string): void {
    const orderingUser = this.userIri;
    const objectUser = this.userInfos.countryCode ? {
      email_address: this.userInfos.email,
      name: {
        given_name: this.userInfos.firstName,
        surname: this.userInfos.lastName
      },
      address: {
        address_line_1: this.userInfos.address,
        admin_area_2: this.userInfos.city,
        postal_code: this.userInfos.postCode,
        country_code: this.userInfos.countryCode
      }
    } : {};
    const orderedSubscription = this.newSubscription;
    const serviceHttp = this.apiHttpService;
    const serviceAuth = this.authService;
    const componentNg = this;

    // Setup PayPal JS SDK
    paypal.Buttons({
      fundingSource: paypal.FUNDING.PAYPAL,

      // setup the transaction (https://developer.paypal.com/docs/checkout/integrate/#4-set-up-the-transaction)
      createOrder: function (data, actions) {
        return actions.order.create({
          // payment options
          intent: 'capture',
          purchase_units: [{
            description: subscriptionLabel,
            amount: {
              value: orderTotalAmount
            }
          }],
          // flow: 'checkout',
          // enableShippingAddress: false,
          application_context: {
            //locale: ppLocale,
            //brand_name: 'Close-Env.',
            shipping_preference: 'NO_SHIPPING'
          },
          payer: objectUser,
          user_action: 'PAY_NOW'
        });
      },

      // finalize the transaction (https://developer.paypal.com/docs/checkout/integrate/#5-capture-the-transaction)
      onApprove: function (data, actions) {
        // This function captures the funds from the transaction.
        return actions.order.capture().then(function(details) {
          // console.log('[payment] approved ', details);
          // SubscriptionOrder à créer => créer l'abonnement avec les données de paiement associées
          let ppSubscriptionOrder = { ...details };
          ppSubscriptionOrder.user = orderingUser;
          ppSubscriptionOrder.subscriptionOffer = orderedSubscription.offer;
          ppSubscriptionOrder.startingDate = orderedSubscription.startingDate;
          componentNg.orderPaymentProcessing = true;

          serviceHttp.postSubscriptionWithPayment(ppSubscriptionOrder)
          .subscribe((subscriptionOrderResult) => {
            // console.log('[DEBUG]  PP - postSubscriptionWithPayment() ', subscriptionOrderResult);
            // actualisation/gestion retour vers le composant parent
            componentNg.newSubscriptionValidated.emit(subscriptionOrderResult);
            componentNg.orderPaymentProcessing = false;
            componentNg.loading = false;
          }, (error) => {
            console.warn('[DEBUG]  PP - postSubscriptionWithPayment() returns error ', error);
            // afficher l'erreur sur la page du form
            componentNg.orderPaymentProcessing = false;
            componentNg.warningMessage = error.errorMessage;
            componentNg.showWarningMessage = true;
            of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
              serviceAuth.checkTokenExpiration(error, 1000, true);
            });
          });
          //
        });
      },

      onCancel: function (data) {
        console.log('[payment] cancelled ', data);
      },

      onError: function (err) {
        console.error('[payment] error ', err);
      }

    }).render(this.paypalElement.nativeElement);

  }


  preventUncheck(): void {
    // console.log('[DEBUG] preventUncheck() ', this.checkSellingTerms);
    if (this.checkSellingTerms) {
      // il ne faut plus pouvoir décocher (à cause du bouton pp)
      this.mandatoryCheckFrozen = true;
    }
    this.displayCheckError = false;
    this.checkSelection();
  }


  confirmOrder() {

    if (!this.hasOfferSelected()) {
      this.displayFormError = true;
      return ;
    }
    if (!this.checkSellingTerms) {
      this.displayCheckError = true;
      return ;
    }

    this.loading = true;

    // prépare appel API POST
    const subscriptionOrder = {
      user: this.userIri,
      subscriptionOffer: this.newSubscription.offer, // IRI
      startingDate: this.newSubscription.startingDate
    };

    this.postSubscriptionOrder(subscriptionOrder);
  }


  postSubscriptionOrder(subscriptionOrder) {
    // en principe, si on passe par là, c'est qu'on a sélectionné une offre gratuite...
    // sinon on passerait par l'event 'onAuthorize' dans paypal.Button.render()
    this.apiHttpService.postSubscriptionOrder(subscriptionOrder)
      .subscribe((savedSubscription) => {
        // console.log('[BRANCHEMENT-API] SubscriptionOrderComponent - postSubscriptionOrder - 2 ', savedSubscription);
        this.successMessage = 'Member.subscrip.component.submit.order.success';
        this.showSuccessMessage = true;

        // gestion retour vers le composant parent (MemberComponent)
        this.newSubscriptionValidated.emit(savedSubscription);

        this.loading = false;
      }, (error) => {
        this.loading = false;
        // afficher l'erreur sur la page du form
        console.warn('[BRANCHEMENT-API] SubscriptionOrderComponent - postSubscriptionOrder - 9 ', error);
        this.warningMessage = error.errorMessage;
        this.showWarningMessage = true;
        of(keyEnsureErrorDisplay).pipe(delay(2500)).subscribe(value => {
          this.authService.checkTokenExpiration(error, 1000, true);
        });
      }, () => {
        // fin du subscribe
      });
  }

}
