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
import {SubscriptionPayload} from '../models/subscription-payload.model';
import {SubscriptionResult} from '../models/subscription-return.model';
import {PatService} from '../services/pat.service';
import {CalcUtil} from '../utils/calc.util';
import {DashboardController} from './dashboard.controller';
import {MollieMandateService} from '../services/mollie.mandate.service';
import {MolliePaymentService} from '../services/mollie.payment.service';
import {MollieProfileService} from '../services/mollie.profile.service';
import {MollieSubscriptionService} from '../services/mollie.subscription.service';
import moment = require('moment');
import {MollieService} from '../services/mollie.service';

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
      await new PatService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mm = new MollieMandateService();
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
      await new PatService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mm = new MollieMandateService();
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
    @requestBody() payload: SubscriptionPayload
  ): Promise<SubscriptionData | null> {
    this.debug(`/membership/subscription`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PatService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const ms = new MollieSubscriptionService();
      ms.createSubscription(email, payload)
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
      await new PatService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const ms = new MollieSubscriptionService();
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
      await new PatService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const ms = new MollieSubscriptionService();
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
      await new PatService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mp = new MolliePaymentService();
      mp.getPayments(email)
        .then((payments: PaymentResult[] | null) => resolve(payments))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/onceoffpayment', {
    parameters: [
      {name: 'redirectUrl', schema: {type: 'string'}, in: 'query', required: false},
      {name: 'membershipType', schema: {type: 'string'}, in: 'query', required: false}
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
    @param.query.string('redirectUrl') redirectUrl: string,
    @param.query.string('membershipType') membershipType: string
  ): Promise<MandateResult | null> {
    this.debug(`/membership/onceoffpayment`);

    return new Promise(async (resolve, reject) => {
      const pat = this.request.header('x-pat')!;
      let email = '';
      await new PatService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mollieSvc = new MollieService();
      mollieSvc.getCheckoutUrl(email, redirectUrl, membershipType, true)
        .then((checkoutUrl: any) => resolve(checkoutUrl))
        .catch((reason: any) => reject(reason));
    });
  }

  @get('/membership/profile', {
    parameters: [
    ],
    responses: {
      '200': {
        description: 'User MollieProfileService',
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
      await new PatService().validatePAT(pat)
        .then((value: string) => { email = value })
        .catch((reason) => { return reject(reason) });

      const mp = new MollieProfileService();
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

    if (email) {
      email = email.toLowerCase();
    }
    const dc = new DashboardController();
    return new Promise(async (resolve, reject) => {

      await dc.redisGetTeamMember(email)
        .then(async (custObj: any) => {
        if (custObj == null) {
          this.debug(`${email} not found`);
          return reject(`${email} lookup error`);
        }

        // Generate access token
        const ps = new PatService();
        const pat = ps.generatePAT(email);

        // Build Login URL
        const loginUrl = `${process.env.MEMBERSHIP_URL}/details.html?pat=${pat}`;

        const formData = require('form-data');
        const Mailgun = require('mailgun.js');
        const mailgun = new Mailgun(formData);
        const DOMAIN = "mg.teamvegan.at";
        const mg = mailgun.client({
          username: 'api',
          url: "https://api.eu.mailgun.net",
          key: process.env.MAILGUN_API
        });

        const data = {
          from: "Team Vegan <noreply@mg.teamvegan.at>",
          to: email,
          subject: "Team Vegan.at Mitgliedschaft: Login",
          template: "mitgliedschaftlogin",
          'v:loginUrl': loginUrl
        };
        this.debug(`Sending login credentials to ${email}, using ${process.env.MAILGUN_API}`);

        mg.messages.create(DOMAIN, data)
          .then((msg: any) => {
            this.debug(msg);
            resolve(msg);
          })
          .catch((error: any) => {
            this.debug(error);
            reject(error);
          });
      });
    });
  }

  @post('/membership/resumepayment', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
      },
    },
  })
  public async resumepayment(
    @param.query.string('email') email: string
  ): Promise<string> {
    this.debug(`/membership/resumepayment`);

    return new Promise(async (resolve, reject) => {
      if (email) {
        email = email.toLowerCase();
      } else {
        reject("Parameter email missing");
      }

      const dc = new DashboardController();

      await dc.redisGetTeamMember(email)
        .then(async (custObj: any) => {
          if (custObj) {
            // Construct URL
            const resumepaymentUrl = `${process.env.MOLLIE_RESUME_PAYMENT}?email=${email}`;

            const formData = require('form-data');
            const Mailgun = require('mailgun.js');
            const mailgun = new Mailgun(formData);
            const DOMAIN = "mg.teamvegan.at";
            const mg = mailgun.client({
              username: 'api',
              url: "https://api.eu.mailgun.net",
              key: process.env.MAILGUN_API
            });

            const data = {
              from: "Team Vegan <noreply@mg.teamvegan.at>",
              to: email,
              bcc: process.env.MAILGUN_BCC,
              subject: "Team Vegan.at Mitgliedschaft: Zahlung abschließen",
              template: "resume-payment\n",
              'h:Reply-To': "info@teamvegan.at; admin@teamvegan.at",
              'v:membername': custObj.name,
              'v:resumepaymentUrl': resumepaymentUrl
            };
            this.debug(`Sending resume payment to ${email}, using ${process.env.MAILGUN_API}`);

            mg.messages.create(DOMAIN, data)
              .then((msg: any) => {
                this.debug(msg);
                resolve(msg);
              })
              .catch((error: any) => {
                this.debug(error);
                reject(error);
              });
          } else {
            this.debug(`${email} not found`);
            return reject(`${email} lookup error`);
          }
      });
    });
  }

  @post('/membership/reminder-dd', {
    parameters: [],
    responses: {
      '200': {
      },
    },
  })
  @authenticate('team-vegan-jwt')
  public async reminderDD(
  ): Promise<any> {
    this.debug(`/membership/reminder-dd`);

    const dbc = new DashboardController();
    const sub = new MollieSubscriptionService();

    return new Promise(async (resolve, reject) => {

      const previousYear = CalcUtil.getCurrentMembershipYear() - 1;
      this.debug(`Look up members from ${previousYear}`);

      await dbc.listTeamMembers(previousYear).then(async (custList: any) => {
        const filteredList: any = [];
        this.debug(`Filter active subscriptions only`);

        await this.asyncForEach(custList, async custObj => {
          if ('activeSubscription' in custObj) {
            if (custObj.activeSubscription === true
              && ('email' in custObj)) {

              await sub.getSubscriptions(custObj.email).then((subObj: any) => {

                filteredList.push({
                  membername: custObj.name,
                  memberemail: custObj.email,
                  obfuscatediban: subObj.consumerAccount,
                  paymentdate: subObj.nextPaymentDate,
                  paymentamount: subObj.amount,
                  paymentmandat: subObj.mandateReference
                });
                this.debug(subObj);
              });
            }
          }
        });

        const reminderEnabled = process.env.ENABLE_REMINDER_MAIL ? process.env.ENABLE_REMINDER_MAIL : "0";
        if (reminderEnabled === "0") {
          this.debug("ENABLE_REMINDER_MAIL disabled - no mails sent");
        } else {
          const formData = require('form-data');
          const Mailgun = require('mailgun.js');
          const mailgun = new Mailgun(formData);
          const DOMAIN = "mg.teamvegan.at";
          const mg = mailgun.client({
            username: 'api',
            url: "https://api.eu.mailgun.net",
            key: process.env.MAILGUN_API
          });

          await this.asyncForEach(filteredList, async (member: any) => {
            const diff = moment(member.paymentdate, "YYYY-MM-DD").diff(moment().utc(), "days");
            // Within the next month -> send reminder
            if (diff < 32) {
              this.debug(`Sending to ${member.memberemail}, for next payment ${member.paymentdate}, difference ${diff} days`);

              const data = {
                from: "Team Vegan <noreply@mg.teamvegan.at>",
                to: member.memberemail,
                subject: "Erinnerung an Zahlungseinzug",
                template: "dd-reminder",
                'h:Reply-To': "info@teamvegan.at; admin@teamvegan.at",
                'v:membername': member.membername,
                'v:obfuscatediban': member.obfuscatediban,
                'v:paymentamount': member.paymentamount,
                'v:paymentdate': member.paymentdate,
                'v:paymentmandat': member.paymentmandat
              };

              mg.messages.create(DOMAIN, data)
                .then((msg: any) => {
                  this.debug(`Sent reminder to ${member.memberemail}`);
                  this.debug(msg);
                })
                .catch((error: any) => {
                  this.debug(error);
                });
            } else {
              this.debug(`NOT sending to ${member.memberemail}, for next payment ${member.paymentdate}, difference ${diff} days`);
            }
          });
        }

        resolve(filteredList);
      });
    });
  }

  @post('/membership/reminder-expiring-membership', {
    parameters: [],
    responses: {
      '200': {
      },
    },
  })
  @authenticate('team-vegan-jwt')
  public async reminderExpiringMembership(
  ): Promise<any> {
    this.debug(`/membership/reminder-expiring-membership`);

    const dbc = new DashboardController();
    // const prof = new MollieProfileService();
    // const sub = new MollieSubscriptionService();

    return new Promise(async (resolve, reject) => {

      const currentYear = CalcUtil.getCurrentMembershipYear();
      const previousYear = currentYear - 1;
      this.debug(`Look up members from ${previousYear}`);

      await dbc.listTeamMembers(previousYear).then(async (custList: any) => {
        const filteredList: any = [];

        const custListCurrent = await dbc.listTeamMembers(currentYear);

        this.debug(`Filter non-payments for ${currentYear}`);
        custList.forEach((custPreviousYear: any) => {
          if (custPreviousYear.paid === true) {

            const custCurrentYear = custListCurrent.find((v: any) => v.email === custPreviousYear.email)

            if (custCurrentYear && custCurrentYear.paid === false) {
              // filter members who unsubscribed
              if (!['dominic.moritz@gmx.at'
                   ,'kristinwegscheidler@gmx.at'
                   ,'miriam669@hotmail.es'
                   ,'office@sdemmerer.at'
                   ,'ursula.visconti@gmail.com'
                   ,'freddy.pinteritsch@icloud.com'].includes(custCurrentYear.email)) {
                filteredList.push({
                  membername: custCurrentYear.name,
                  memberemail: custCurrentYear.email,
                  mollie: custCurrentYear.mollieCustId
                });
              }
            }
          }
        });
        this.debug(`Found ${filteredList.length} members eligible for a reminder`);

        const reminderEnabled = process.env.ENABLE_REMINDER_MAIL ? process.env.ENABLE_REMINDER_MAIL : "0";
        if (reminderEnabled === "0") {
          this.debug("ENABLE_REMINDER_MAIL disabled - no mails sent");
        } else {
          const formData = require('form-data');
          const Mailgun = require('mailgun.js');
          const mailgun = new Mailgun(formData);
          const DOMAIN = "mg.teamvegan.at";
          const mg = mailgun.client({
            username: 'api',
            url: "https://api.eu.mailgun.net",
            key: process.env.MAILGUN_API
          });

          // DEBUG
          // dbc.redisGetTeamMember("geahaad@gmail.com").then((memberObj: any) => {
          //   const member = {
          //     membername: memberObj.name,
          //     memberemail: memberObj.email,
          //   };
          // END DEBUG
          await this.asyncForEach(filteredList, async (member: any) => {
            const data = {
              from: "Team Vegan <noreply@mg.teamvegan.at>",
              to: member.memberemail,
              subject: "Erinnerung an deine Team Vegan.at Mitgliedschaft",
              template: "membership-renewal-reminder",
              'h:Reply-To': "info@teamvegan.at; admin@teamvegan.at",
              'v:membername': member.membername,
              'v:link_payment_regular': `https://api.teamvegan.at/pay?email=${member.memberemail}&recurring=1&type=regular`,
              'v:link_payment_reduced': `https://api.teamvegan.at/pay?email=${member.memberemail}&recurring=1&type=reduced`
            };

            mg.messages.create(DOMAIN, data)
              .then((msg: any) => {
                this.debug(`Sent reminder to ${member.memberemail}`);
                this.debug(msg);
              })
              .catch((error: any) => {
                this.debug(error);
              });
          });
        }

        resolve(filteredList);
      });
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
