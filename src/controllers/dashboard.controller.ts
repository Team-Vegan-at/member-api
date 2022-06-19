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
import {RedisMemberPayload} from '../models/redis-member-payload.model';

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
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "200": {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async listTeamMembers(
    @param.query.number('year') year: number,
  ): Promise<any> {
    const memberList: any = [];
    if (year == null) {
      year = CalcUtil.getCurrentMembershipYear();
    }

    return new Promise((resolve, reject) => {
      RedisUtil.scan(
        `${RedisUtil.teamMemberPrefix}:*`
      ).then(async (matchingKeys: any) => {
        const start = async () => {
          await DashboardController.asyncForEach(matchingKeys, async memberKey => {
            await this.redisGetTeamMember(
              memberKey.replace(`${RedisUtil.teamMemberPrefix}:`, '')
            ).then((memberObj: any) => {
              const memberPayload = this.buildMemberPayload(memberObj, year);

              // Only return members who have
              // 1. Paid at least once OR
              // 2. Have an active subscription OR
              // 3. Have an active forum user
              if (Object.keys(memberPayload.discourse).length > 0
                || Object.keys(memberPayload.payment).length > 0
                || Object.keys(memberPayload.subscription).length > 0) {

                memberList.push(memberPayload);
              }
            });
          });
          resolve(memberList);
        };
        start().then(
          () => {
          },
          () => {
          },
        );

        await matchingKeys.forEach(() => {});
      }).catch((err: any) => {
        this.debug(`${err}`);
        reject(err);
      }

    );
    });
  }

  @get('/dashboard/numberofmembers', {
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
  public async numberofmembers(
    @param.query.number('year') year: number,
  ): Promise<number> {
    const memberList: any = [];
    if (year == null) {
      year = CalcUtil.getCurrentMembershipYear();
    }

    return new Promise((resolve, reject) => {
      RedisUtil.scan(
        `${RedisUtil.teamMemberPrefix}:*`
      ).then(async (matchingKeys: any) => {
        const start = async () => {
          await DashboardController.asyncForEach(matchingKeys, async memberKey => {
            await this.redisGetTeamMember(
              memberKey.replace(`${RedisUtil.teamMemberPrefix}:`, '')
            ).then((memberObj: any) => {
              const memberPayload = this.buildMemberPayload(memberObj, year);

              if (memberPayload.paid) {
                memberList.push(memberPayload);
              }
            });
          });
          resolve(memberList.length);
        };
        start().then(
          () => {},
          () => {},
        );

        await matchingKeys.forEach(() => {});
      }).catch((err: any) => {
        this.debug(`${err}`);
        reject(err);
      });
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
  ): Promise<RedisMemberPayload> {
    return new Promise((resolve, reject) => {
      RedisUtil.redisClient().get(
        `${RedisUtil.teamMemberPrefix}:${email.toLowerCase()}`,
      )
        .then((memberObj: any) => {
          this.debug(`Return ${memberObj}`);

          // const year = CalcUtil.getCurrentMembershipYear();
          // const memberPayload = this.buildMemberPayload(JSON.parse(memberObj), year);

          // return memberPayload;
          resolve(JSON.parse(memberObj));
        })
        .catch((err: any) => {
          if (err) {
            this.debug(`Redis: ${err}`);
            reject(err);
          }
        });
    });
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
        .then(async (response: any) => {
          for (const mailchimpMember of response.members) {
            // Store in Redis
            const redisCustomerPayload = {
              timestamp: moment().utc(),
              controller: 'dashboard',
              method: 'listMailchimpMembers',
              data: mailchimpMember,
            };
            await RedisUtil.redisClient().set(
              `${RedisUtil.mailchimpMemberPrefix}:${mailchimpMember.id}`,
              JSON.stringify(redisCustomerPayload))
              .then(() => {})
              .catch((err: any) => {
                this.debug(`${err}`);
              });
          }

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

    const axios = require('axios').create({
      baseURL: process.env.DISCOURSE_URL,
      headers: {
        'Api-Key': process.env.DISCOURSE_ADMIN_KEY
      }
    });

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
          .then(async (response: any) => {
            if (response.data && response.data.length > 0) {
              for (const discourseMember of response.data) {
                // Store in Redis
                const redisCustomerPayload = {
                  timestamp: moment().utc(),
                  controller: 'dashboard',
                  method: 'listDiscourseMembers',
                  data: discourseMember,
                };
                await RedisUtil.redisClient().set(
                  `${RedisUtil.discourseCustomerPrefix}:${discourseMember.id}`,
                  JSON.stringify(redisCustomerPayload))
                  .then(() => {})
                  .catch((err: any) => {
                    this.debug(`${err}`);
                  });
              }
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

    for (const cust of mollieCustomers) {
      // Store in Redis
      const redisCustomerPayload = {
        timestamp: moment().utc(),
        controller: 'dashboard',
        method: 'listMollieMembers',
        data: cust,
      };
      await RedisUtil.redisClient().set(
        `${RedisUtil.mollieCustomerPrefix}:${cust.id}`,
        JSON.stringify(redisCustomerPayload)
      ).then(() => { }
      ).catch((err: any) => {
        this.debug(err);
      });
    }

    return null;
  }

  public async redisGetMollieCustomer(
    @param.query.string('mollieCustomerKey') customerId: string,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      RedisUtil.redisClient().get(
        `${RedisUtil.mollieCustomerPrefix}:${customerId}`,
      )
        .then((reply: any) => {
          this.debug(`Return ${reply}`);
          resolve(JSON.parse(reply));
        })
        .catch((err: any) => {
          if (err) {
            this.debug(`Redis: ${err}`);
            reject(err);
          }
        });
    });
  }

  public async redisGetDiscourseCustomer(
    @param.query.string('customerId') customerId: string,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      RedisUtil.redisClient().get(
        `${RedisUtil.discourseCustomerPrefix}:${customerId}`,
      )
        .then((reply: any) => {
          this.debug(`Return ${reply}`);
          resolve(JSON.parse(reply));
        })
        .catch((err: any) => {
          if (err) {
            this.debug(`Redis: ${err}`);
            reject(err);
          }
        });
    });
  }

  public async redisGetMailchimpMember(
    memberId: string,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      RedisUtil.redisClient().get(
        `${RedisUtil.mailchimpMemberPrefix}:${memberId}`,
      )
        .then((reply: any) => {
          this.debug(`Return ${reply}`);
          resolve(JSON.parse(reply));
        })
        .catch((err: any) => {
          if (err) {
            this.debug(`Redis: ${err}`);
            reject(err);
          }
        });
    });
  }

  public async redisGetMollieCustomers(): Promise<any> {
    return new Promise((resolve, reject) => {
      RedisUtil.scan(
        `${RedisUtil.mollieCustomerPrefix}:*`,
      ).then(async (matchingKeys: any) => {
        // matchingKeys will be an array of strings if matches were found
        // otherwise it will be an empty array.
        this.debug(`Return ${matchingKeys}`);
        // return JSON.parse(matchingKeys);
        resolve(matchingKeys);
      }).catch((err: any) => {
        this.debug(`${err}`);
        reject(err);
      })
    });
  }

  public async redisGetDiscourseCustomers(): Promise<any> {
    return new Promise((resolve, reject) => {
      RedisUtil.scan(
        `${RedisUtil.discourseCustomerPrefix}:*`,
      ).then((matchingKeys: any) => {
          // matchingKeys will be an array of strings if matches were found
          // otherwise it will be an empty array.
          this.debug(`Return ${matchingKeys}`);
          // return JSON.parse(matchingKeys);
          resolve(matchingKeys);
        },
      ).catch((err: any) => {
        this.debug(err);
        reject(err);
      });
    });
  }

  public async redisGetMailchimpMembers(): Promise<any> {
    return new Promise((resolve, reject) => {
      RedisUtil.scan(
        `${RedisUtil.mailchimpMemberPrefix}:*`,
      ).then((matchingKeys: any) => {
          // matchingKeys will be an array of strings if matches were found
          // otherwise it will be an empty array.
          this.debug(`Return ${matchingKeys}`);
          resolve(matchingKeys);
        },
      ).catch((err: any) => {
        this.debug(err);
        reject(err);
      });
    });
  }

  private static async asyncForEach(
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
    let discourseStatus = 'na';
    let mollieCustId: string | undefined;

    // Discourse Details
    let discourse = {};
    if (memberObj.discourseObj && Object.keys(memberObj.discourseObj).length > 0) {
      discourse = {
        id: memberObj.discourseObj.id,
        suspended_at: memberObj.discourseObj.suspended_at,
        username: memberObj.discourseObj.username,
      };

      discourseStatus = memberObj.discourseObj.suspended_at
        && Object.keys(memberObj.discourseObj.suspended_at).length > 0 ?
        'suspended' : 'active';
    }

    // Mailchimp Details
    const mailchimpId = memberObj?.mailchimpObj?.web_id;
    const dob = memberObj?.mailchimpObj?.merge_fields?.BIRTHDAY;

    // Subscription Details
    let subscription = {};
    if (memberObj.mollieSubscriptions && memberObj.mollieSubscriptions !== {}) {
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
          CalcUtil.isInMembershipRange(pymt.paidAt!, year) && (
          pymt.status === PaymentStatus.open ||
          pymt.status === PaymentStatus.pending ||
          pymt.status === PaymentStatus.expired)
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
    return {
      activeSubscription,
      email: memberObj.email.toLowerCase(),
      discourse,
      discourseStatus,
      dob,
      mollieCustId,
      mailchimpId,
      name: memberObj.name,
      paid,
      payment,
      subscription,
    };
  }
}
