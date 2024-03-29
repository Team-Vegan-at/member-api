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
    @param.query.string('type') type: string = 'regular',
    @param.query.string('recurring') recurring: string = '0',
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<any> {
    this.debug(`/pay`);

    let recurringParsed = false;
    if (typeof recurring === 'string') {
      recurringParsed = recurring.toLowerCase() === 'true' || !!+recurring;
      // https://stackoverflow.com/a/50697299
    } else {
      recurringParsed = false;
    }

    const checkoutUrl = await this.getCheckoutUrl(
      email, redirectUrl, type, recurringParsed);

    if (checkoutUrl) {
      response.redirect(checkoutUrl);
    } else {
      throw new HttpErrors.InternalServerError();
    }
  }

  public async getCheckoutUrl(email: string, redirectUrl?: string, membershipType: string = 'regular', membershipRecurring: boolean = false) {
    const dc = new DashboardController();
    const checkoutUrl = await dc
      .redisGetTeamMember(email)
      .then(async (custObj: any) => {
        if (custObj?.mollieObj) {
          return this.createMollieCheckoutUrl(
            custObj.mollieObj,
            redirectUrl,
            membershipType,
            membershipRecurring
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
      {name: 'type', schema: {type: 'string'}, in: 'query'},
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
    @param.query.string('type') type: string,
  ): Promise<string | null> {
    this.debug(`/mollie/checkout`);

    const membershipType = type ? type: 'regular';

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

        checkoutUrl = await this.createMollieCheckoutUrl(
          customer, "", membershipType, false);
      })
      .catch(reason => {
        this.debug(reason);
        return null;
      });

    return checkoutUrl;
  }

  /******** PRIVATE FUNCTIONS *************/

  private async createMollieCheckoutUrl(customer: Customer, redirectUrl?: string,
    membershipType = 'regular', membershipRecurring = false) {
    if (!process.env.MOLLIE_PAYMENT_NEW_AMOUNT_REGULAR) {
      this.debug('ERROR|MOLLIE_PAYMENT_NEW_AMOUNT_REGULAR not set');
      return null;
    }

    // Default: No discount
    let discount = 1;
    if (membershipRecurring) {
      discount = process.env.MOLLIE_PAYMENT_RECURRING_DISCOUNT ?
        parseFloat(process.env.MOLLIE_PAYMENT_RECURRING_DISCOUNT) : 1;
    } else {
      discount = process.env.MOLLIE_PAYMENT_NEW_DISCOUNT ?
        parseFloat(process.env.MOLLIE_PAYMENT_NEW_DISCOUNT) : 1;
    }

    // Default: New Member, regular
    let amount = parseInt(process.env.MOLLIE_PAYMENT_NEW_AMOUNT_REGULAR!, 10);

    if (membershipType && membershipType === 'reduced') {
      // 1) New member, reduced
      amount = parseInt(process.env.MOLLIE_PAYMENT_NEW_AMOUNT_REDUCED!, 10);
    } else if (membershipRecurring && membershipType === ' regular') {
      // 2) Recurring member, regular
      amount = parseInt(process.env.MOLLIE_PAYMENT_RECURRING_AMOUNT_REGULAR!, 10);
    } else if (membershipRecurring && membershipType === ' reduced') {
      // 3) Recurring member, reduced
      amount = parseInt(process.env.MOLLIE_PAYMENT_RECURRING_AMOUNT_REDUCED!, 10);
    }

    const totalAmount = (amount * discount).toFixed(2);

    this.debug(`INFO|Membership Type: ${membershipType},Recurring: ${membershipRecurring},Calculated amount: ${totalAmount} (${amount} * ${discount})`);

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
        } (${ membershipType === 'regular' ? 'Regulär' : 'Ermässigt'})`,
        locale: Locale.de_AT,
        redirectUrl: redirectUrl ? redirectUrl : process.env.MOLLIE_CHECKOUT_REDIRECT_URL,
        webhookUrl: process.env.MOLLIE_WEBHOOK_PAYMENT,
      })
      .then(async (payment: Payment) => {
        this.debug(`INFO|Payment ${payment.id} for ${customer.id} created`);
        // Store payments as separate Redis records, for reverse lookups
        const redisPymtObj = {
          email: customer.email.toLowerCase(),
          name: customer.name,
        };
        await RedisUtil.redisClient().set(
          `${RedisUtil.molliePaymentPrefix}:${payment.id}`,
          JSON.stringify(redisPymtObj)
        ).catch((err: any) => {
          this.debug(`ERROR|${err}`);
        })

        // Add payment payload to customer record
        await RedisUtil.redisClient().get(
          `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
        ).then((custRecord: string | null) => {
          if (!custRecord) {
            this.debug(`WARN|Customer not found: ${customer.id}`);
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
          RedisUtil.redisClient().set(
            `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
            JSON.stringify(redisCustomerUpdate)
          ).catch((err: any) => {
            this.debug(`Redis: ${err}`);
          });
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

    await this.mollieClient.customers.iterate().forEach((customer) => {
      customerList.push(customer);
    });

    this.debug(`Fetched ${customerList.length} customer(s)`);

    return customerList;
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

  public async listAllPaidPayments(membershipYear: number): Promise<Payment[]> {
    this.debug(`/mollie/payments/paid`);

    const paymentsArray: Payment[] = [];
    await this.mollieClient.payments.iterate().forEach((payment) => {
      if (payment.status === PaymentStatus.paid) {
        if (CalcUtil.isInMembershipRange(payment.paidAt!.substring(0, 10), membershipYear)) {
          paymentsArray.push(payment);
        }
      }
    });
    this.debug(`Fetched ${paymentsArray.length} payment(s)`);

    return paymentsArray;
  }
}
