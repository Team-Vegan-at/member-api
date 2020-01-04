/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createMollieClient,
  Customer,
  List,
  Locale,
  Payment,
} from '@mollie/api-client';
import { get, HttpErrors, param } from '@loopback/rest';
import moment from 'moment';

export class MollieController {
  private debug = require('debug')('api:MollieController');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });
  private redisClient = require('redis').createClient(
    process.env.REDIS_PORT,
    process.env.REDIS_HOST,
    {
      retry_strategy: function (options: {
        error: { code: string };
        total_retry_time: number;
        attempt: number;
      }) {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          // End reconnecting on a specific error and flush all commands with
          // a individual error
          return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          // End reconnecting after a specific timeout and flush all commands
          // with a individual error
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          // End reconnecting with built in error
          return undefined;
        }
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
      },
    },
  );

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
    },
  })
  async checkout(
    @param.query.string('email') email: string,
    @param.query.string('firstname') firstname: string,
    @param.query.string('lastname') lastname: string,
  ): Promise<string | null> {
    this.debug(`/mollie/checkout`);

    let checkoutUrl: string | null = null;

    await this.mollieClient.customers
      .create({
        name: `${unescape(firstname)} ${unescape(lastname)}`,
        email: unescape(email),
        locale: Locale.de_AT,
        metadata: `{since:${moment().format()}}`,
      })
      .then(async (customer: Customer) => {
        this.debug(`Customer ${customer.id} created`);

        // Store in Redis
        const redisCustomerPayload = {
          timestamp: moment().utc(),
          controller: 'mollie',
          method: 'checkout',
          data: customer,
        };
        this.redisClient.set(
          `mollie-customer-${customer.id}`,
          JSON.stringify(redisCustomerPayload),
          (err: any, _reply: any) => {
            if (err) {
              this.debug(`Redis: ${err}`);
            } else {
              this.redisClient.get(
                `mollie-customer-${customer.id}`,
                (_err: any, reply: any) => {
                  this.debug(`Redis wrote: ${reply}`);
                },
              );
            }
          },
        );

        await this.mollieClient.payments
          .create({
            customerId: customer.id,
            billingEmail: customer.email,
            dueDate: moment()
              .add(14, 'days')
              .format('YYYY-MM-DD'),
            amount: {
              currency: 'EUR',
              value: process.env.MOLLIE_PAYMENT_AMOUNT!,
            },
            description: `${
              process.env.MOLLIE_PAYMENT_DESCRIPTION
              } ${moment().year()}`,
            locale: Locale.de_AT,
            redirectUrl: process.env.MOLLIE_CHECKOUT_REDIRECT_URL,
            webhookUrl: process.env.MOLLIE_WEBHOOK_PAYMENT,
          })
          .then((payment: Payment) => {
            this.debug(`Payment ${payment.id} for ${customer.id} created`);

            // Store in Redis
            const redisPaymentPayload = {
              timestamp: moment().utc(),
              controller: 'mollie',
              method: 'checkout',
              data: payment,
            };
            this.redisClient.set(
              `mollie-payment-${payment.id}`,
              JSON.stringify(redisPaymentPayload),
              (err: any, _reply: any) => {
                if (err) {
                  this.debug(`Redis: ${err}`);
                } else {
                  this.redisClient.get(
                    `mollie-payment-${payment.id}`,
                    (_err: any, reply: any) => {
                      this.debug(`Redis wrote: ${reply}`);
                    },
                  );
                }
              },
            );

            checkoutUrl = payment.getCheckoutUrl();
            // TODO: send mail
          })
          .catch(reason => {
            this.debug(reason);
            throw new HttpErrors.InternalServerError(reason);
          });
      })
      .catch(reason => {
        this.debug(reason);
        throw new HttpErrors.InternalServerError(reason);
      });

    return checkoutUrl;
  }

  // @post('/mollie/members', {
  //   responses: {
  //     '200': {},
  //   },
  // })
  // private async createMemberSubscription(
  //   @requestBody() payload: SignupPayload,
  // ): Promise<any> {
  //   this.debug(`/mollie/members`);

  //   // TODO check if customer already exists

  //   await this.mollieClient.customers
  //     .create({
  //       name: `${payload.firstname} ${payload.lastname}`,
  //       email: payload.email,
  //       locale: Locale.de_AT,
  //       metadata: `{since:${moment().format()}}`,
  //     })
  //     .then(async (customer: Customer) => {
  //       this.debug(`Customer ${customer.id} created`);

  //       await this.mollieClient.customers_mandates
  //         .create({
  //           customerId: customer.id,
  //           method: MandateMethod.directdebit,
  //           consumerName: payload.consumerName,
  //           consumerAccount: payload.consumerAccount,
  //           consumerBic: payload.consumerBic,
  //           signatureDate: moment().format('YYYY-MM-DD'),
  //           mandateReference: `TEAMVEGAN-${moment().format(
  //             'YYYYMMDDHHmmssSS',
  //           )}`,
  //         })
  //         .then(async (mandate: Mandate) => {
  //           this.debug(
  //             `Mandate ${mandate.id} for customer ${customer.id} created`,
  //           );

  //           await this.mollieClient.customers_subscriptions
  //             .create({
  //               customerId: customer.id,
  //               mandateId: mandate.id,
  //               amount: {
  //                 currency: 'EUR',
  //                 value: '30.00',
  //               },
  //               interval: '12 months',
  //               description: 'Team Vegan.at Jahresmitgliedschaft',
  //               webhookUrl: process.env.MOLLIE_WEBHOOK_SUBSCRIPTION,
  //             })
  //             .then((subscription: Subscription) => {
  //               this.debug(
  //                 `Subscription ${subscription.id} for ${customer.id} created`,
  //               );

  //               // TODO: send mail
  //             })
  //             .catch(reason => {
  //               this.debug(reason);
  //               throw new HttpErrors.InternalServerError(reason);
  //             });
  //         })
  //         .catch(reason => {
  //           this.debug(reason);
  //           throw new HttpErrors.InternalServerError(reason);
  //         });
  //     })
  //     .catch(reason => {
  //       this.debug(reason);
  //       throw new HttpErrors.InternalServerError(reason);
  //     });
  // }

  @get('/mollie/paymentstatus', {
    responses: {
      '200': {},
    },
  })
  public async listCustomerPaymentStatus(): Promise<any[]> {
    this.debug(`/mollie/paymentstatus`);

    const paymentstatus: any[] = [];

    const customers = await this.listCustomers();

    for (const customer of customers) {

      await this.mollieClient.customers_payments
        .all(
          { customerId: customer.id }
        )
        .then((payments: List<Payment>) => {
          this.debug(`Fetched ${payments.count} payment(s) for ${customer.id}`)
          const paymentsArray: Payment[] = [];

          payments.forEach(payment => {
            paymentsArray.push(payment);
          });
          const payload = {
            customer: customer,
            payments: paymentsArray
          };

          paymentstatus.push(payload);
        })
        .catch(reason => {
          this.debug(reason);
          throw new HttpErrors.InternalServerError(reason);
        });
    };

    return paymentstatus;
  }


  @get('/mollie/customers', {
    responses: {
      '200': {},
    },
  })
  public async listCustomers(): Promise<Customer[]> {
    this.debug(`/mollie/customers`);

    const customerList: Customer[] = [];

    await this.mollieClient.customers
      .all({ limit: 5 })
      .then((customers: List<Customer>) => {
        this.debug(`#1 Fetched ${customers.count} customer entries`);
        customers.forEach(customer => {
          customerList.push(customer);
        });
        // return customers.nextPage();
      })
      // .then((customers: List<Customer>) => {
      //   this.debug(`#2 Fetched ${customers.count} customer entries`);
      //   customers.forEach(customer => {
      //     customerList.push(customer);
      //   });
      // })
      .catch(reason => {
        this.debug(reason);
        throw new HttpErrors.InternalServerError(reason);
      });

    return customerList;
  }
}
