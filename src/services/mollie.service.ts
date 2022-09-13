import {DashboardController} from '../controllers';
import {createMollieClient, Customer, List, Locale, Payment, SubscriptionStatus} from '@mollie/api-client';
import moment from 'moment';
import {RedisUtil} from '../utils/redis.util';
import {param} from '@loopback/rest';
import {SubscriptionData} from '@mollie/api-client/dist/types/src/data/subscription/data';

export class MollieService {
  private debug = require('debug')('api:MollieService');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  constructor() {}

  public async getCheckoutUrl(email: string, redirectUrl?: string, membershipType = 'regular', membershipRecurring = false) {
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

  public async listCustomers(): Promise<Customer[]> {
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
}
