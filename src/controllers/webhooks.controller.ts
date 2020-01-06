/* eslint-disable @typescript-eslint/no-explicit-any */
import {post, requestBody} from '@loopback/rest';
import util from 'util';
import moment from 'moment';
import {RedisUtil} from '../utils/redis.util';

export class WebhooksController {
  private debug = require('debug')('api:WebhooksController');

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
    this.debug(`Payment ${payload.id} received`);

    const redisPayload = {
      timestamp: moment().utc(),
      controller: 'webhooks',
      method: 'payments',
      data: payload,
    };
    RedisUtil.redisClient.set(
      `hook-pay-${payload.id}`,
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
      `hook-sub-${payload.subscriptionId}`,
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
