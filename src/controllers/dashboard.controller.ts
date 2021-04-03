/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {authenticate} from '@loopback/authentication';
import {get, param} from '@loopback/rest';
import {Payment, PaymentMethod, PaymentStatus, Subscription} from '@mollie/api-client';
import {
  BankTransferDetails,
  CreditCardDetails
} from '@mollie/api-client/dist/types/src/data/payments/data';
import {CalcUtil} from '../utils/calc.util';
import {RedisUtil} from '../utils/redis.util';
import {MailchimpController} from './mailchimp.controller';
import {MollieController} from './mollie.controller';
import moment = require('moment');

export class DashboardController {
  private debug = require('debug')('api:DashboardController');

  constructor() {}

  @get('/dashboard/members', {
    parameters: [
      {
        name: 'year',
        schema: {type: 'number'},
        in: 'query',
        required: false,
      },
    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async listTeamMembers(
    @param.query.number('year') year: number,
  ): Promise<any> {
    const memberList: any = [];
    const redisScan = require('node-redis-scan');
    const scanner = new redisScan(RedisUtil.redisClient);
    if (year == null) {
      year = CalcUtil.getCurrentMembershipYear();
    }

    return new Promise((resolve, reject) => {
      scanner.scan(
        `${RedisUtil.teamMemberPrefix}:*`,
        async (err: any, matchingKeys: any) => {
          if (err) {
            this.debug(`Redis error: ${err}`);
            reject();
          }

          const start = async () => {
            await this.asyncForEach(matchingKeys, async memberKey => {
              await this.redisGetTeamMember(
                memberKey.replace(`${RedisUtil.teamMemberPrefix}:`, '')
              ).then((memberObj: any) => {
                const memberPayload = this.buildMemberPayload(memberObj, year);

                // Only return members who have
                // 1. Paid at least once OR
                // 2. Have an active subscription OR
                // 3. Have an active forum user
                if ( Object.keys(memberPayload.discourse).length > 0
                  || Object.keys(memberPayload.payment).length > 0
                  || Object.keys(memberPayload.subscription).length > 0) {

                  memberList.push(memberPayload);
                }
              });
            });
            resolve(memberList);
          };
          start().then(
            () => {},
            () => {},
          );

          await matchingKeys.forEach((memberKey: string) => {});
        },
      );
    });
  }

  @get('/dashboard/member', {
    parameters: [
      {
        name: 'email',
        schema: {type: 'string'},
        in: 'query',
        required: true,
      },
      {
        name: 'year',
        schema: {type: 'number'},
        in: 'query',
        required: false,
      },

    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async redisGetTeamMember(
    @param.query.string('email') email: string
  ): Promise<any> {
    const custObj = await RedisUtil.redisGetAsync(
      `${RedisUtil.teamMemberPrefix}:${email.toLowerCase()}`,
    )
      .then((memberObj: any) => {
        this.debug(`Return ${memberObj}`);

        // const year = CalcUtil.getCurrentMembershipYear();
        // const memberPayload = this.buildMemberPayload(JSON.parse(memberObj), year);

        // return memberPayload;

        return JSON.parse(memberObj);
      })
      .catch((err: any) => {
        if (err) {
          this.debug(`Redis: ${err}`);
        }
      });

    return custObj;
  }

  @get('/dashboard/mailchimp/members', {
    responses: {
      '200': {
        description: 'List mailchimp members and populate Redis store',
        content: {
          'application/json': {
            schema: {type: 'array'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async listMailchimpMembers(): Promise<any[] | null> {
    this.debug(`/dashboard/mailchimp/members`);

    const result = [];
    const mc = new MailchimpController();

    result.push(
      await mc.listMembersInfo()
        .then((response: any) => {
          response.members?.forEach((mailchimpMember: any) => {
            // Store in Redis
            const redisCustomerPayload = {
              timestamp: moment().utc(),
              controller: 'dashboard',
              method: 'listMailchimpMembers',
              data: mailchimpMember,
            };
            RedisUtil.redisClient.set(
              `${RedisUtil.mailchimpMemberPrefix}:${mailchimpMember.id}`,
              JSON.stringify(redisCustomerPayload),
              (err: any, _reply: any) => {
                this.debug(`Redis: ${_reply}`);
                if (err) {
                  this.debug(`Redis: ${err}`);
                }
              },
            );
          });

          return response.data;
        }),
    );

    return result;
  }

  @get('/dashboard/discourse/members', {
    responses: {
      '200': {
        description: 'List discourse members and populate Redis store',
        content: {
          'application/json': {
            schema: {type: 'array'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async listDiscourseMembers(): Promise<any[] | null> {
    this.debug(`/dashboard/discourse/members`);

    const axios = require('axios');

    axios.defaults.baseURL = process.env.DISCOURSE_URL;
    axios.defaults.headers.common['Api-Key'] = process.env.DISCOURSE_KEY;

    let fetchMore = true;

    const result = [];

    for (let x = 1; fetchMore; x++) {
      result.push(
        await axios
          .get(`/admin/users/list/active.json`, {
            params: {
              show_emails: true,
              page: x,
            },
          })
          .then((response: any) => {
            if (response.data && response.data.length > 0) {
              response.data.forEach((discourseMember: any) => {
                // Store in Redis
                const redisCustomerPayload = {
                  timestamp: moment().utc(),
                  controller: 'dashboard',
                  method: 'listDiscourseMembers',
                  data: discourseMember,
                };
                RedisUtil.redisClient.set(
                  `${RedisUtil.discourseCustomerPrefix}:${discourseMember.id}`,
                  JSON.stringify(redisCustomerPayload),
                  (err: any, _reply: any) => {
                    if (err) {
                      this.debug(`Redis: ${err}`);
                    }
                  },
                );
              });
            } else {
              fetchMore = false;
            }

            return response.data;
          }),
      );
    }

    return result;
  }

  @get('/dashboard/mollie/members', {
    responses: {
      '200': {
        description: 'List mollie members and populate Redis store',
        content: {
          'application/json': {
            schema: {type: 'array'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async listMollieMembers(): Promise<any[] | null> {
    this.debug(`/dashboard/mollie/members`);

    // const result = [];
    const mc = new MollieController();
    const mollieCustomers = await mc.listCustomers();

    mollieCustomers.forEach((cust: any) => {
      // Store in Redis
      const redisCustomerPayload = {
        timestamp: moment().utc(),
        controller: 'dashboard',
        method: 'listMollieMembers',
        data: cust,
      };
      RedisUtil.redisClient.set(
        `${RedisUtil.mollieCustomerPrefix}:${cust.id}`,
        JSON.stringify(redisCustomerPayload),
        (err: any, _reply: any) => {
          if (err) {
            this.debug(`Redis: ${err}`);
          }
        },
      );
    });

    return null;
  }

  public async redisGetMollieCustomer(
    @param.query.string('mollieCustomerKey') customerId: string,
  ): Promise<any> {
    const custObj = await RedisUtil.redisGetAsync(
      `${RedisUtil.mollieCustomerPrefix}:${customerId}`,
    )
      .then((reply: any) => {
        this.debug(`Return ${reply}`);
        return JSON.parse(reply);
      })
      .catch((err: any) => {
        if (err) {
          this.debug(`Redis: ${err}`);
        }
      });

    return custObj;
  }

  public async redisGetDiscourseCustomer(
    @param.query.string('customerId') customerId: string,
  ): Promise<any> {
    const custObj = await RedisUtil.redisGetAsync(
      `${RedisUtil.discourseCustomerPrefix}:${customerId}`,
    )
      .then((reply: any) => {
        this.debug(`Return ${reply}`);
        return JSON.parse(reply);
      })
      .catch((err: any) => {
        if (err) {
          this.debug(`Redis: ${err}`);
        }
      });

    return custObj;
  }

  public async redisGetMailchimpMember(
    memberId: string,
  ): Promise<any> {
    const custObj = await RedisUtil.redisGetAsync(
      `${RedisUtil.mailchimpMemberPrefix}:${memberId}`,
    )
      .then((reply: any) => {
        this.debug(`Return ${reply}`);
        return JSON.parse(reply);
      })
      .catch((err: any) => {
        if (err) {
          this.debug(`Redis: ${err}`);
        }
      });

    return custObj;
  }

  public async redisGetMollieCustomers(): Promise<any> {
    const redisScan = require('node-redis-scan');
    const scanner = new redisScan(RedisUtil.redisClient);

    return new Promise((resolve, reject) => {
      scanner.scan(
        `${RedisUtil.mollieCustomerPrefix}:*`,
        (err: any, matchingKeys: any) => {
          if (err) {
            this.debug(`Redis error: ${err}`);
            reject();
          }

          // matchingKeys will be an array of strings if matches were found
          // otherwise it will be an empty array.
          this.debug(`Return ${matchingKeys}`);
          // return JSON.parse(matchingKeys);
          resolve(matchingKeys);
        },
      );
    });
  }

  public async redisGetDiscourseCustomers(): Promise<any> {
    const redisScan = require('node-redis-scan');
    const scanner = new redisScan(RedisUtil.redisClient);

    return new Promise((resolve, reject) => {
      scanner.scan(
        `${RedisUtil.discourseCustomerPrefix}:*`,
        (err: any, matchingKeys: any) => {
          if (err) {
            this.debug(`Redis error: ${err}`);
            reject();
          }

          // matchingKeys will be an array of strings if matches were found
          // otherwise it will be an empty array.
          this.debug(`Return ${matchingKeys}`);
          // return JSON.parse(matchingKeys);
          resolve(matchingKeys);
        },
      );
    });
  }

  public async redisGetMailchimpMembers(): Promise<any> {
    const redisScan = require('node-redis-scan');
    const scanner = new redisScan(RedisUtil.redisClient);

    return new Promise((resolve, reject) => {
      scanner.scan(
        `${RedisUtil.mailchimpMemberPrefix}:*`,
        (err: any, matchingKeys: any) => {
          if (err) {
            this.debug(`Redis error: ${err}`);
            reject();
          }

          // matchingKeys will be an array of strings if matches were found
          // otherwise it will be an empty array.
          this.debug(`Return ${matchingKeys}`);
          resolve(matchingKeys);
        },
      );
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

  private buildMemberPayload(memberObj: any, year: number) {
    // Shorthands
    let paid = false;
    let activeSubscription = false;
    let mollieCustId: string | undefined;

    // Discourse Details
    let discourse = {};
    if (memberObj.discourseObj && Object.keys(memberObj.discourseObj).length > 0) {
      discourse = {
        id: memberObj.discourseObj.id,
        suspended_at: memberObj.discourseObj.suspended_at,
        username: memberObj.discourseObj.username,
      };
    }

    // Mailchimp Details
    const mailchimpId = memberObj?.mailchimpObj?.web_id;

    // Subscription Details
    let subscription = {};
    if (memberObj.mollieSubscriptions) {
      memberObj.mollieSubscriptions.forEach((subscr: Subscription) => {
        activeSubscription = true;
        subscription = {
          id: subscr.id,
          startDate: subscr.startDate,
          nextPaymentDate: subscr.nextPaymentDate,
        };
      });
    }

    // Payment Details
    let payment = {};
    if (memberObj.molliePayments) {
      memberObj.molliePayments.forEach((pymt: Payment) => {
        mollieCustId = pymt.customerId;

        // skip if we already processed a paid record
        if (paid) {
          return;
        }

        if (pymt.status === PaymentStatus.paid
          && CalcUtil.isInMembershipRange(pymt.paidAt!, year)) {

          // Check for Chargeback
          // eslint-disable-next-line no-prototype-builtins
          if (!pymt.hasOwnProperty("amountChargedBack")) {

            paid = true;
            let payerName = '';
            if (
              pymt.method === PaymentMethod.banktransfer ||
              pymt.method === PaymentMethod.eps
            ) {
              payerName = (pymt.details as BankTransferDetails)
                .consumerName;
            } else if (pymt.method === PaymentMethod.creditcard) {
              payerName = (pymt.details as CreditCardDetails)
                .cardHolder;
            }

            payment = {
              status: pymt.status,
              paidAt: pymt.paidAt,
              amount: pymt.amount.value,
              method: pymt.method,
              payerName,
            };
          }
        } else if (
          pymt.status === PaymentStatus.open ||
          pymt.status === PaymentStatus.pending ||
          pymt.status === PaymentStatus.expired
        ) {
          payment = {
            status: pymt.status,
            createdAt: pymt.createdAt,
            method: pymt.method,
          };
        } else {
          payment = {
            status: pymt.status,
          };
        }
      });
    }

    const memberPayload = {
      activeSubscription,
      email: memberObj.email.toLowerCase(),
      discourse,
      mollieCustId,
      mailchimpId,
      name: memberObj.name,
      paid,
      payment,
      subscription,
    };

    return memberPayload;
  }
}
