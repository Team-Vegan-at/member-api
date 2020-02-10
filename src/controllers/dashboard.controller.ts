/* eslint-disable @typescript-eslint/no-explicit-any */
import { get, param } from '@loopback/rest';
import { RedisUtil } from '../utils/redis.util';
import moment = require('moment');
import { MollieController } from './mollie.controller';

export class DashboardController {
  private debug = require('debug')('api:DashboardController');

  constructor() { }

  @get('/dashboard/discourse/members', {
    responses: {
      '200': {
        description: 'List discourse members and populate Redis store',
        content: {
          'application/json': {
            schema: { type: 'array' },
          },
        },
      },
    },
  })
  async listDiscourseMembers(): Promise<any[] | null> {
    this.debug(`/dashboard/discourse/members`);

    const axios = require('axios');

    axios.defaults.baseURL = process.env.DISCOURSE_URL;
    axios.defaults.headers.common['Api-Key'] = process.env.DISCOURSE_KEY;

    let fetchMore = true;

    const result = [];

    for (let x = 1; fetchMore; x++) {
      result.push(await axios.get(`/admin/users/list/active.json`, {
        params: {
          'show_emails': true,
          'page': x
        }
      })
        .then((response: any) => {

          if (response.data && response.data.length > 0) {

            response.data.forEach((discourseMember: any) => {

              // Store in Redis
              const redisCustomerPayload = {
                timestamp: moment().utc(),
                controller: 'dashboard',
                method: 'listDiscourseMembers',
                data: discourseMember
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
        }));
    }

    return result;
  }

  @get('/dashboard/mollie/members', {
    responses: {
      '200': {
        description: 'List mollie members and populate Redis store',
        content: {
          'application/json': {
            schema: { type: 'array' },
          },
        },
      },
    },
  })
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
        data: cust
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

    // return result;

    return null;
  }
}
