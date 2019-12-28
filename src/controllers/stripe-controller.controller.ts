/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
import { get, post, requestBody, param, HttpErrors } from '@loopback/rest';
import moment from 'moment';
import { SignupPayload } from '../models';

export class StripeControllerController {

  private stripe = require("stripe")(process.env.STRIPE_API_KEY);

  constructor() {
  }

  @get('/stripe/checkout-session', {
    parameters: [{ name: 'email', schema: { type: 'string' }, in: 'query' }],
    responses: {
      '200': {
        description: 'session',
        content: {
          'application/json': {
            schema: { type: 'string' },
          },
        },
      },
    }
  })
  async stripeCheckoutSession(
    @param.query.string('email') email: string
  ): Promise<any> {
    let session;

    console.debug(`/stripe/checkout-session?email=${email}`);

    // Check if customer already exists
    await this.stripe.customers.list({
      email: email,
      limit: 1
    })
      .then(async (customerArray: any) => {
        if (customerArray.data.length > 0) {
          const customerID = customerArray.data[0] ? customerArray.data[0].id : null;
          console.debug(`Customer ${customerID} already exists`);

          await this.stripe.checkout.sessions.create({
            customer: customerID,
            // success_url: 'https://api-qs.teamvegan.at/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}',
            // cancel_url: 'https://api-qs.teamvegan.at/stripe/checkout/cancel',
            success_url: 'http://localhost:3000/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://localhost:3000/stripe/checkout/cancel',
            payment_method_types: ['card'],
            subscription_data: {
              items: [{
                plan: process.env.STRIPE_SUBSCRIPTION_PLAN,
              }],
            },
          }).then(async (stripeSession: any) => {
            console.debug(`stripe session: ${JSON.stringify(stripeSession)}`);
            session = stripeSession.id;
          }).catch((err: any) => {
            console.error(err);
            throw new HttpErrors.ServiceUnavailable(err);
          });
        } else {
          await this.stripe.checkout.sessions.create({
            customer_email: email,
            // success_url: 'https://api-qs.teamvegan.at/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}',
            // cancel_url: 'https://api-qs.teamvegan.at/stripe/checkout/cancel',
            success_url: 'http://localhost:3000/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'http://localhost:3000/stripe/checkout/cancel',
            payment_method_types: ['card'],
            subscription_data: {
              items: [{
                plan: process.env.STRIPE_SUBSCRIPTION_PLAN,
              }],
            },
          }).then(async (stripeSession: any) => {
            console.debug(`stripe session: ${JSON.stringify(stripeSession)}`);
            session = stripeSession.id;
          }).catch((err: any) => {
            console.error(err);
            throw new HttpErrors.ServiceUnavailable(err);
          });
        }
      })
      .catch((err: any) => {
        console.error(err);
        throw (err);
      });

    console.debug(`Returning stripe session: ${session}`);
    return session;
  }

  // Map to `POST / members`
  @post('/members')
  async signupMember(
    @requestBody() payload: SignupPayload
  ): Promise<any> {

    // Check if customer already exists
    this.stripe.customers.list({
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
      preferred_locales: [
        'de-DE',
        'en-US',
      ],
    })
      .then((customer: any) => {
        const customerID = customer.id;
        console.debug(`New customer ${customerID} created`);
        // Create subscription in Stripe
        this.createSubscription(customerID);
      })
      .catch((err: any) => {
        // Deal with an error
        console.error(err);
        throw (err);
      });
  }

  private createSubscription(customerID: any) {

    // Create subscription schedule starting beginning of the current year - recurring
    this.stripe.subscriptionSchedules.create({
      customer: customerID,
      start_date: moment().utc().startOf('year').unix(),
      phases: [
        {
          plans: [
            {
              plan: process.env.STRIPE_SUBSCRIPTION_PLAN,
            }
          ],
          collection_method: 'send_invoice',
          invoice_settings: {
            days_until_due: 14,
          },
        },
      ],
    })
      .then((subscription: any) => {
        const subscriptionID = subscription.id;
        console.debug(`New subscription ${subscriptionID} customer ${customerID} created`);

        // Retrieve draft invoice
        this.retrieveDraftInvoices(customerID);
      })
      .catch((err: any) => {
        console.error(err);
        throw (err);
      });
  }

  private retrieveDraftInvoices(customerID: any) {
    this.stripe.invoices.list({
      customer: customerID,
      status: 'draft'
    })
      .then((invoiceArray: any) => {
        if (invoiceArray.data.length > 0) {
          invoiceArray.data.forEach((invoice: { id: string; }) => {
            const invoiceID = invoice.id;
            console.debug(`Invoice ${invoiceID} found`);
            // Immediately send invoice mail
            this.sendInvoice(invoiceID);
          });
        } else {
          console.warn(`No draft invoice found for customer ${customerID}`);
        }
      })
      .catch((err: any) => {
        console.error(err);
        throw (err);
      });
  }

  private sendInvoice(invoiceID: any) {
    if (invoiceID) {
      this.stripe.invoices.sendInvoice(invoiceID)
        .then((result: any) => {
          console.debug(`Mail for invoice ${invoiceID} sent successfully`);
        })
        .catch((err: any) => {
          console.error(err);
          throw (err);
        });
    }
  }
}
