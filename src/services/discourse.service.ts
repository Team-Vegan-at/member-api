import {AxiosUtil} from '../utils/axios.util';
import process from 'process';

export class DiscourseService {
  private debug = require('debug')('api:DiscourseService');

  public suspsendUser(id: string) {
    return AxiosUtil.instance()
      .put(`/admin/users/${id}/suspend.json`, {
        suspend_until: '3020-01-01',
        reason: 'Keine Zahlung für das aktuelle Kalenderjahr erhalten',
      })
      .then((response: any) => {
        this.debug(`INFO|${id}|${response.data.suspension}`);
        return response.data.suspension;
      }).catch((err: any) => {
        this.debug(`ERROR|${err}`);
        return err;
      });
  }

  public unsuspendUser(id: string) {
    return AxiosUtil.instance().put(`/admin/users/${id}/unsuspend.json`).then((response: any) => {
      this.debug(`INFO|${id}|${response.data.suspension}`);
      return response.data.suspension;
    }).catch((err: any) => {
      this.debug(`ERROR|${err}`);
      return err;
    });
  }

  public async generateInviteLink(
    email: string,
  ): Promise<any> {
    const data = {
      "email": email,
      "skip_email": true,
      "max_redemptions_allowed": 1,
      "topic_id": 830
    };
    const config = {
      headers: {
        "Api-Key": process.env.DISCOURSE_USER_KEY,
        "Api-Username": process.env.DISCOURSE_USER_NAME
      }
    }

    return AxiosUtil.instance().post(`/invites.json`, data, config).then((response: any) => {
      this.debug(`INFO|${response.data.link}|${response.data.email}`);
      return response.data.link;
    }).catch((err: any) => {
      this.debug(`ERROR|${err}`);
      return err;
    });
  }
};
