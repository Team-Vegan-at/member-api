/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {get, param, Request, RestBindings} from '@loopback/rest';

export class MailchimpController {
  private debug = require('debug')('api:MailchimpController');
  private mailchimp = require('@mailchimp/mailchimp_marketing');

  constructor(@inject(RestBindings.Http.REQUEST) private request: Request) {

    this.mailchimp.setConfig({
      apiKey: process.env.MAILCHIMP_KEY,
      server: 'us4',
    });
  }

  @get('/mailchimp/members/', {
    parameters: [
      {name: 'member_id', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
        description: 'Member Details',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async getMandate(
    @param.query.string('member_id') memberId: string
  ): Promise<any | null> {
    this.debug(`/mailchimp/members/:${memberId}`);

    return new Promise(async (resolve, reject) => {

      await this.mailchimp.lists.getListMember(
        process.env.MAILCHIMP_LIST,
        memberId
      ).then((response: any) => {
        this.debug(`Found ${response.email_address} for ${memberId}`);
        resolve(response);
      }).catch((err: any) => {
        this.debug(`No result for ${memberId}: ${err}`);
        reject(err);
      });
    });
  }
}
