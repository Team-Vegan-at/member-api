/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {authenticate} from '@loopback/authentication';
import {del, get, param, post, requestBody} from '@loopback/rest';
import {MandateData} from '@mollie/api-client/dist/types/src/data/customers/mandates/data';
import {SubscriptionData} from '@mollie/api-client/dist/types/src/data/subscription/data';
import {MandatePayload} from '../models/mandate-payload.model';
import {MandateResult} from '../models/mandate-return.model';
import {ProfileResult} from '../models/profile-return.model';
import {SubscriptionResult} from '../models/subscription-return.model';
import {DashboardController} from './dashboard.controller';
import {Mandate} from './membership/mandate';
import {Payment} from './membership/payment';
import {Profile} from './membership/profile';
import {Subscription} from './membership/subscription';
import {MollieController} from './mollie.controller';

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

  @get('/membership/subscriptions', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
        description: 'Retrieve all users subscriptions',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async getSubscriptions(
    @param.query.string('email') email: string
  ): Promise<SubscriptionResult | null> {
    this.debug(`/membership/subscriptions`);

    return new Promise((resolve, reject) => {
      const ms = new Subscription();
      ms.getSubscriptions(email)
        .then((subscriptions: any) => resolve(subscriptions))
        .catch((reason: any) => reject(reason));
    });
  }

  @del('/membership/subscriptions', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async cancelSubscriptions(
    @param.query.string('email') email: string
  ): Promise<null> {
    this.debug(`/membership/subscriptions`);

    return new Promise((resolve, reject) => {
      const ms = new Subscription();
      ms.deleteSubscriptions(email)
        .then(() => resolve(null))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/payments', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
        description: 'Retrieve all users payments',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async getPayments(
    @param.query.string('email') email: string
  ): Promise<MandateResult | null> {
    this.debug(`/membership/payments`);

    return new Promise((resolve, reject) => {
      const mp = new Payment();
      mp.getPayments(email)
        .then((payments: any) => resolve(payments))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/onceoffpayment', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true},
      {name: 'redirectUrl', schema: {type: 'string'}, in: 'query', required: false}
    ],
    responses: {
      '200': {
        description: 'Generate Mollie Checkout link',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async getOnceoffpaymentLink(
    @param.query.string('email') email: string,
    @param.query.string('redirectUrl') redirectUrl: string
  ): Promise<MandateResult | null> {
    this.debug(`/membership/onceoffpayment`);

    return new Promise((resolve, reject) => {
      const mc = new MollieController();
      mc.getCheckoutUrl(email, redirectUrl)
        .then((checkoutUrl: any) => resolve(checkoutUrl))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/profile', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
      // {name: 'acctok', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
        description: 'User Profile',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  // @authenticate('team-vegan-jwt')
  async getProfile(
    @param.query.string('email') accessToken: string
  ): Promise<ProfileResult | null> {
    this.debug(`/membership/profile`);

    return new Promise((resolve, reject) => {
      const mp = new Profile();
      mp.getProfile(accessToken)
        .then((profile: any) => resolve(profile))
        .catch((reason: any) => reject(reason));
    });
  }

  @post('/membership/login', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
      },
    },
  })
  public async login(
    @param.query.string('email') email: string
  ): Promise<null> {
    this.debug(`/membership/login`);

    const dc = new DashboardController();
    return new Promise(async (resolve, reject) => {

      await dc.redisGetTeamMember(email)
        .then(async (custObj: any) => {
        if (custObj == null) {
          this.debug(`${email} not found`);
          return resolve(null);
        }

        const mailgun = require("mailgun-js");
        const DOMAIN = "mg.teamvegan.at";
        const mg = mailgun({
          apiKey: process.env.MAILGUN_API,
          domain: DOMAIN,
          host: "api.eu.mailgun.net"
        });
        const data = {
          from: "Team Vegan <noreply@mg.teamvegan.at>",
          to: email,
          subject: "Team Vegan.at Mitgliedschaft: Login",
          template: "mitgliedschaftlogin",
          'v:loginUrl': "https://api-qs.teamvegan.at/membership/details.html?user=gerhard@dinhof.eu"
        };
        mg.messages().send(data, (error: any, body: any) => {
          if (error) {
            this.debug(error);
          } else {
            this.debug(body);
          }

          return resolve(null);
        });
      });
    });
  }
}
