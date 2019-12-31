import {post, requestBody} from '@loopback/rest';
import util from 'util';

export class WebhooksController {
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
    console.debug(util.inspect(payload, false, null, true));
    console.info(`Paymend ${payload.id} received`);

    return '';
  }

  @post('/mollie/payments/webhook', {
    responses: {
      '200': {},
    },
  })
  async mollieSubscriptionWebhook(
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
    console.debug(util.inspect(payload, false, null, true));
    console.info(`Subscription ${payload.subscriptionId} received`);

    return '';
  }
}
