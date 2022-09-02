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
import {MollieService} from '../services/mollie.service';

export class MollieController {
  private debug = require('debug')('api:MollieController');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  constructor() {}

  @get('/pay', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true},
      {name: 'type', schema: {type: 'string'}, in: 'query', required: false},
      {name: 'recurring', schema: {type: 'string'}, in: 'query', required: false},
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
    @param.query.string('type') type = 'regular',
    @param.query.string('recurring') recurring = '0',
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<any> {
    this.debug(`/pay`);
    const recurringParsed = recurring.toLowerCase() === 'true' || !!+recurring;

    const mollieSvc = new MollieService();
    const checkoutUrl = await mollieSvc.getCheckoutUrl(email, redirectUrl, type, recurringParsed);

    if (checkoutUrl) {
      response.redirect(checkoutUrl);
    } else {
      throw new HttpErrors.InternalServerError();
    }
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

    // TODO make dynamic!
    const membershipType = 'regular';

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
        await RedisUtil.redisClient().set(
          `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
          JSON.stringify(redisCustomerPayload))
        .catch((err: any) => {
            this.debug(`Redis|${err}`);
        });

        const mollieSvc = new MollieService();
        checkoutUrl = await mollieSvc.getCheckoutUrl(customer.email, "", membershipType, false);
      })
      .catch(reason => {
        this.debug(reason);
        return null;
      });

    return checkoutUrl;
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
      .page({customerId: custId})
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
