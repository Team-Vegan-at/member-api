import {Model, model, property} from '@loopback/repository';

@model()
export class PaymentResult extends Model {
  @property({
    type: 'string',
  })
  id: string;

  @property({
    type: 'string',
  })
  status: string;

  @property({
    type: 'string',
  })
  paidAt?: string;

  @property({
    type: 'string',
  })
  createdAt?: string;

  @property({
    type: 'string',
  })
  method?: string;

  @property({
    type: 'string',
  })
  description: string;

  @property({
    type: 'string',
  })
  amount: string;

  constructor(data?: Partial<PaymentResult>) {
    super(data);
  }
}

export interface PaymentResultRelations {
  // describe navigational properties here
}

export type PaymentPayloadWithRelations = PaymentResult & PaymentResultRelations;
