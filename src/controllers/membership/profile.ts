/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
import moment from 'moment';
import {ProfileResult} from '../../models/profile-return.model';
import {DashboardController} from '../dashboard.controller';

export class Profile {
  private debug = require('debug')('api:membership:profile');

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

          const profileRes = new ProfileResult({
            name: custObj.name,
            email: custObj.email,
            membershipValid: true,
            membershipValidTo: moment().utc().toISOString()
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
