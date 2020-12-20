/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
import createMollieClient, {
  MandateMethod
} from '@mollie/api-client';
import {MandateData, MandateDetailsDirectDebit} from '@mollie/api-client/dist/types/src/data/customers/mandates/data';
import {MandatePayload} from '../../models/mandate-payload.model';
import {MandateResult} from '../../models/mandate-return.model';
import {DashboardController} from '../dashboard.controller';

export class MollieMandate {
  private debug = require('debug')('api:MollieMandate');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  public async createMandate(
    email:string,
    payload:MandatePayload
  ) : Promise<MandateData> {

      return new Promise(async(resolve, reject) => {
        const dc = new DashboardController();
        await dc.redisGetTeamMember(email)
          .then(async (custObj: any) => {
            if (custObj == null) {
              return reject(`${email} not found`);
            }

            this.debug(`Fetch mandates for customer ${custObj.email}`);
            const mandates = await this.mollieClient.customers_mandates.page(
              { customerId: custObj.mollieObj.id }
            );
            this.debug(`Fetched ${mandates.length} mandates for customer ${custObj.email}`);

            if (mandates.length > 0) {
              const start = async () => {
                await this.asyncForEach({
                    array: mandates, callback: async (mandate) => {
                      const status = await this.mollieClient.customers_mandates.delete(
                        mandate.id,
                        {customerId: custObj.mollieObj.id}
                      );
                      this.debug(`Revoked mandate ${mandate.id} for customer ${custObj.mollieObj.id}, status ${status}`);
                    }
                  });
              };
              start().then(
                async () => {
                  await this.mollieClient.customers_mandates.create({
                    customerId: custObj.mollieObj.id,
                    method: MandateMethod.directdebit,
                    consumerName: payload.name,
                    consumerAccount: payload.account,
                    consumerBic: payload.bic,
                    signatureDate: payload.signDate,
                    mandateReference: payload.mandateRef,
                  }).then((mandate) => {
                    this.debug(`Created new mandate ${mandate.id} for customer ${custObj.email}`);
                    return resolve(mandate);
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
              await this.mollieClient.customers_mandates.create({
                customerId: custObj.mollieObj.id,
                method: MandateMethod.directdebit,
                consumerName: payload.name,
                consumerAccount: payload.account,
                consumerBic: payload.bic,
                signatureDate: payload.signDate,
                mandateReference: payload.mandateRef,
              }).then((mandate) => {
                this.debug(`Created new mandate ${mandate.id} for customer ${custObj.email}`);
                return resolve(mandate);
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

  public async getMandate(
    email:string
  ) : Promise<MandateResult | null> {

    return new Promise(async(resolve, reject) => {
      const dc = new DashboardController();
      await dc.redisGetTeamMember(email)
        .then(async (custObj: any) => {
          if (custObj == null) {
            return reject(`${email} not found`);
          }

          this.debug(`Fetch mandates for customer ${custObj.email}`);
          const mandates = await this.mollieClient.customers_mandates.page(
            { customerId: custObj.mollieObj.id }
          );
          this.debug(`Fetched ${mandates.length} mandates for customer ${custObj.email}`);

          if (mandates.length > 0) {
            this.debug(`Found mandate ${mandates[0].id} for customer ${custObj.email}`);

            const mandateResult = new MandateResult();
            const mandateDetails = mandates[0].details as MandateDetailsDirectDebit;

            mandateResult.mandateReference = mandates[0].mandateReference;
            mandateResult.signatureDate = mandates[0].signatureDate;
            mandateResult.status = mandates[0].status;
            mandateResult.method = mandates[0].method;
            mandateResult.consumerAccount = mandateDetails.consumerAccount.replace(/\d(?=\d{4})/g, "*");
            mandateResult.consumerBic = mandateDetails.consumerBic;
            mandateResult.consumerName = mandateDetails.consumerName;

            return resolve(mandateResult);
          } else {
            return resolve(null);
          }
        })
        .catch((reason) => {
          this.debug(reason);
          return reject(reason);
        });
      });
  }

  private async asyncForEach(
    {
      array, callback}: {array: string | any[]; callback: (arg0: any, arg1: number, arg2: any) => any;},
  ) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }
}
