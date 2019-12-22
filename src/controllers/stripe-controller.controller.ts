/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
import { post } from '@loopback/rest';
import moment from 'moment';

export class StripeControllerController {

  private stripe = require("stripe")("sk_test_AlPMuXYwxA0Awgrdx17JSAy100VrPPzmP2");

  constructor() {
  }

  // Map to `GET /ping`
  @post('/members')
  signupMember() {

    // Check if customer already exists
    this.stripe.customers.list(
      {
        email: 'geahaad+005@gmail.com',
        limit: 1
      })
      .then((customerArray: any) => {
        if (customerArray.data.length > 0) {
          const customerID = customerArray.data[0] ? customerArray.data[0].id : null;
          console.debug(`Customer ${customerID} already exists`);
          // Create new subscription in Stripe
          this.createSubscription(customerID);
        } else {
          // Create new customer in Stripe
          this.createCustomer();
        }
      })
      .catch((err: any) => {
        console.error(err);
        throw (err);
      });
  }

  private createCustomer() {
    this.stripe.customers.create({
      name: 'Gerhard Dinhof',
      email: 'geahaad+005@gmail.com',
      phone: '069910629413',
      address: {
        line1: 'Bahnhofstr 62-64/4/7, 3002 Purkersdorf',
      },
    })
      .then((customer: any) => {
        const customerID = customer.id;
        console.debug(`New customer ${customerID} created`);
        // Create subscription in Stripe
        this.createSubscription(customerID);
      })
      .then((source: any) => {
        // return this.stripe.charges.create({
        //   amount: 1600,
        //   currency: 'usd',
        //   customer: source.customer,
        // });
      })
      .then((charge: any) => {
        // New charge created on a new customer
      })
      .catch((err: any) => {
        // Deal with an error
        console.error(err);
        throw (err);
      });
  }

  private createSubscription(customerID: any) {
    this.stripe.subscriptions.create({
      customer: customerID,
      items: [
        {
          plan: 'plan_GMfg76J8Cr4xb0'
        }
      ],
      collection_method: "send_invoice",
      days_until_due: 14,
      // set billing cycle to start of upcoming year
      billing_cycle_anchor: moment().add(1, 'year').startOf('year').unix(),
    })
      .then((subscription: any) => {
        const subscriptionID = subscription.id;
        console.debug(`New subscription ${subscriptionID} customer ${customerID} created`);
        // Create subscription schedule in Stripe
        // this.stripe.subscriptionSchedules.
      })
      .catch((err: any) => {
        console.error(err);
        throw (err);
      });
  }
}
