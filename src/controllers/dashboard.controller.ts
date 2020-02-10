/* eslint-disable @typescript-eslint/no-explicit-any */
import { get, param } from '@loopback/rest';
import { RedisUtil } from '../utils/redis.util';
import moment = require('moment');
import { MollieController } from './mollie.controller';

export class DashboardController {
  private debug = require('debug')('api:DashboardController');

  constructor() { }

  @get('/dashboard/discord/members', {
    responses: {
      '200': {
        description: 'List discord members and populate Redis store',
        content: {
          'application/json': {
            schema: { type: 'array' },
          },
        },
      },
    },
  })
  async listDiscordMembers(): Promise<any[] | null> {
    this.debug(`/dashboard/discord/members`);

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
                method: 'listDiscordMembers',
                data: discourseMember
              };
              RedisUtil.redisClient.set(
                `teamveganat:discord:${discourseMember.id}`,
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
        `teamveganat:mollie:${cust.id}`,
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

  @get('/redis/customer', {
    parameters: [
      {
        name: 'customerId',
        schema: { type: 'string' },
        in: 'query',
        required: true,
      },
    ],
    responses: {
      '200': {},
    },
  })
  public async redisGetCustomer(
    @param.query.string('customerId') customerId: string,
  ): Promise<any> {
    const custObj = await RedisUtil.redisGetAsync(
      `mollie-customer-${customerId}`,
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
}
