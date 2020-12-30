import {Model, model, property} from '@loopback/repository';

@model()
export class ProfileResult extends Model {
  @property({
    type: 'string',
  })
  email: string;

  @property({
    type: 'string',
  })
  name: string;

  @property({
    type: 'boolean',
  })
  membershipValid: boolean;

  @property({
    type: 'string',
  })
  membershipValidTo?: string;

  // TO BE REMOVED

  @property({
    type: 'string',
  })
  accessToken: string;

  constructor(data?: Partial<ProfileResult>) {
    super(data);
  }
}

export interface ProfileResultRelations {
  // describe navigational properties here
}

export type ProfileResultWithRelations = ProfileResult & ProfileResultRelations;
