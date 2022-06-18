/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {post, requestBody} from '@loopback/rest';
import createMollieClient, {Payment, PaymentStatus} from '@mollie/api-client';
import moment from 'moment';
import util from 'util';
import {RedisUtil} from '../utils/redis.util';

export class WebhooksController {
  private debug = require('debug')('api:WebhooksController');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  constructor() {}

  @post('/mollie/payments/webhook', {
    responses: {
      '200': {},
    },
  })
  async molliePaymentsWebhook(
    @requestBody({
      required: true,
      content: {
        'application/x-www-form-urlencoded': {
          schema: {
            type: 'object',
            properties: {
              id: {type: 'string'},
            },
          },
        },
      },
    })
    payload: {
      id: string;
    },
  ): Promise<string> {
    this.debug(`${util.inspect(payload, false, null, true)}`);
    this.debug(`Payment update ${payload.id} received`);

    return new Promise((resolve, reject) => {
      // Logging incoming webhooks
      const redisPayload = {
        timestamp: moment().utc(),
        controller: 'webhooks',
        method: 'payments',
        data: payload,
      };

      return RedisUtil.redisClient().set(
        `${RedisUtil.whPaymentsPrefix}-${payload.id}`,
        redisPayload)
        .then((result: any) => {
          this.debug(`Redis|${RedisUtil.whPaymentsPrefix}-${payload.id}|${JSON.stringify(redisPayload)}`);

          return this.mollieClient.payments
            .get(payload.id)
            .then(async (payment: Payment) => {
              this.debug(`Fetched payment details for ${payload.id}`);

              if (payment.status === PaymentStatus.paid) {
                // Update payment payload in customer record
                return RedisUtil.redisClient().get(
                  `${RedisUtil.mollieCustomerPrefix}:${payment.customerId}`)
                  .then((custRecord: string | null) => {
                    if (!custRecord) {
                      this.debug(`Customer not found|${payment.customerId}`);
                      reject(`Customer not found`);
                    } else {
                      const redisPaymentPayload = {
                        timestamp: moment().utc(),
                        controller: 'mollie',
                        method: 'checkout',
                        data: payment,
                      };

                      const redisCustomerUpdate = JSON.parse(custRecord);

                      let found = false;
                      if (!redisCustomerUpdate.payments) {
                        redisCustomerUpdate.payments = [];
                      }

                      redisCustomerUpdate.payments.forEach(
                        (custPayment: any, index: number) => {
                          if (payment.id === custPayment.data.id) {
                            redisCustomerUpdate.payments[index] = redisPaymentPayload;
                            found = true;
                          }
                        },
                        redisCustomerUpdate.payments,
                      );

                      if (!found) {
                        this.debug(`Payment not found|${payment.id}|${payment.customerId}`);
                        redisCustomerUpdate.payments.push(redisPaymentPayload);
                        this.debug(`Redis|${JSON.stringify(redisPaymentPayload)}`);
                      }

                      RedisUtil.redisClient().set(
                        `${RedisUtil.mollieCustomerPrefix}:${payment.customerId}`,
                        JSON.stringify(redisCustomerUpdate))
                        .then(() => {
                          this.debug(`${RedisUtil.mollieCustomerPrefix}:${payment.customerId}|${JSON.stringify(redisPaymentPayload)}`);
                        })
                        .catch((err: any) => {
                          this.debug(`Redis|ERR|${err}`);
                          reject(err);
                        }
                      );

                      // TODO Invite to Discourse
                      // Scan through customer objects
                      this.debug(`CustomerObj|${JSON.stringify(redisCustomerUpdate)}`);

                      // TODO Send Invitation Mail

                      resolve(payload.id);

                    }
                  });
                }
            })
            .catch((err: any) => {
              this.debug(`Redis|ERR|${err}`);
              reject(err);
            });
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  @post('/mollie/subscriptions/webhook', {
    responses: {
      '200': {},
    },
  })
  async mollieSubscriptionsWebhook(
    @requestBody({
      required: true,
      content: {
        'application/x-www-form-urlencoded': {
          schema: {
            type: 'object',
            properties: {
              subscriptionId: {type: 'string'},
            },
          },
        },
      },
    })
    payload: {
      subscriptionId: string;
    },
  ): Promise<string> {
    this.debug(`${util.inspect(payload, false, null, true)}`);
    this.debug(`Subscription ${payload.subscriptionId} received`);

    return new Promise((resolve, reject) => {
      // Logging incoming webhooks
      const redisPayload = {
        timestamp: moment().utc(),
        controller: 'webhooks',
        method: 'subscription',
        data: payload,
      };

      return RedisUtil.redisClient().set(
        `${RedisUtil.whSubscriptionPrefix}-${payload.subscriptionId}`,
        redisPayload)
        .then((result: any) => {
          this.debug(`Redis|${RedisUtil.whSubscriptionPrefix}-${payload.subscriptionId}|${JSON.stringify(redisPayload)}`);
          resolve(payload.subscriptionId);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }
}
