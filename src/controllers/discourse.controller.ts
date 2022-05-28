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
    }).catch((err: any) => {
      this.debug(err);
      return err;
    });
  }

  @get('/discourse/users/invite', {
    parameters: [
      {
        name: 'email',
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
  public async generateInviteLink(
    @param.query.string('email') email: string,
  ): Promise<any> {
    const axios = require('axios');

    axios.defaults.baseURL = process.env.DISCOURSE_URL;
    axios.defaults.headers.common['Api-Key'] = process.env.DISCOURSE_ADMIN_KEY;

    const inviteMessage = 'Hallo,\n' +
      '\n' +
      'Herzlich Willkommen bei uns im Team! Wir freuen uns sehr, dass du mit dabei bist!\n' +
      'Anbei findest du die Einladung in unser Mitgliederforum. Nachdem du diese akzeptiert hast, findest du einen Beitrag mit "Erstinformationen" mit allen weiteren wichtigen Informationen.\n' +
      '\n' +
      'Melde dich gerne bei uns bei Fragen / Anregungen / Wünschen!\n' +
      '\n' +
      'Allerbeste Grüße aus der Team-Außenstelle in Johannesburg!\n' +
      'Gerhard\n\n' +
      '---\n' +
      'Gerhard Dinhof\n' +
      'Abteilungsleitung Technik\n\n' +
      'Team Vegan.at - Sportsektion des Vereins\n' +
      'Vegane Gesellschaft Österreich\n' +
      'Meidlinger Hauptstr. 63/6, 1120 Wien\n' +
      'ZVR-Zahl : 208143224';
    const data = {
      "email": email,
      "skip_email": false,
      "custom_message": inviteMessage,
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
      this.debug(`${response.data.link} | ${response.data.email}`);
      return response.data.link;
    }).catch((err: any) => {
      this.debug(err);
      return err;
    });
  }
}
