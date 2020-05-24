/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {get, param} from '@loopback/rest';
import {RedisUtil} from '../utils/redis.util';
import moment = require('moment');
import {MollieController} from './mollie.controller';
import {authenticate} from '@loopback/authentication';
import {Payment, PaymentStatus, PaymentMethod} from '@mollie/api-client';

export class DashboardController {
  private debug = require('debug')('api:DashboardController');

  constructor() {}

  @get('/dashboard/members', {
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async listTeamMembers(): Promise<any> {
    const memberList: any = [];
    const redisScan = require('node-redis-scan');
    const scanner = new redisScan(RedisUtil.redisClient);

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
                memberKey.replace(`${RedisUtil.teamMemberPrefix}:`, ''),
              ).then((memberObj: any) => {
                // Payment Status
                let paid = false;
                if (memberObj.molliePayments) {
                  for (let i = 0; i < memberObj.molliePayments.length; i++) {
                    paid =
                      memberObj.molliePayments[i].status === 'paid'
                        ? true
                        : paid;
                  }
                }

                // Discourse Details
                let discourse = {};
                if (memberObj.discourseObj) {
                  discourse = {
                    id: memberObj.discourseObj.id,
                    suspended_at: memberObj.discourseObj.suspended_at,
                    username: memberObj.discourseObj.username,
                  };
                }

                // Payment Details
                let payment = {};
                if (memberObj.molliePayments) {
                  let userPaid = false;
                  memberObj.molliePayments.forEach((pymt: Payment) => {
                    // skip if we already processed a paid record
                    if (userPaid) {
                      return;
                    }

                    if (pymt.status === PaymentStatus.paid) {
                      userPaid = true;
                      let payerName = '';
                      if (
                        pymt.method === PaymentMethod.banktransfer ||
                        pymt.method === PaymentMethod.eps
                      ) {
                        payerName = pymt.details!['consumerName'];
                      } else if (pymt.method === PaymentMethod.creditcard) {
                        payerName = pymt.details!['cardHolder'];
                      }

                      payment = {
                        status: pymt.status,
                        paidAt: pymt.paidAt,
                        amount: pymt.amount.value,
                        method: pymt.method,
                        payerName,
                      };
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
                  email: memberObj.email,
                  name: memberObj.name,
                  paid,
                  discourse,
                  payment,
                };
                memberList.push(memberPayload);
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
    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async redisGetTeamMember(
    @param.query.string('email') email: string,
  ): Promise<any> {
    const custObj = await RedisUtil.redisGetAsync(
      `${RedisUtil.teamMemberPrefix}:${email}`,
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

  @get('/dashboard/redis/mollie/customer', {
    parameters: [
      {
        name: 'customerId',
        schema: {type: 'string'},
        in: 'query',
        required: true,
      },
    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
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

  @get('/dashboard/redis/discourse/customer', {
    parameters: [
      {
        name: 'customerId',
        schema: {type: 'string'},
        in: 'query',
        required: true,
      },
    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
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

  @get('/dashboard/redis/mollie/customers', {
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
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

  @get('/dashboard/redis/discourse/customers', {
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
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

  private async asyncForEach(
    array: string | any[],
    callback: (arg0: any, arg1: number, arg2: any) => any,
  ) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }
}
