import { Model, model, property } from '@loopback/repository';

@model()
export class SignupPayload extends Model {
  @property({
    name: 'your-name',
    type: 'string',
  })
  name?: string;

  @property({
    name: 'your-email',
    type: 'string',
  })
  email?: string;

  @property({
    name: 'your-address',
    type: 'string',
  })
  address?: string;

  @property({
    name: 'your-birthdate',
    type: 'string',
  })
  bod?: string;

  @property({
    name: 'your-number',
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
