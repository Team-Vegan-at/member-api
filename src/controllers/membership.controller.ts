/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {del, get, param, post, Request, requestBody, RestBindings} from '@loopback/rest';
import {MandateData} from '@mollie/api-client/dist/types/src/data/customers/mandates/data';
import {SubscriptionData} from '@mollie/api-client/dist/types/src/data/subscription/data';
import {MandatePayload} from '../models/mandate-payload.model';
import {MandateResult} from '../models/mandate-return.model';
import {PaymentResult} from '../models/payment-return.model';
import {ProfileResult} from '../models/profile-return.model';
import {SubscriptionResult} from '../models/subscription-return.model';
import {PATService} from '../services/pat-service';
import {DashboardController} from './dashboard.controller';
import {Mandate} from './membership/mandate';
import {Payment} from './membership/payment';
import {Profile} from './membership/profile';
import {Subscription} from './membership/subscription';
import {MollieController} from './mollie.controller';

export class MembershipController {
  private debug = require('debug')('api:MembershipController');

  constructor(@inject(RestBindings.Http.REQUEST) private request: Request) {}

  @post('/membership/mandate', {
    parameters: [
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
  @authenticate('team-vegan-pat')
  async createMandate(
    @requestBody() payload: MandatePayload
  ): Promise<MandateData | null> {
    this.debug(`/membership/mandate`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PATService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mm = new Mandate();
      mm.createMandate(email, payload)
        .then((mandate: any) => resolve(mandate))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/mandate', {
    parameters: [
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
  @authenticate('team-vegan-pat')
  async getMandate(
  ): Promise<MandateResult | null> {
    this.debug(`/membership/mandate`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PATService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mm = new Mandate();
      mm.getMandate(email)
        .then((mandate: any) => resolve(mandate))
        .catch((reason: any) => reject(reason));
    });
  }

  @post('/membership/subscription', {
    parameters: [
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
  @authenticate('team-vegan-pat')
  async createSubscription(
  ): Promise<SubscriptionData | null> {
    this.debug(`/membership/subscription`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PATService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const ms = new Subscription();
      ms.createSubscription(email)
        .then((subscription: any) => resolve(subscription))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/subscriptions', {
    parameters: [
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
  @authenticate('team-vegan-pat')
  async getSubscriptions(
  ): Promise<SubscriptionResult | null> {
    this.debug(`/membership/subscriptions`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PATService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const ms = new Subscription();
      ms.getSubscriptions(email)
        .then((subscriptions: any) => resolve(subscriptions))
        .catch((reason: any) => reject(reason));
    });
  }

  @del('/membership/subscriptions', {
    parameters: [
    ],
    responses: {
      '200': {
      },
    },
  })
  @authenticate('team-vegan-pat')
  async cancelSubscriptions(
  ): Promise<null> {
    this.debug(`/membership/subscriptions`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PATService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const ms = new Subscription();
      ms.deleteSubscriptions(email)
        .then(() => resolve(null))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/payments', {
    parameters: [
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
  @authenticate('team-vegan-pat')
  async getPayments(
  ): Promise<PaymentResult[] | null> {
    this.debug(`/membership/payments`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PATService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mp = new Payment();
      mp.getPayments(email)
        .then((payments: PaymentResult[] | null) => resolve(payments))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/onceoffpayment', {
    parameters: [
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
  @authenticate('team-vegan-pat')
  async getOnceoffpaymentLink(
    @param.query.string('redirectUrl') redirectUrl: string
  ): Promise<MandateResult | null> {
    this.debug(`/membership/onceoffpayment`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PATService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mc = new MollieController();
      mc.getCheckoutUrl(email, redirectUrl)
        .then((checkoutUrl: any) => resolve(checkoutUrl))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/profile', {
    parameters: [
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
  @authenticate('team-vegan-pat')
  async getProfile(
  ): Promise<ProfileResult | null> {
    this.debug(`/membership/profile`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PATService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mp = new Profile();
      mp.getProfile(email)
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
  ): Promise<string> {
    this.debug(`/membership/login`);

    const dc = new DashboardController();
    return new Promise(async (resolve, reject) => {

      await dc.redisGetTeamMember(email)
        .then(async (custObj: any) => {
        if (custObj == null) {
          this.debug(`${email} not found`);
          return reject();
        }

        // Generate access token
        const ps = new PATService();
        await ps.generatePAT(email)
          .then((pat: string) => {
            // Build Login URL
            const loginUrl = `${process.env.MEMBERSHIP_URL}/details.html?pat=${pat}`;

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
              'v:loginUrl': loginUrl
            };
            this.debug(`Sending login credentials to ${email}, using ${process.env.MAILGUN_API}`);

            mg.messages().send(data, (error: any, body: any) => {
              if (error) {
                this.debug(error);
              } else {
                this.debug(body);
              }

              return resolve('');
            });
          }).catch((err) => {
            return reject(err);
          });
      });
    });
  }
}
