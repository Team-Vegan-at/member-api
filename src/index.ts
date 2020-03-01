/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-floating-promises */
import {MemberApiApplication} from './application';
import {ApplicationConfig} from '@loopback/core';
import {DashboardController} from './controllers/dashboard.controller';
import moment from 'moment';
import {RedisUtil} from './utils/redis.util';
import {MollieController} from './controllers';

export {MemberApiApplication};

export async function main(options: ApplicationConfig = {}) {
  require('dotenv').config();

  const debug = require('debug')('api:app');
  const debugCron = require('debug')('api:cron');

  const app = new MemberApiApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  debug(`Server is running at ${url}`);
  debug(`Try ${url}/ping`);

  const CronJob = require('cron').CronJob;
  const job = new CronJob('0 5 */1 * * *', async function() {
    debugCron(`Cronjob start - ${moment().format()}`);
    const dbc = new DashboardController();
    await dbc.listDiscourseMembers();
    await dbc.listMollieMembers();
    await dbc.redisGetMollieCustomers().then((custList: any) => {
      custList.forEach((custKey: string) => {
        dbc
          .redisGetMollieCustomer(
            custKey.replace(`${RedisUtil.mollieCustomerPrefix}:`, ''),
          )
          .then(async (custObj: any) => {
            debugCron(custObj);

            const mc = new MollieController();
            const paymentObj = await mc.listCustomerPayments(
              custKey.replace(`${RedisUtil.mollieCustomerPrefix}:`, ''),
            );

            RedisUtil.redisGetAsync(
              `${
                RedisUtil.teamMemberPrefix
              }:${custObj.data.email.toLowerCase()}`,
            )
              .then((reply: any) => {
                debugCron(`Redis returend ${reply}`);
                if (reply == null) {
                  // Store in Redis
                  const redisMemberPayload = {
                    name: custObj.data.name,
                    email: custObj.data.email.toLowerCase(),
                    mollieObj: custObj.data,
                    molliePayments: paymentObj,
                    discourseObj: null,
                  };
                  RedisUtil.redisClient.set(
                    `${
                      RedisUtil.teamMemberPrefix
                    }:${custObj.data.email.toLowerCase()}`,
                    JSON.stringify(redisMemberPayload),
                    (err: any, _reply: any) => {
                      if (err) {
                        debugCron(`Redis error: ${err}`);
                      }
                    },
                  );
                } else {
                  // Update in Redis
                  const updatePayload = JSON.parse(reply);
                  updatePayload.molliePayments = paymentObj;
                  RedisUtil.redisClient.set(
                    `${
                      RedisUtil.teamMemberPrefix
                    }:${custObj.data.email.toLowerCase()}`,
                    JSON.stringify(updatePayload),
                    (err: any, _reply: any) => {
                      if (err) {
                        debugCron(`Redis error: ${err}`);
                      }
                    },
                  );
                }
              })
              .catch((err: any) => {
                if (err) {
                  debugCron(`Redis error: ${err}`);
                }
              });
          });
      });

      dbc.redisGetDiscourseCustomers().then((discourseList: any) => {
        discourseList.forEach((custKey: string) => {
          dbc
            .redisGetDiscourseCustomer(
              custKey.replace(`${RedisUtil.discourseCustomerPrefix}:`, ''),
            )
            .then((custObj: any) => {
              debugCron(custObj);

              RedisUtil.redisGetAsync(
                `${RedisUtil.teamMemberPrefix}:${custObj.data.email}`,
              )
                .then((reply: any) => {
                  debugCron(`Redis returend ${reply}`);
                  if (reply == null) {
                    // Store in Redis
                    const redisMemberPayload = {
                      name: custObj.data.name,
                      email: custObj.data.email,
                      mollieObj: null,
                      molliePayments: null,
                      discourseObj: custObj.data,
                    };
                    RedisUtil.redisClient.set(
                      `${RedisUtil.teamMemberPrefix}:${custObj.data.email}`,
                      JSON.stringify(redisMemberPayload),
                      (err: any, _reply: any) => {
                        if (err) {
                          debugCron(`Redis error: ${err}`);
                        }
                      },
                    );
                  } else {
                    // Update in Redis
                    const updatePayload = JSON.parse(reply);
                    updatePayload.discourseObj = custObj.data;
                    RedisUtil.redisClient.set(
                      `${RedisUtil.teamMemberPrefix}:${custObj.data.email}`,
                      JSON.stringify(updatePayload),
                      (err: any, _reply: any) => {
                        if (err) {
                          debugCron(`Redis error: ${err}`);
                        }
                      },
                    );
                  }
                })
                .catch((err: any) => {
                  if (err) {
                    debugCron(`Redis error: ${err}`);
                  }
                });
            });
        });
      });
    });

    debugCron(`Cronjob finished - ${moment().format()}`);
  });
  job.start();

  return app;
}
