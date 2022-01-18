/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {HttpErrors, post, requestBody} from '@loopback/rest';
import createMollieClient, {Payment} from '@mollie/api-client';
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

    this.mollieClient.payments
      .get(payload.id)
      .then(async (payment: Payment) => {
        this.debug(`Fetched payment details for ${payload.id}`);

        // Update payment payload in customer record
        await RedisUtil.redisGetAsync(
          `${RedisUtil.mollieCustomerPrefix}:${payment.customerId}`,
        ).then((custRecord: string | null) => {
          if (!custRecord) {
            this.debug(`Customer not found: ${payment.customerId}`);
            throw new HttpErrors.InternalServerError(`Customer not found`);
          }
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
            redisCustomerUpdate.payments.push(redisPaymentPayload);
          }

          RedisUtil.redisClient.set(
            `${RedisUtil.mollieCustomerPrefix}:${payment.customerId}`,
            JSON.stringify(redisCustomerUpdate),
            (err: any, _reply: any) => {
              if (err) {
                this.debug(`Redis: ${err}`);
              }
            },
          );
        });
      })
      .catch(reason => {
        this.debug(reason);
        throw new HttpErrors.InternalServerError(reason);
      });

    const redisPayload = {
      timestamp: moment().utc(),
      controller: 'webhooks',
      method: 'payments',
      data: payload,
    };
    RedisUtil.redisClient.set(
      `${RedisUtil.whPaymentsPrefix}-${payload.id}`,
      JSON.stringify(redisPayload),
      (err: any, _reply: any) => {
        if (err) {
          this.debug(`Redis: ${err}`);
        }
      },
    );

    return '';
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

    const redisPayload = {
      timestamp: moment().utc(),
      controller: 'webhooks',
      method: 'subscription',
      data: payload,
    };
    RedisUtil.redisClient.set(
      `${RedisUtil.whSubscriptionPrefix}-${payload.subscriptionId}`,
      JSON.stringify(redisPayload),
      (err: any, _reply: any) => {
        if (err) {
          this.debug(`Redis: ${err}`);
        }
      },
    );

    return '';
  }
}
