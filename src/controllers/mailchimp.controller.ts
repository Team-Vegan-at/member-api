import {authenticate} from '@loopback/authentication';
import {get, param} from '@loopback/rest';
import {MailchimpService} from '../services/mailchimp.service';

export class MailchimpController {
  private debug = require('debug')('api:MailchimpController');
  private mailchimpSvc = new MailchimpService();

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
  async listAllMembers(
  ): Promise<any | null> {
    this.debug(`/mailchimp/members`);
    return this.mailchimpSvc.listMembersInfo();
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
    return this.mailchimpSvc.listMember(memberId);
  }
}
