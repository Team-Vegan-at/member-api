import {Model, model, property} from '@loopback/repository';

@model()
export class SubscriptionResult extends Model {
  @property({
    type: 'string',
  })
  id: string;

  @property({
    type: 'string',
  })
  createdAt: string;

  @property({
    type: 'string',
  })
  nextPaymentDate: string;

  @property({
    type: 'string',
  })
  amount: string;

  @property({
    type: 'string',
  })
  mandateReference: string;

  @property({
    type: 'string',
  })
  mandateId: string;

  @property({
    type: 'string',
  })
  signatureDate: string;

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

  constructor(data?: Partial<SubscriptionResult>) {
    super(data);
  }
}

export interface SubscriptionResultRelations {
  // describe navigational properties here
}

export type SubscriptionPayloadWithRelations = SubscriptionResult & SubscriptionResultRelations;
