import {Model, model, property} from '@loopback/repository';

@model()
export class SubscriptionPayload extends Model {
  @property({
    type: 'string',
  })
  membershiptype: string;

  constructor(data?: Partial<SubscriptionPayload>) {
    super(data);
  }
}

export interface SubscriptionPayloadRelations {
  // describe navigational properties here
}

export type SubscriptionPayloadWithRelations = SubscriptionPayload & SubscriptionPayloadRelations;
