/* eslint-disable @typescript-eslint/no-explicit-any */
import { createMollieClient, Customer, List, Locale, MandateMethod, Mandate, Subscription, Payment } from '@mollie/api-client';
import { get, post, requestBody, HttpErrors, param } from '@loopback/rest';
import { SignupPayload } from '../models';
import moment from 'moment';

export class MollieController {

  private mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY as string });

  constructor() { }

  @get('/mollie/checkout', {
    parameters: [
      { name: 'email', schema: { type: 'string' }, in: 'query' },
      { name: 'firstname', schema: { type: 'string' }, in: 'query' },
      { name: 'lastname', schema: { type: 'string' }, in: 'query' },
    ],
    responses: {
      '200': {
        description: 'Mollie Checkout URL',
        content: {
          'application/json': {
            schema: { type: 'string' },
          },
        },
      },
    }
  })
  async checkout(
    @param.query.string('email') email: string,
    @param.query.string('firstname') firstname: string,
    @param.query.string('lastname') lastname: string
  ): Promise<string | null> {
    console.debug(`/mollie/checkout`);

    let checkoutUrl: string | null = null;

    await this.mollieClient.customers.create({
      name: `${unescape(firstname)} ${unescape(lastname)}`,
      email: unescape(email),
      locale: Locale.de_AT,
      metadata: `{since:${moment().format()}}`,
    }).then(async (customer: Customer) => {
      console.debug(`Customer ${customer.id} created`);

      await this.mollieClient.payments.create({
        customerId: customer.id,
        billingEmail: customer.email,
        dueDate: moment().add(14, 'days').format('YYYY-MM-DD'),
        amount: {
          currency: 'EUR',
          value: '30.00',
        },
        description: '[QS - TEST] Team Vegan.at Jahresmitgliedschaft',
        locale: Locale.de_AT,
        redirectUrl: 'https://www-qs.teamvegan.at/mitgliedschaft-final/',
        webhookUrl: process.env.MOLLIE_WEBHOOK_PAYMENT,
      }).then((payment: Payment) => {
        console.debug(`Payment ${payment.id} for ${customer.id} created`);

        checkoutUrl = payment.getCheckoutUrl();
        // TODO: send mail
      }).catch((reason) => {
        console.error(reason);
        throw new HttpErrors.InternalServerError(reason);
      });
    }).catch((reason) => {
      console.error(reason);
      throw new HttpErrors.InternalServerError(reason);
    });

    return checkoutUrl;
  }

  @post('/mollie/members', {
    responses: {
      '200': {
      },
    }
  })
  async createMemberSubscription(
    @requestBody() payload: SignupPayload
  ): Promise<any> {
    console.debug(`/mollie/members`);

    // TODO check if customer already exists

    await this.mollieClient.customers.create({
      name: `${payload.firstname} ${payload.lastname}`,
      email: payload.email,
      locale: Locale.de_AT,
      metadata: `{since:${moment().format()}}`,
    }).then(async (customer: Customer) => {
      console.debug(`Customer ${customer.id} created`);

      await this.mollieClient.customers_mandates.create({
        customerId: customer.id,
        method: MandateMethod.directdebit,
        consumerName: payload.consumerName,
        consumerAccount: payload.consumerAccount,
        consumerBic: payload.consumerBic,
        signatureDate: moment().format('YYYY-MM-DD'),
        mandateReference: `TEAMVEGAN-${moment().format('YYYYMMDDHHmmssSS')}`,
      }).then(async (mandate: Mandate) => {
        console.debug(`Mandate ${mandate.id} for customer ${customer.id} created`);

        await this.mollieClient.customers_subscriptions.create({
          customerId: customer.id,
          mandateId: mandate.id,
          amount: {
            currency: 'EUR',
            value: '30.00',
          },
          interval: '12 months',
          description: 'Team Vegan.at Jahresmitgliedschaft',
          webhookUrl: process.env.MOLLIE_WEBHOOK_SUBSCRIPTION,
        }).then((subscription: Subscription) => {
          console.debug(`Subscription ${subscription.id} for ${customer.id} created`);

          // TODO: send mail
        }).catch((reason) => {
          console.error(reason);
          throw new HttpErrors.InternalServerError(reason);
        });
      }).catch((reason) => {
        console.error(reason);
        throw new HttpErrors.InternalServerError(reason);
      });
    }).catch((reason) => {
      console.error(reason);
      throw new HttpErrors.InternalServerError(reason);
    });
  }

  @get('/mollie/customers', {
    responses: {
      '200': {
      },
    }
  })
  async listCustomers(
  ): Promise<any> {
    console.debug(`/mollie/customers`);

    let customerList: List<Customer> | undefined;

    await this.mollieClient.customers.page()
      .then(async (customers: List<Customer>) => {
        console.debug(`Fetched ${customers.count} customer entries`);

        customerList = customers;

        // while (nextPageCustomers.count > 0) {
        // console.debug(`Fetched next ${nextPageCustomers.count} customer entries`);

        // customers.push(nextPageCustomers);
        // nextPageCustomers = await nextPageCustomers.nextPage();
        // }

        customerList = customers;
        // return customers;
      }).catch((reason) => {
        console.error(reason);
        throw new HttpErrors.InternalServerError(reason);
      });

    return customerList;
  }
}
