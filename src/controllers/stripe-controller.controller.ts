/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
import { post, requestBody } from '@loopback/rest';
import moment from 'moment';
import { SignupPayload } from '../models';

export class StripeControllerController {

  private stripe = require("stripe")(process.env.STRIPE_API_KEY);

  constructor() {
  }

  // Map to `POST / members`
  @post('/members')
  async signupMember(
    @requestBody() payload: SignupPayload
  ): Promise<any> {

    // Check if customer already exists
    this.stripe.customers.list(
      {
        email: payload.email,
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
          this.createCustomer(payload);
        }
      })
      .catch((err: any) => {
        console.error(err);
        throw (err);
      });
  }

  private createCustomer(payload: SignupPayload) {
    this.stripe.customers.create({
      name: payload.membername,
      email: payload.email,
      phone: payload.phone,
      address: {
        line1: payload.address,
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
      prorate: false,
      // set the start of the subscription to beginning of the year
      // backdate_start_date: moment().startOf('year').unix()
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
