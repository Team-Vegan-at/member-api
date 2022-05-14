import {Model, model, property} from '@loopback/repository';

@model()
export class RedisMemberPayload extends Model {
  @property({
    type: 'string',
  })
  name: string;

  @property({
    type: 'string',
  })
  account: string;

  @property({
    type: 'email_address',
  })
  email: string;

  @property({
    type: 'object',
  })
  mollieObj: object | null;

  @property({
    type: 'object',
  })
  molliePayments: object | null;

  @property({
    type: 'object',
  })
  mollieSubscriptions: object | null;

  @property({
    type: 'object',
  })
  discourseObj: object | null;

  constructor(data?: Partial<RedisMemberPayload>) {
    super(data);
  }
}

export interface RedisMemberPayloadRelations {
  // describe navigational properties here
}

export type MandatePayloadWithRelations = RedisMemberPayload & RedisMemberPayloadRelations;
