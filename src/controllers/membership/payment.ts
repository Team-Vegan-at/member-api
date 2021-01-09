/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
import createMollieClient, {PaymentStatus} from '@mollie/api-client';
import {PaymentResult} from '../../models/payment-return.model';
import {DashboardController} from '../dashboard.controller';

export class Payment {
  private debug = require('debug')('api:membership:payment');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  public async getPayments(
    email:string
  ) : Promise<PaymentResult[] | null> {

    return new Promise(async(resolve, reject) => {
      const dc = new DashboardController();
      await dc.redisGetTeamMember(email)
        .then(async (custObj: any) => {
          if (custObj == null) {
            return reject(`${email} not found`);
          }

          this.debug(`Retrieve payments for customer ${custObj.email}`);
          const payments = await this.mollieClient.customers_payments.page(
            { customerId: custObj.mollieObj.id }
          );
          this.debug(`Retrieved ${payments.length} payments for customer ${custObj.email}`);

          if (payments.length > 0) {

            const pymtRes: PaymentResult[] = [];

            payments.forEach(pymt => {
              if (pymt.status === PaymentStatus.paid
                || pymt.status === PaymentStatus.pending
                || pymt.status === PaymentStatus.open) {

                pymtRes.push(new PaymentResult({
                  id: pymt.id,
                  method: pymt.method,
                  paidAt: pymt.paidAt,
                  createdAt: pymt.createdAt,
                  amount: pymt.amount.value,
                  description: pymt.description,
                  status: pymt.status
                }));
              }
            });

            return resolve(pymtRes);
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
}
