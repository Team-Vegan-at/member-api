/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {authenticate} from '@loopback/authentication';
import {get, param, post, requestBody} from '@loopback/rest';
import {MandateData} from '@mollie/api-client/dist/types/src/data/customers/mandates/data';
import {SubscriptionData} from '@mollie/api-client/dist/types/src/data/subscription/data';
import {MandatePayload} from '../models/mandate-payload.model';
import {MandateResult} from '../models/mandate-return.model';
import {Mandate} from './membership/mandate';
import {Subscription} from './membership/subscription';

export class MembershipController {
  private debug = require('debug')('api:MembershipController');

  constructor() {}

  @post('/membership/mandate', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
        description: 'Mandate confirmation',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async createMandate(
    @param.query.string('email') email: string,
    @requestBody() payload: MandatePayload
  ): Promise<MandateData | null> {
    this.debug(`/membership/mandate`);

    return new Promise((resolve, reject) => {
      const mm = new Mandate();
      mm.createMandate(email, payload)
        .then((mandate: any) => resolve(mandate))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/mandate', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
        description: 'Mandate confirmation',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async getMandate(
    @param.query.string('email') email: string
  ): Promise<MandateResult | null> {
    this.debug(`/membership/mandate`);

    return new Promise((resolve, reject) => {
      const mm = new Mandate();
      mm.getMandate(email)
        .then((mandate: any) => resolve(mandate))
        .catch((reason: any) => reject(reason));
    });
  }

  @post('/membership/subscription', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
        description: 'Subscription confirmation',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async createSubscription(
    @param.query.string('email') email: string
  ): Promise<SubscriptionData | null> {
    this.debug(`/membership/subscription`);

    return new Promise((resolve, reject) => {
      const ms = new Subscription();
      ms.createSubscription(email)
        .then((subscription: any) => resolve(subscription))
        .catch((reason: any) => reject(reason));
    });
  }

  private async asyncForEach(
    array: string | any[],
    callback: (arg0: any, arg1: number, arg2: any) => any,
  ) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }
}
