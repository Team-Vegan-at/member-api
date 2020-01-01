/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {post, requestBody} from '@loopback/rest';
import util from 'util';
import moment from 'moment';

export class WebhooksController {
  private debug = require('debug')('api:WebhooksController');
  private redisClient = require('redis').createClient(
    process.env.REDIS_PORT,
    process.env.REDIS_HOST,
    {
      retry_strategy: function(options: {
        error: {code: string};
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
    this.redisClient.set(
      `hook-pay-${payload.id}`,
      JSON.stringify(redisPayload),
      (err: any, _reply: any) => {
        if (err) {
          this.debug(`Redis: ${err}`);
        } else {
          this.redisClient.get(
            `hook-pay-${payload.id}`,
            (_err: any, reply: any) => {
              this.debug(`Redis wrote: ${reply}`);
            },
          );
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
    this.redisClient.set(
      `hook-sub-${payload.subscriptionId}`,
      JSON.stringify(redisPayload),
      (err: any, _reply: any) => {
        if (err) {
          this.debug(`Redis: ${err}`);
        } else {
          this.redisClient.get(
            `hook-sub-${payload.subscriptionId}`,
            (_err: any, reply: any) => {
              this.debug(`Redis wrote: ${reply}`);
            },
          );
        }
      },
    );

    return '';
  }
}
