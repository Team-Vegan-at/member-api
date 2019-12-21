/* eslint-disable @typescript-eslint/camelcase */
import { post } from '@loopback/rest';
import Stripe from 'stripe';

export class StripeControllerController {

  private stripe = new Stripe("sk_test_AlPMuXYwxA0Awgrdx17JSAy100VrPPzmP2");

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
      .then((customer) => {
        const customerID = customer.id;
        console.debug(`New customer ${customerID} created`);

        this.stripe.subscriptions.create(
          {
            customer: customerID,
            items: [
              {
                plan: 'plan_GMfg76J8Cr4xb0'
              }
            ],
          })
          .then((subscription) => {
            const subscriptionID = subscription.id;

            console.debug(`New subscription ${subscriptionID} customer ${customerID} created`);
          })
          .catch((err) => {
            console.error(err);
            return {
              error: err,
              status: 500
            }
          });
      })
      .then((source) => {
        // return this.stripe.charges.create({
        //   amount: 1600,
        //   currency: 'usd',
        //   customer: source.customer,
        // });
      })
      .then((charge) => {
        // New charge created on a new customer
      })
      .catch((err) => {
        // Deal with an error
        console.error(err);
        return {
          error: err,
          status: 500
        }
      });
  }
}
