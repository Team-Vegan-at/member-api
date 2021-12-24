/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {authenticate} from '@loopback/authentication';
import {get, param} from '@loopback/rest';

export class MailchimpController {
  private debug = require('debug')('api:MailchimpController');
  private mailchimp = require('@mailchimp/mailchimp_marketing');

  constructor() {
    this.mailchimp.setConfig({
      apiKey: process.env.MAILCHIMP_KEY,
      server: 'us4',
    });
  }

  @get('/mailchimp/members/', {
    parameters: [
    ],
    responses: {
      '200': {
        description: 'Members Details',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async listMembersInfo(
  ): Promise<any | null> {
    this.debug(`/mailchimp/members`);

    return new Promise(async (resolve, reject) => {

      await this.mailchimp.lists.getListMembersInfo(
        process.env.MAILCHIMP_LIST,
        {
          "count": 1000,
          "fields": [
            "members.id",
            "members.email_address",
            "members.unique_email_id",
            "members.web_id",
            "members.status",
            "members.merge_fields",
            "members.last_changed",
            "members.tags_count",
            "members.tags",
          ]
        }
      ).then((response: any) => {
        resolve(response);
      }).catch((err: any) => {
        this.debug(`${err}`);
        reject(err);
      });
    });
  }

  @get('/mailchimp/member/{member_id}', {
    parameters: [
      {name: 'member_id', schema: {type: 'string'}, in: 'path', required: true}
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
  async getMemberDetails(
    @param.path.string('member_id') memberId: string
  ): Promise<any | null> {
    this.debug(`/mailchimp/member/:${memberId}`);

    return new Promise(async (resolve, reject) => {
      if (!memberId) {
        resolve(null);
      }

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

  async updateMemberTag(
    memberId: string, tag: string, status: string
  ): Promise<any | null> {
    this.debug(`/mailchimp/member/:${memberId}`);

    if (!memberId) {
      return;
    }

    return new Promise(async (resolve, reject) => {
      if (!memberId) {
        resolve(null);
      }

      await this.mailchimp.lists.updateListMemberTags(
        process.env.MAILCHIMP_LIST,
        memberId,
        {
          tags:
            [ {
              "name": tag,
              "status": status
            } ]
        }
      ).then((response: any) => {
        this.debug(`Tagged ${memberId} with ${tag} ${status}`);
        resolve(response);
      }).catch((err: any) => {
        this.debug(`ERR: Tagging ${memberId} with ${tag} ${status} failed`);
        reject(err);
      });
    });
  }
}
