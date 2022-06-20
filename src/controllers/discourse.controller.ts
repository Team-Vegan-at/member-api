/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {authenticate} from '@loopback/authentication';
import {get, param, put} from '@loopback/rest';
import * as process from 'process';

export class DiscourseController {
  private debug = require('debug')('api:DiscourseController');

  constructor() {}

  @put('/discourse/users/suspend', {
    parameters: [
      {
        name: 'id',
        schema: {type: 'string'},
        in: 'query',
        required: true,
      },
    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async suspendUser(@param.query.string('id') id: string): Promise<any> {
    const axios = require('axios');

    axios.defaults.baseURL = process.env.DISCOURSE_URL;
    axios.defaults.headers.common['Api-Key'] = process.env.DISCOURSE_ADMIN_KEY;

    return axios
      .put(`/admin/users/${id}/suspend.json`, {
        suspend_until: '3020-01-01',
        reason: 'Keine Zahlung für das aktuelle Kalenderjahr erhalten',
      })
      .then((response: any) => {
        this.debug(`${id} | ${response.data.suspension}`);
        return response.data.suspension;
      }).catch((err: any) => {
        this.debug(err);
        return err;
      });
  }

  @put('/discourse/users/unsuspend', {
    parameters: [
      {
        name: 'id',
        schema: {type: 'string'},
        in: 'query',
        required: true,
      },
    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async unsuspendUser(
    @param.query.string('id') id: string,
  ): Promise<any> {
    const axios = require('axios');

    axios.defaults.baseURL = process.env.DISCOURSE_URL;
    axios.defaults.headers.common['Api-Key'] = process.env.DISCOURSE_ADMIN_KEY;

    return axios.put(`/admin/users/${id}/unsuspend.json`).then((response: any) => {
      this.debug(`${id} | ${response.data.suspension}`);
      return response.data.suspension;
    }).catch((err: any) => {
      this.debug(err);
      return err;
    });
  }

  // Internal methods
  public async generateInviteLink(
    email: string,
  ): Promise<any> {
    const axios = require('axios');

    axios.defaults.baseURL = process.env.DISCOURSE_URL;
    axios.defaults.headers.common['Api-Key'] = process.env.DISCOURSE_ADMIN_KEY;

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

    return axios.post(`/invites.json`, data, config).then((response: any) => {
      this.debug(`INFO|${response.data.link}|${response.data.email}`);
      return response.data.link;
    }).catch((err: any) => {
      this.debug(`ERROR|${err}`);
      return err;
    });
  }
}
