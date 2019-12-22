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

    // TODO Check if customer already exists

    // Create customer in Stripe
    this.stripe.customers.create(
      {
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
        this.stripe.subscriptions.create(
          {
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
            return {
              error: err,
              status: 500
            }
          });
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
        return {
          error: err,
          status: 500
        }
      });
  }
}
