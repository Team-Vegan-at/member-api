import {Model, model, property} from '@loopback/repository';

@model()
export class MandatePayload extends Model {
  @property({
    type: 'string',
  })
  name: string;

  @property({
    type: 'string',
  })
  account: string;

  @property({
    type: 'string',
  })
  bic: string;

  @property({
    type: 'string',
  })
  signDate: string;

  @property({
    type: 'string',
  })
  mandateRef: string;

  constructor(data?: Partial<MandatePayload>) {
    super(data);
  }
}

export interface MandatePayloadRelations {
  // describe navigational properties here
}

export type MandatePayloadWithRelations = MandatePayload & MandatePayloadRelations;
