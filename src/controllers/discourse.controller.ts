import {authenticate} from '@loopback/authentication';
import {param, put} from '@loopback/rest';
import {DiscourseService} from '../services/discourse.service';

export class DiscourseController {
  private debug = require('debug')('api:DiscourseController');
  private discourseSvc = new DiscourseService();
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
    this.debug(`INFO|Suspend ${id}`);
    return this.discourseSvc.suspsendUser(id);
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
    this.debug(`INFO|Unsuspend ${id}`);
    return this.discourseSvc.unsuspendUser(id);
  }
}
