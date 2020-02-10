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
import { RedisUtil } from '../utils/redis.util';

export class MollieController {
  private debug = require('debug')('api:MollieController');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  constructor() { }

  @get('/mollie/checkout', {
    parameters: [
      { name: 'email', schema: { type: 'string' }, in: 'query', required: true },
      {
        name: 'firstname',
        schema: { type: 'string' },
        in: 'query',
        required: true,
      },
      { name: 'lastname', schema: { type: 'string' }, in: 'query', required: true },
      { name: 'dob', schema: { type: 'string' }, in: 'query' },
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
    @param.query.string('dob') dob: string,
  ): Promise<string | null> {
    this.debug(`/mollie/checkout`);

    let checkoutUrl: string | null = null;

    await this.mollieClient.customers
      .create({
        name: `${unescape(firstname)} ${unescape(lastname)}`,
        email: unescape(email),
        locale: Locale.de_AT,
        metadata: JSON.stringify({
          dob: dob,
        }),
      })
      .then(async (customer: Customer) => {
        this.debug(`Customer ${customer.id} created`);

        // Store in Redis
        const redisCustomerPayload = {
          timestamp: moment().utc(),
          controller: 'mollie',
          method: 'checkout',
          data: customer,
          payments: [],
        };
        RedisUtil.redisClient.set(
          `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
          JSON.stringify(redisCustomerPayload),
          (err: any, _reply: any) => {
            if (err) {
              this.debug(`Redis: ${err}`);
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
          .then(async (payment: Payment) => {
            this.debug(`Payment ${payment.id} for ${customer.id} created`);

            // Add payment payload to customer record
            await RedisUtil.redisGetAsync(
              `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
            ).then((custRecord: string) => {
              const redisPaymentPayload = {
                timestamp: moment().utc(),
                controller: 'mollie',
                method: 'checkout',
                data: payment,
              };

              const redisCustomerUpdate = JSON.parse(custRecord);

              redisCustomerUpdate.payments.push(redisPaymentPayload);

              RedisUtil.redisClient.set(
                `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
                JSON.stringify(redisCustomerUpdate),
                (err: any, _reply: any) => {
                  if (err) {
                    this.debug(`Redis: ${err}`);
                  }
                },
              );
            });

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
        .all({ customerId: customer.id })
        .then((payments: List<Payment>) => {
          this.debug(`Fetched ${payments.count} payment(s) for ${customer.id}`);
          const paymentsArray: Payment[] = [];

          payments.forEach(payment => {
            paymentsArray.push(payment);
          });
          const payload = {
            customer: customer,
            payments: paymentsArray,
          };

          paymentstatus.push(payload);
        })
        .catch(reason => {
          this.debug(reason);
          throw new HttpErrors.InternalServerError(reason);
        });
    }

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
      .all({ limit: 250 })
      .then((customers: List<Customer>) => {
        this.debug(`#1 Fetched ${customers.count} customer entries`);
        customers.forEach(customer => {
          customerList.push(customer);
        });
        return customers.nextPage();
      })
      .then((customers: List<Customer>) => {
        this.debug(`#2 Fetched ${customers.count} customer entries`);
        customers.forEach(customer => {
          customerList.push(customer);
        });
      })
      .catch(reason => {
        this.debug(reason);
        throw new HttpErrors.InternalServerError(reason);
      });

    return customerList;
  }

  @get('/redis/customer', {
    parameters: [
      {
        name: 'customerId',
        schema: { type: 'string' },
        in: 'query',
        required: true,
      },
    ],
    responses: {
      '200': {},
    },
  })
  public async redisGetCustomer(
    @param.query.string('customerId') customerId: string,
  ): Promise<any> {
    const custObj = await RedisUtil.redisGetAsync(
      `${RedisUtil.mollieCustomerPrefix}-${customerId}`,
    )
      .then((reply: any) => {
        this.debug(`Return ${reply}`);
        return JSON.parse(reply);
      })
      .catch((err: any) => {
        if (err) {
          this.debug(`Redis: ${err}`);
        }
      });

    return custObj;
  }
}
