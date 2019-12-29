import { Model, model, property } from '@loopback/repository';

@model()
export class SignupPayload extends Model {
  @property({
    type: 'string',
  })
  firstname?: string;

  @property({
    type: 'string',
  })
  lastname?: string;

  @property({
    type: 'string',
  })
  email?: string;

  @property({
    type: 'string',
  })
  address?: string;

  @property({
    type: 'string',
  })
  plz?: string;

  @property({
    type: 'string',
  })
  city?: string;

  @property({
    type: 'string',
  })
  bod?: string;

  @property({
    type: 'string',
  })
  phone?: string;

  constructor(data?: Partial<SignupPayload>) {
    super(data);
  }
}

export interface SignupPayloadRelations {
  // describe navigational properties here
}

export type SignupPayloadWithRelations = SignupPayload & SignupPayloadRelations;
