import {AxiosUtil} from '../utils/axios.util';
import process from 'process';

export class MailchimpService {
  private debug = require('debug')('api:MailchimpService');
  private mailchimp = require('@mailchimp/mailchimp_marketing');

  constructor() {
    this.mailchimp.setConfig({
      apiKey: process.env.MAILCHIMP_KEY,
      server: 'us4',
    });
  }

  public async listMembersInfo(): Promise<any> {
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

  public async listMember(memberId: string): Promise<any> {
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

  public async updateMemberTag(
    memberId: string, tag: string, status: string
  ): Promise<any | null> {
    this.debug(`DEBUG|updateMemberTag: ${memberId}, ${tag}. ${status}`);

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
