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
    this.debug(`DEBUG|${util.inspect(payload, false, null, true)}`);

    return new Promise((resolve, reject) => {
      // Persisting incoming webhooks
      const redisPayload = {
        timestamp: moment().utc(),
        controller: 'webhooks',
        method: 'payments',
        data: payload,
      };

      return RedisUtil.redisClient().set(
        `${RedisUtil.whPaymentsPrefix}:${payload.id}`,
        JSON.stringify(redisPayload))
        .then((result: any) => {
          this.debug(`DEBUG|${RedisUtil.whPaymentsPrefix}:${payload.id}|${JSON.stringify(redisPayload)}`);

          return this.mollieClient.payments
            .get(payload.id)
            .then(async (payment: Payment) => {
              this.debug(`DEBUG|Fetched Mollie payment for ${payload.id}`);

              if (payment.status === PaymentStatus.paid) {
                // Update payment payload in customer record
                return RedisUtil.redisClient().get(
                  `${RedisUtil.mollieCustomerPrefix}:${payment.customerId}`)
                  .then((custRecord: string | null) => {
                    if (!custRecord) {
                      this.debug(`WARN|Customer not found|${payment.customerId}`);
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
                        this.debug(`WARN|Payment not found|${payment.id}|${payment.customerId}`);
                        redisCustomerUpdate.payments.push(redisPaymentPayload);
                        this.debug(`DEBUG|${JSON.stringify(redisPaymentPayload)}`);
                      }

                      RedisUtil.redisClient().set(
                        `${RedisUtil.mollieCustomerPrefix}:${payment.customerId}`,
                        JSON.stringify(redisCustomerUpdate))
                        .then(() => {
                          this.debug(`DEBUG|${RedisUtil.mollieCustomerPrefix}:${payment.customerId}|${JSON.stringify(redisPaymentPayload)}`);
                        })
                        .catch((err: any) => {
                          this.debug(`ERROR|${err}`);
                          reject(err);
                        }
                      );

                      // +++ Send invitation(s)
                      // Retrieve payment to customer mapped record
                      return RedisUtil.redisClient().get(
                          `${RedisUtil.molliePaymentPrefix}:${payload.id}`)
                        .then(async (paymentRecord: any) => {
                          paymentRecord = JSON.parse(paymentRecord);
                          // this.debug(`DEBUG|${util.inspect(paymentRecord, false, null, true)}`)
                          this.debug(`DEBUG|Payment ${payload.id} mapped to ${paymentRecord.email}`);
                          return RedisUtil.redisClient().get(
                              `${RedisUtil.teamMemberPrefix}:${paymentRecord.email.toLowerCase()}`)
                            .then(async (member: any) => {
                              member = JSON.parse(member);
                              // Send welcome mail
                              this.debug(`INFO|Sending welcome mail to ${member.name} (${member.email})`);
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
                                from: process.env.MAILGUN_FROM,
                                to: member.email,
                                bcc: process.env.MAILGUN_BCC,
                                subject: "Willkommen im Team Vegan.at",
                                template: "welcome",
                                'h:Reply-To': process.env.MAILGUN_REPLYTO,
                                'v:membername': member.name,
                              };

                              mg.messages.create(DOMAIN, data)
                                .then((msg: any) => {
                                  this.debug(`INFO|Sent welcome mail to ${member.email}|${JSON.stringify(util.inspect(msg, false, null, true))}`);
                                })
                                .catch((error: any) => {
                                  this.debug(`ERROR|${error}`);
                                });

                              // TODO Send Discourse invite
                              this.debug(`INFO|Sending discourse invite to ${member.name} (${member.email})`);
                              resolve(payload.id);
                            })
                            .catch((err: any) => {
                              this.debug(`ERROR|${err}`);
                              reject(err);
                            })
                        })
                        .catch((err: any) => {
                          this.debug(`ERROR|${err}`);
                          reject(err);
                        });
                    }
                  });
                } else {
                this.debug(`WARN|Payment status not 'paid': ${payment.id} - ${payment.status}`);
                reject(payment.id);
              }
            })
            .catch((err: any) => {
              this.debug(`ERROR|${err}`);
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
        `${RedisUtil.whSubscriptionPrefix}:${payload.subscriptionId}`,
        JSON.stringify(redisPayload))
        .then((result: any) => {
          this.debug(`DEBUG|${RedisUtil.whSubscriptionPrefix}:${payload.subscriptionId}|${JSON.stringify(redisPayload)}`);
          resolve(payload.subscriptionId);
        })
        .catch((err: any) => {
          this.debug(`ERROR|${err}`);
          reject(err);
        });
    });
  }
}
