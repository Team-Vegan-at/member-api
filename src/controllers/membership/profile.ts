/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
import createMollieClient, {PaymentStatus} from '@mollie/api-client';
import moment from 'moment';
import {ProfileResult} from '../../models/profile-return.model';
import {CalcUtil} from '../../utils/calc.util';
import {DashboardController} from '../dashboard.controller';

export class Profile {
  private debug = require('debug')('api:membership:profile');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  public async getProfile(
    email: string
  ) : Promise<ProfileResult | null> {

    return new Promise(async(resolve, reject) => {

      const dc = new DashboardController();
      await dc.redisGetTeamMember(email)
        .then(async (custObj: any) => {
          if (custObj == null) {
            return reject(`${email} not found`);
          }

          // get payment details
          const payments = await this.mollieClient.customers_payments.page(
            { customerId: custObj.mollieObj.id }
          );
          this.debug(`Retrieved ${payments.length} payments for customer ${custObj.email}`);

          const currentMembershipYear = CalcUtil.getCurrentMembershipYear();
          let membershipValid = false;
          let membershipValidTo = '';

          if (payments.length > 0) {
            payments.forEach(pymt => {
              if (pymt.status === PaymentStatus.paid
                  && pymt.paidAt
                  && !membershipValid) {

                membershipValid = CalcUtil.isInMembershipRange(pymt.paidAt, currentMembershipYear);
                membershipValidTo = CalcUtil.getExpirationDate(`${currentMembershipYear}-01-01`).format("YYYY-MM-DD");

                if (!membershipValid
                  && (moment().utc().month() === 11 || moment().utc().month() === 0)) {

                  const previousMembershipYear = moment(currentMembershipYear, "YYYY").subtract(1, "year").year();
                  membershipValid = CalcUtil.isInMembershipRange(pymt.paidAt, previousMembershipYear);
                  membershipValidTo = CalcUtil.getExpirationDate(`${previousMembershipYear}-01-01`).format("YYYY-MM-DD");
                }
              }
            });
          }

          const profileRes = new ProfileResult({
            name: custObj.name,
            email: custObj.email,
            membershipValid,
            membershipValidTo
          });

          return resolve(profileRes);
        })
        .catch((reason) => {
          this.debug(reason);
          return reject(reason);
        });
      });
  }
}
