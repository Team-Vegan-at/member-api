/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/camelcase */
import {param, put} from '@loopback/rest';
import {authenticate} from '@loopback/authentication';

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
    axios.defaults.headers.common['Api-Key'] = process.env.DISCOURSE_KEY;

    return axios
      .put(`/admin/users/${id}/suspend`, {
        suspend_until: '3020-01-01',
        reason: 'Keine Zahlung für das aktuelle Kalenderjahr erhalten',
      })
      .then((response: any) => {
        this.debug(`User ${id} suspended`);
        return response.data.suspension;
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
    axios.defaults.headers.common['Api-Key'] = process.env.DISCOURSE_KEY;

    return axios.put(`/admin/users/${id}/unsuspend`).then((response: any) => {
      this.debug(`User ${id} unsuspended`);
      return response.data.suspension;
    });
  }
}
