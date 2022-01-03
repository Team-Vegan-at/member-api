/* eslint-disable @typescript-eslint/no-explicit-any */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {get, HttpErrors, param, Response, RestBindings} from '@loopback/rest';
import {
  createMollieClient,
  Customer,
  List,
  Locale,
  Payment,
  PaymentStatus,
  SubscriptionStatus
} from '@mollie/api-client';
import {SubscriptionData} from '@mollie/api-client/dist/types/src/data/subscription/data';
import moment from 'moment';
import {CalcUtil} from '../utils/calc.util';
import {RedisUtil} from '../utils/redis.util';
import {DashboardController} from './dashboard.controller';

export class MollieController {
  private debug = require('debug')('api:MollieController');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  constructor() {}

  @get('/pay', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true},
      {name: 'redirectUrl', schema: {type: 'string'}, in: 'query', required: false},
    ],
    responses: {
      '302': {
        description: 'Mollie Checkout URL',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  async pay(
    @param.query.string('email') email: string,
    @param.query.string('redirectUrl') redirectUrl: string,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<any> {
    this.debug(`/pay`);

    const checkoutUrl = await this.getCheckoutUrl(email, redirectUrl);

    if (checkoutUrl) {
      response.redirect(checkoutUrl);
    } else {
      throw new HttpErrors.InternalServerError();
    }
  }

  public async getCheckoutUrl(email: string, redirectUrl?: string, membershipType?: string) {
    const dc = new DashboardController();
    const checkoutUrl = await dc
      .redisGetTeamMember(email)
      .then(async (custObj: any) => {
        if (custObj?.mollieObj) {
          return this.createMollieCheckoutUrl(
            custObj.mollieObj,
            redirectUrl,
            membershipType
          );
        } else {
          return 'https://teamvegan.at';
        }
      })
      .catch(() => {
        return 'https://teamvegan.at';
      });
    return checkoutUrl;
  }

  @get('/mollie/checkout', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true},
      {
        name: 'firstname',
        schema: {type: 'string'},
        in: 'query',
        required: true,
      },
      {name: 'lastname', schema: {type: 'string'}, in: 'query', required: true},
      {name: 'dob', schema: {type: 'string'}, in: 'query'},
    ],
    responses: {
      '200': {
        description: 'Mollie Checkout URL',
        content: {
          'application/json': {
            schema: {type: 'string'},
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

    // const dc = new DashboardController();
    // await dc.redisGetTeamMember(email).then((memberObj: any) => {
    //   this.debug(`Member already exists`);
    //   this.debug(memberObj);

    //   return null;
    // });

    await this.mollieClient.customers
      .create({
        name: `${decodeURIComponent(firstname)} ${decodeURIComponent(lastname)}`,
        email: decodeURIComponent(email),
        locale: Locale.de_AT,
        metadata: {
          dob,
        },
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

        checkoutUrl = await this.createMollieCheckoutUrl(customer);
      })
      .catch(reason => {
        this.debug(reason);
        return null;
      });

    return checkoutUrl;
  }

  /******** PRIVATE FUNCTIONS *************/

  private async createMollieCheckoutUrl(customer: any, redirectUrl?: string, membershipType = 'regular') {
    if (!process.env.MOLLIE_PAYMENT_AMOUNT_FULL) {
      this.debug('ERROR: MOLLIE_PAYMENT_AMOUNT_FULL not set');
      return null;
    }

    const discount = process.env.MOLLIE_PAYMENT_DISCOUNT ?
      parseFloat(process.env.MOLLIE_PAYMENT_DISCOUNT) : 1;
    let amount = parseInt(process.env.MOLLIE_PAYMENT_AMOUNT_FULL!, 10);
    if (membershipType && membershipType === 'reduced') {
      amount = parseInt(process.env.MOLLIE_PAYMENT_AMOUNT_REDUCED!, 10);
    }
    const totalAmount = (amount * discount).toFixed(2);

    this.debug(`Membership Type: ${membershipType}`);
    this.debug(`Calculated amount: ${totalAmount} (${amount} * ${discount})`);

    return this.mollieClient.payments
      .create({
        customerId: customer.id,
        billingEmail: customer.email,
        dueDate: moment()
          .add(14, 'days')
          .format('YYYY-MM-DD'),
        amount: {
          currency: 'EUR',
          value: totalAmount.toString(),
        },
        description: `${
          process.env.MOLLIE_PAYMENT_DESCRIPTION
        }`,
        locale: Locale.de_AT,
        redirectUrl: redirectUrl ? redirectUrl : process.env.MOLLIE_CHECKOUT_REDIRECT_URL,
        webhookUrl: process.env.MOLLIE_WEBHOOK_PAYMENT,
      })
      .then(async (payment: Payment) => {
        this.debug(`Payment ${payment.id} for ${customer.id} created`);
        // Add payment payload to customer record
        await RedisUtil.redisGetAsync(
          `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
        ).then((custRecord: string | null) => {
          if (!custRecord) {
            this.debug(`Customer not found: ${customer.id}`);
            return null;
          }
          const redisPaymentPayload = {
            timestamp: moment().utc(),
            controller: 'mollie',
            method: 'checkout',
            data: payment,
          };
          let redisCustomerUpdate = JSON.parse(custRecord);
          if (!redisCustomerUpdate.payments) {
            redisCustomerUpdate = {...redisCustomerUpdate, ...{payments: []}};
          }
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
        // TODO: send mail
        return payment.getCheckoutUrl()!;
      })
      .catch(reason => {
        this.debug(reason);
        return null;
      });
  }

  @get('/mollie/payments', {
    parameters: [
      {name: 'custId', schema: {type: 'string'}, in: 'query', required: true},
    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async listCustomerPayments(
    @param.query.string('custId') custId: string,
  ): Promise<Payment[]> {
    this.debug(`/mollie/payments`);

    return this.mollieClient.customers_payments
      .all({customerId: custId})
      .then((payments: List<Payment>) => {
        this.debug(`Fetched ${payments.count} payment(s) for ${custId}`);
        const paymentsArray: Payment[] = [];

        payments.forEach(payment => {
          // filter successful payments only
          if (payment.status === PaymentStatus.paid) {
            paymentsArray.push(payment);
          }
        });

        return paymentsArray;
      })
      .catch(reason => {
        this.debug(reason);
        return [];
      });
  }

  /**
   * Methods NOT exposed as endpoints
   */

  public async listCustomerSubscriptions(
    @param.query.string('custId') custId: string,
  ): Promise<SubscriptionData[]> {
    this.debug(`/mollie/subscriptions/${custId}`);

    return this.mollieClient.customers_subscriptions
      .all({customerId: custId})
      .then((subscriptions: List<SubscriptionData>) => {
        this.debug(`Fetched ${subscriptions.count} subscription(s) for ${custId}`);
        const subscriptionsArray: SubscriptionData[] = [];

        subscriptions.forEach(subscription => {
          // Filter active subscriptions only
          if (subscription.status === SubscriptionStatus.active) {
            subscriptionsArray.push(subscription);
          }
        });

        return subscriptionsArray;
      })
      .catch(reason => {
        this.debug(reason);
        return [];
      });
  }

  public async listAllActiveSubscriptions(): Promise<SubscriptionData[]> {
    this.debug(`/mollie/subscriptions`);

    return this.mollieClient.subscription
      .list()
      .then((subscriptions: List<SubscriptionData>) => {
        this.debug(`Fetched ${subscriptions.count} subscription(s)`);
        const subscriptionsArray: SubscriptionData[] = [];

        subscriptions.forEach(subscription => {
          if (subscription.status === SubscriptionStatus.active) {
            subscriptionsArray.push(subscription);
          }
        });

        return subscriptionsArray;
      })
      .catch(reason => {
        this.debug(reason);
        return [];
      });
  }

  @get('/mollie/payments/paid', {
    responses: {
      '200': {},
    },
  })
  public async listAllPaidPayments(membershipYear: number): Promise<Payment[]> {
    this.debug(`/mollie/payments/paid`);

    // TODO PAGINATION!

    const paymentsArray: Payment[] = [];
    return this.mollieClient.payments
      .all({
        // limit: 2
      })
      .then(async payments => {
        this.debug(`Fetched ${payments.count} payment(s)`);
        payments.forEach(payment => {
          if (payment.status === PaymentStatus.paid) {
            if (CalcUtil.isInMembershipRange(payment.paidAt!.substring(0, 10), membershipYear)) {
              paymentsArray.push(payment);
            }
          }
        });

        // let nxt = payments.nextPageCursor;
        // while (nxt) {
        //   nxt = await this.mollieClient.payments
        //     .all({
        //       limit: 2,
        //       from: nxt
        //     }).then(pymts => {
        //       this.debug(`Fetched ${payments.count} payment(s)`);
        //       pymts.forEach(payment => {
        //         if (payment.status === PaymentStatus.paid) {
        //           if (CalcUtil.isInMembershipRange(payment.paidAt!.substring(0, 10), membershipYear)) {
        //             paymentsArray.push(payment);
        //           }
        //         }
        //       });
        //       return payments.nextPageCursor;
        //     })
        //     .catch(reason => {
        //       this.debug(reason);
        //       throw new HttpErrors.InternalServerError(reason);
        //     });
        // }

        return paymentsArray;
      })
      .catch(reason => {
        this.debug(reason);
        return [];
      });
  }

  @get('/mollie/paymentstatus', {
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async listCustomerPaymentStatus(): Promise<any[]> {
    this.debug(`/mollie/paymentstatus`);

    const paymentstatus: any[] = [];

    const customers = await this.listCustomers();

    for (const customer of customers) {
      await this.mollieClient.customers_payments
        .all({customerId: customer.id})
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
          return [];
        });
    }

    return paymentstatus;
  }

  @get('/mollie/customers', {
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async listCustomers(): Promise<Customer[]> {
    this.debug(`/mollie/customers`);

    const customerList: Customer[] = [];

    await this.mollieClient.customers
      .all({limit: 200})
      .then((customers: List<Customer>) => {
        this.debug(`#1 Fetched ${customers.count} customer entries`);
        customers.forEach(customer => {
          customerList.push(customer);
        });

        if (customers.nextPage) {
          return customers.nextPage!();
        } else {
          return null;
        }
        })
        .then((customers: List<Customer> | null) => {
          if (customers) {
            this.debug(`#2 Fetched ${customers.count} customer entries`);
            customers.forEach(customer => {
              customerList.push(customer);
            });
          }
      })
      .catch(reason => {
        this.debug(reason);
        return [];
      });

    return customerList;
  }
}
