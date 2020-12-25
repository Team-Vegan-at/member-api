/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
import createMollieClient, {SubscriptionStatus} from '@mollie/api-client';
import {SubscriptionData} from '@mollie/api-client/dist/types/src/data/subscription/data';
import {MandateResult} from '../../models/mandate-return.model';
import {DashboardController} from '../dashboard.controller';
import {Mandate} from './mandate';

export class Subscription {
  private debug = require('debug')('api:membership:mandate');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  public async createSubscription(
    email:string
  ) : Promise<SubscriptionData> {

      return new Promise(async(resolve, reject) => {
        const dc = new DashboardController();
        await dc.redisGetTeamMember(email)
          .then(async (custObj: any) => {
            if (custObj == null) {
              return reject(`${email} not found`);
            }

            this.debug(`Fetch subscriptions for customer ${custObj.email}`);
            const subscriptions = await this.mollieClient.customers_subscriptions.page(
              { customerId: custObj.mollieObj.id }
            );
            this.debug(`Fetched ${subscriptions.length} subscriptions for customer ${custObj.email}`);

            const mm = new Mandate();
            const mandateId: string = await mm.getMandate(email)
              .then((mandate: MandateResult | null) => {
                if (mandate) {
                  return mandate.mandateId;
                } else {
                  return '';
                }
              })
              .catch(() => '');

            if (subscriptions.length > 0) {
              const start = async () => {
                await this.asyncForEach({
                  // delete active subscriptions
                  array: subscriptions, callback: async (subscription: SubscriptionData) => {
                    if (subscription.status == SubscriptionStatus.active) {
                      const status = await this.mollieClient.customers_subscriptions.delete(
                        subscription.id,
                        {customerId: custObj.mollieObj.id}
                      );
                      this.debug(`Cancelled ${subscription.id} for customer ${custObj.mollieObj.id}, status ${status}`);
                    }
                  }
                });
              };
              start().then(
                async () => {
                  await this.mollieClient.customers_subscriptions.create({
                    customerId: custObj.mollieObj.id,
                    amount: {
                      currency: "EUR",
                      value: process.env.MOLLIE_PAYMENT_AMOUNT as string
                    },
                    interval: "12 months",
                    startDate: "2021-01-30",
                    mandateId,
                    description: process.env.MOLLIE_PAYMENT_DESCRIPTION as string,
                  }).then((subscription) => {
                    this.debug(`Created new subscription ${subscription.id} for customer ${custObj.email}`);
                    return resolve(subscription);
                  }).catch((reason) => {
                    this.debug(`Error: ${reason}`);
                    return reject(reason);
                  });
                },
                (reason) => {
                  this.debug(reason);
                  return reject(reason);
                },
              );
            } else {
              await this.mollieClient.customers_subscriptions.create({
                customerId: custObj.mollieObj.id,
                amount: {
                  currency: "EUR",
                  value: process.env.MOLLIE_PAYMENT_AMOUNT as string
                },
                interval: "12 months",
                startDate: "2021-01-30",
                mandateId,
                description: process.env.MOLLIE_PAYMENT_DESCRIPTION as string,
              }).then((subscription) => {
                this.debug(`Created new subscription ${subscription.id} for customer ${custObj.email}`);
                return resolve(subscription);
              }).catch((reason) => {
                this.debug(`Error: ${reason}`);
                return reject(reason);
              });
            }
          })
          .catch((reason) => {
            this.debug(reason);
            return reject(reason);
          });
        });
  }

  // public async getSuscription(
  //   email:string
  // ) : Promise<SubscriptionData | null> {

  //   return new Promise(async(resolve, reject) => {
  //     const dc = new DashboardController();
  //     await dc.redisGetTeamMember(email)
  //       .then(async (custObj: any) => {
  //         if (custObj == null) {
  //           return reject(`${email} not found`);
  //         }

  //         this.debug(`Fetch mandates for customer ${custObj.email}`);
  //         const mandates = await this.mollieClient.customers_mandates.page(
  //           { customerId: custObj.mollieObj.id }
  //         );
  //         this.debug(`Fetched ${mandates.length} mandates for customer ${custObj.email}`);

  //         if (mandates.length > 0) {
  //           this.debug(`Found mandate ${mandates[0].id} for customer ${custObj.email}`);

  //           const mandateResult = new MandateResult();
  //           const mandateDetails = mandates[0].details as MandateDetailsDirectDebit;

  //           mandateResult.mandateReference = mandates[0].mandateReference;
  //           mandateResult.signatureDate = mandates[0].signatureDate;
  //           mandateResult.status = mandates[0].status;
  //           mandateResult.method = mandates[0].method;
  //           mandateResult.consumerAccount = mandateDetails.consumerAccount.replace(/\d(?=\d{4})/g, "*");
  //           mandateResult.consumerBic = mandateDetails.consumerBic;
  //           mandateResult.consumerName = mandateDetails.consumerName;

  //           return resolve(mandateResult);
  //         } else {
  //           return resolve(null);
  //         }
  //       })
  //       .catch((reason) => {
  //         this.debug(reason);
  //         return reject(reason);
  //       });
  //     });
  // }

  private async asyncForEach(
    {
      array, callback}: {array: string | any[]; callback: (arg0: any, arg1: number, arg2: any) => any;},
  ) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }
}
