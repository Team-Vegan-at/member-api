import {Model, model, property} from '@loopback/repository';

@model()
export class MandateResult extends Model {
  @property({
    type: 'string',
  })
  mandateReference: string;

  @property({
    type: 'string',
  })
  signatureDate: string;

  @property({
    type: 'string',
  })
  status: string;

  @property({
    type: 'string',
  })
  method: string;

  @property({
    type: 'string',
  })
  consumerName: string;

  @property({
    type: 'string',
  })
  consumerAccount: string;

  @property({
    type: 'string',
  })
  consumerBic: string;

  constructor(data?: Partial<MandateResult>) {
    super(data);
  }
}

export interface MandateResultRelations {
  // describe navigational properties here
}

export type MandatePayloadWithRelations = MandateResult & MandateResultRelations;
