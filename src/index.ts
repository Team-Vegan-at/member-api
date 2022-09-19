/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {ApplicationConfig} from '@loopback/core';
import {Payment, PaymentStatus, Subscription, SubscriptionStatus} from '@mollie/api-client';
import moment from 'moment';
import {MemberApiApplication} from './application';
import {MollieController} from './controllers';
import {DashboardController} from './controllers/dashboard.controller';
import {MailchimpController} from './controllers/mailchimp.controller';
import {CalcUtil} from './utils/calc.util';
import {RedisUtil} from './utils/redis.util';
import {RedisMemberPayload} from './models/redis-member-payload.model';

export {MemberApiApplication};

export async function main(options: ApplicationConfig = {}) {
  const debug = require('debug')('api:app');
  const debugCron = require('debug')('api:cron');
  const debugRedis = require('debug')('redis');

  const app = new MemberApiApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  debug(`Server is running at ${url}`);
  debug(`Try ${url}/ping`);

  if (process.env.DISABLE_CRON !== '1') {
    const CronJob = require('cron').CronJob;
    const job = new CronJob('0 5 */1 * * *', async function() {
      debug(`Cronjob start - ${moment().format()}`);

      await cronProcessMembers(debugCron, debugRedis);

      debug(`Cronjob finished - ${moment().format()}`);
    });
    job.start();
  }

  // Clean up
  if (process.env.DISABLE_REDIS_CLEANUP !== '1') {
    await RedisUtil.cleanup();
  }
  // Once off cron start
  if (process.env.DISABLE_CRON_FIRE_ON_STARTUP !== '1') {
    await cronProcessMembers(debugCron, debugRedis);
  }

  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.PORT ?? 3000),
      host: process.env.HOST,
      // The `gracePeriodForClose` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is `Infinity`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to `0`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
    },
  };
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}

async function cronProcessMembers(debugCron: any, debugRedis: any) {
  const mc = new MollieController();
  const dbc = new DashboardController();
  const mcc = new MailchimpController();

  await dbc.listDiscourseMembers();
  await dbc.listMailchimpMembers();
  await dbc.listMollieMembers();

  await dbc.redisGetMollieCustomers().then(async (custList: any) => {
    await custList.forEach((custKey: string) => {
      dbc
        .redisGetMollieCustomer(
          custKey.replace(`${RedisUtil.mollieCustomerPrefix}:`, ''),
        )
        .then(async (custObj: any) => {
          debugCron(`DEBUG|Processing ${custObj.data.email}`);
          // Fetch customer payments
          const paymentObj = await mc.listCustomerPayments(
            custKey.replace(`${RedisUtil.mollieCustomerPrefix}:`, ''),
          );
          // Store payments as separate Redis records, for reverse lookups
          debugCron(`DEBUG|Found ${paymentObj.length} payments for ${custObj.data.email.toLowerCase()}`);
          for (const pymt of paymentObj) {
            const redisPymtObj = {
              email: custObj.data.email.toLowerCase(),
              name: custObj.data.name,
            };
            await RedisUtil.redisClient().set(
              `${RedisUtil.molliePaymentPrefix}:${pymt.id}`,
              JSON.stringify(redisPymtObj)
            ).catch((err: any) => {
              debugCron(`ERROR|${err}`);
            })
          }

          const subscriptionObj = await mc.listCustomerSubscriptions(
            custKey.replace(`${RedisUtil.mollieCustomerPrefix}:`, ''),
          );

          await RedisUtil.redisClient().get(
            `${RedisUtil.teamMemberPrefix}:${custObj.data.email.toLowerCase()}`,
          )
            .then(async (reply: any) => {
              debugRedis(reply);
              if (reply == null) {
                // Store new record in Redis
                const redisMemberPayload: RedisMemberPayload = new RedisMemberPayload({
                  name: custObj.data.name,
                  email: custObj.data.email.toLowerCase(),
                  mollieObj: custObj.data,
                  molliePayments: paymentObj,
                  mollieSubscriptions: subscriptionObj,
                  discourseObj: null
                });
                await RedisUtil.redisClient().set(
                  `${
                    RedisUtil.teamMemberPrefix
                  }:${custObj.data.email.toLowerCase()}`,
                  JSON.stringify(redisMemberPayload)
                ).catch((err: any) => {
                  debugCron(`ERROR|${err}`);
                });
              } else {
                // Update in Redis
                const updatePayload = JSON.parse(reply);
                updatePayload.name = custObj.data.name;
                updatePayload.mollieObj = custObj.data;
                updatePayload.molliePayments = paymentObj;
                updatePayload.mollieSubscriptions = subscriptionObj;
                RedisUtil.redisClient().set(
                  `${
                    RedisUtil.teamMemberPrefix
                  }:${custObj.data.email.toLowerCase()}`,
                  JSON.stringify(updatePayload)
                ).catch((err: any) => {
                  debugCron(`ERROR|${err}`);
                });
              }
            })
            .catch((err: any) => {
              if (err) {
                debugCron(`ERROR|${err}`);
              }
            });
        });
    });
    await dbc.redisGetDiscourseCustomers().then(async (discourseList: any) => {
      await discourseList.forEach((custKey: string) => {
        dbc
          .redisGetDiscourseCustomer(
            custKey.replace(`${RedisUtil.discourseCustomerPrefix}:`, ''),
          )
          .then((custObj: any) => {
            debugCron(`DEBUG|redisGetDiscourseCustomers|Processing ${custObj.data.email}`);
            RedisUtil.redisClient().get(
              `${
                RedisUtil.teamMemberPrefix
              }:${custObj.data.email.toLowerCase()}`,
            )
              .then((reply: any) => {
                debugRedis(`${reply}`);
                if (reply == null) {
                  // Store in Redis
                  const redisMemberPayload: RedisMemberPayload = new RedisMemberPayload({
                    name: custObj.data.name,
                    email: custObj.data.email.toLowerCase(),
                    mollieObj: null,
                    molliePayments: null,
                    mollieSubscriptions: null,
                    discourseObj: custObj.data,
                  });
                  RedisUtil.redisClient().set(
                    `${
                      RedisUtil.teamMemberPrefix
                    }:${custObj.data.email.toLowerCase()}`,
                    JSON.stringify(redisMemberPayload)
                  ).catch((err: any) => {
                    debugRedis(`${err}`);
                  });
                } else {
                  // Update in Redis
                  const updatePayload = JSON.parse(reply);
                  updatePayload.discourseObj = custObj.data;
                  RedisUtil.redisClient().set(
                    `${
                      RedisUtil.teamMemberPrefix
                    }:${custObj.data.email.toLowerCase()}`,
                    JSON.stringify(updatePayload)
                  ).catch((err: any) => {
                    debugRedis(`ERROR|${err}`);
                  });
                }
              })
              .catch((err: any) => {
                if (err) {
                  debugRedis(`${err}`);
                }
              });
          });
      });
    });
    await dbc.redisGetMailchimpMembers().then(async (mailchimpList: any) => {
      await mailchimpList.forEach((custKey: string) => {
        dbc
          .redisGetMailchimpMember(
            custKey.replace(`${RedisUtil.mailchimpMemberPrefix}:`, ''),
          )
          .then((custObj: any) => {
            debugCron(custObj);
            RedisUtil.redisClient().get(
              `${
                RedisUtil.teamMemberPrefix
              }:${custObj.data.email_address.toLowerCase()}`,
            )
              .then((reply: any) => {
                debugRedis(`${reply}`);
                if (reply == null) {
                  // Store in Redis
                  const redisMemberPayload = {
                    name: `${custObj.data.merge_fields.FIRSTNAME} ${custObj.data.merge_fields.LASTNAME}`,
                    email: custObj.data.email_address.toLowerCase(),
                    mollieObj: null,
                    molliePayments: null,
                    mollieSubscriptions: null,
                    discourseObj: null,
                    mailchimpObj: custObj.data,
                  };
                  RedisUtil.redisClient().set(
                    `${
                      RedisUtil.teamMemberPrefix
                    }:${custObj.data.email_address.toLowerCase()}`,
                    JSON.stringify(redisMemberPayload),
                  ).catch((err: any) => {
                    debugRedis(`${err}`);
                  });

                } else {
                  // Update in Redis
                  const updatePayload = JSON.parse(reply);
                  updatePayload.mailchimpObj = custObj.data;
                  RedisUtil.redisClient().set(
                    `${
                      RedisUtil.teamMemberPrefix
                    }:${custObj.data.email_address.toLowerCase()}`,
                    JSON.stringify(updatePayload)
                  ).catch((err: any) => {
                    debugRedis(`${err}`);
                  });

                }
              })
              .catch((err: any) => {
                if (err) {
                  debugRedis(`${err}`);
                }
              });
          });
      });
    });
  });

  // ******* MAILCHIMP SYNC ********
  // Iterate over all member entries
  if (process.env.DISABLE_MAILCHIMP_SYNC !== '1') {
    await RedisUtil.scan(`${RedisUtil.teamMemberPrefix}:*`).then(async (memberKeys: any) => {
      debugCron(`Mailchimp Sync|START|Iterating over ${memberKeys.length} members`);
      for (const memberKey of memberKeys) {
        await RedisUtil.redisClient().get(memberKey).then(async (memberObj: any) => {
          memberObj = JSON.parse(memberObj);
          const currentYear = CalcUtil.getCurrentMembershipYear();
          const tags = memberObj.mailchimpObj?.tags;
          debugCron(`Mailchimp Sync|${memberObj.email}: ${memberObj.mailchimpObj?.tags}`);
          let updateTag = true;
          if (tags) {
            tags.forEach((tag: any) => {
              if (tag.name === currentYear.toString()) {
                updateTag = false;
              }
            });
          }

          if (updateTag) {
            let paid = false;
            memberObj.molliePayments?.forEach((pymt: Payment) => {
              // if paid => tag with membership year (if tag not exists)
              paid = (pymt.status === PaymentStatus.paid
                && CalcUtil.isInMembershipRange(pymt.paidAt!, currentYear))
                ? true : paid;
            });
            // if active subscription, mark as paid
            memberObj.mollieSubscriptions?.forEach((subscr: Subscription) => {
              paid = (subscr.status === SubscriptionStatus.active)
                ? true : paid;
            });

            if (paid) {
              // call mailchimp api
              await mcc.updateMemberTag(
                memberObj.mailchimpObj?.id,
                currentYear.toString(),
                "active"
              );
            }
          }
        });
      }
      debugCron(`Mailchimp Sync|END`);
    });
  }

  // ******* STATS *****************
  // const membershipYear = moment().utc().year();
  // const activeMembersInCurrentYear = (await mc.listAllPaidPayments(membershipYear)).length;
  // await mc.listAllActiveSubscriptions().then((subscriptions: SubscriptionData[]) => {
  //   RedisUtil.redisGetAsync(
  //     `${RedisUtil.statsPrefix}:all`,
  //   )
  //     .then((reply: any) => {
  //       debugRedis(reply);
  //       if (reply == null) {
  //         // Store new record in Redis
  //         const statsPayload = {
  //           subscriptions: subscriptions.length,
  //           members: activeMembersInCurrentYear,
  //           year: membershipYear
  //         };
  //         RedisUtil.redisClient.set(
  //           `${RedisUtil.statsPrefix}:all`,
  //           JSON.stringify(statsPayload),
  //           (err: any, _reply: any) => {
  //             if (err) {
  //               debugCron(`ERROR|${err}`);
  //             }
  //           },
  //         );
  //       } else {
  //         // Update in Redis
  //         const statsPayload = JSON.parse(reply);
  //         statsPayload.subscriptions = subscriptions.length;
  //         statsPayload.members = activeMembersInCurrentYear;
  //         RedisUtil.redisClient.set(
  //           `${
  //             RedisUtil.statsPrefix
  //           }:all`,
  //           JSON.stringify(statsPayload),
  //           (err: any, _reply: any) => {
  //             if (err) {
  //               debugCron(`ERROR|${err}`);
  //             }
  //           },
  //         );
  //       }
  //     })
  //     .catch((err: any) => {
  //       if (err) {
  //         debugCron(`ERROR|${err}`);
  //       }
  //     });
  // });
}
