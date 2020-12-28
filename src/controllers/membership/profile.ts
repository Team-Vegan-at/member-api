/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
import moment from 'moment';
import {ProfileResult} from '../../models/profile-return.model';
import {AuthController} from '../auth.controller';
import {DashboardController} from '../dashboard.controller';

export class Profile {
  private debug = require('debug')('api:membership:profile');

  public async getProfile(
    accessToken: string
  ) : Promise<ProfileResult | null> {

    return new Promise(async(resolve, reject) => {

      // TODO Match access token

      const email = accessToken;
      const dc = new DashboardController();
      await dc.redisGetTeamMember(email)
        .then(async (custObj: any) => {
          if (custObj == null) {
            return reject(`${email} not found`);
          }

          // TODO REMOVE
          const ac = new AuthController();
          const profileRes = new ProfileResult({
            name: custObj.name,
            email: custObj.email,
            membershipValid: true,
            membershipValidTo: moment().utc().toISOString(),
            accessToken: ac.generateAccessToken(custObj.email)
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
