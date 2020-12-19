/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {get, HttpErrors, param, post, requestBody, Response, RestBindings} from '@loopback/rest';
import {
  createMollieClient,
  Customer,
  List,
  Locale,
  MandateMethod,
  Payment
} from '@mollie/api-client';
import {MandateData} from '@mollie/api-client/dist/types/src/data/customers/mandates/data';
import moment from 'moment';
import {MandatePayload} from '../models/mandate-payload.model';
import {RedisUtil} from '../utils/redis.util';
import {DashboardController} from './dashboard.controller';

export class MollieController {
  private debug = require('debug')('api:MollieController');
  private mollieClient = createMollieClient({
    apiKey: process.env.MOLLIE_API_KEY as string,
  });

  constructor() {}

  @get('/pay', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true},
    ],
    responses: {
      '302': {
        description: 'Mollie Checkout URL',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  async pay(
    @param.query.string('email') email: string,
    @inject(RestBindings.Http.RESPONSE) response: Response,
  ): Promise<any> {
    this.debug(`/pay`);

    let checkoutUrl: string;

    const dc = new DashboardController();
    checkoutUrl = await dc
      .redisGetTeamMember(email)
      .then(async (custObj: any) => {
        if (custObj?.mollieObj) {
          return (checkoutUrl = await this.createMollieCheckoutUrl(
            custObj.mollieObj,
          ));
        } else {
          return (checkoutUrl = 'https://teamvegan.at');
        }
      })
      .catch(() => {
        return 'https://teamvegan.at';
      });

    response.redirect(checkoutUrl);
  }

  @post('/mollie/mandate', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true}
    ],
    responses: {
      '200': {
        description: 'Mandate confirmation',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  @authenticate('team-vegan-jwt')
  async createMandate(
    @param.query.string('email') email: string,
    @requestBody() payload: MandatePayload
  ): Promise<MandateData | null> {
    this.debug(`/mollie/mandate`);

    return new Promise(async(resolve, reject) => {
      const dc = new DashboardController();
      await dc.redisGetTeamMember(email)
        .then(async (custObj: any) => {
          this.debug(`Fetch mandates for customer ${custObj.email}`);
          const mandates = await this.mollieClient.customers_mandates.page(
            { customerId: custObj.mollieObj.id }
          );
          this.debug(`Fetched ${mandates.length} mandates for customer ${custObj.email}`);

          if (mandates.length > 0) {
            const start = async () => {
              await this.asyncForEach(mandates, async mandate => {
                const status = await this.mollieClient.customers_mandates.delete(
                  mandate.id,
                  { customerId: custObj.mollieObj.id }
                );
                this.debug(`Revoked mandate ${mandate.id} for customer ${custObj.mollieObj.id}, status ${status}`);
              });
            };
            start().then(
              async () => {
                await this.mollieClient.customers_mandates.create({
                  customerId: custObj.mollieObj.id,
                  method: MandateMethod.directdebit,
                  consumerName: payload.name,
                  consumerAccount: payload.account,
                  consumerBic: payload.bic,
                  signatureDate: payload.signDate,
                  mandateReference: payload.mandateRef,
                }).then((mandate) => {
                  this.debug(`Created new mandate ${mandate.id} for customer ${custObj.email}`);
                  resolve(mandate);
                }).catch((reason) => {
                  this.debug(`Error: ${reason}`);
                  reject(reason);
                });
              },
              (reason) => {
                this.debug(reason);
                throw new HttpErrors.InternalServerError(reason);
              },
            );
          } else {
            await this.mollieClient.customers_mandates.create({
              customerId: custObj.mollieObj.id,
              method: MandateMethod.directdebit,
              consumerName: payload.name,
              consumerAccount: payload.account,
              consumerBic: payload.bic,
              signatureDate: payload.signDate,
              mandateReference: payload.mandateRef,
            }).then((mandate) => {
              this.debug(`Created new mandate ${mandate.id} for customer ${custObj.email}`);
              resolve(mandate);
            }).catch((reason) => {
              this.debug(`Error: ${reason}`);
              reject(reason);
            });
          }
        })
        .catch((reason) => {
          this.debug(reason);
          throw new HttpErrors.InternalServerError(reason);
        });
      });
  }

  @get('/mollie/checkout', {
    parameters: [
      {name: 'email', schema: {type: 'string'}, in: 'query', required: true},
      {
        name: 'firstname',
        schema: {type: 'string'},
        in: 'query',
        required: true,
      },
      {name: 'lastname', schema: {type: 'string'}, in: 'query', required: true},
      {name: 'dob', schema: {type: 'string'}, in: 'query'},
    ],
    responses: {
      '200': {
        description: 'Mollie Checkout URL',
        content: {
          'application/json': {
            schema: {type: 'string'},
          },
        },
      },
    },
  })
  async checkout(
    @param.query.string('email') email: string,
    @param.query.string('firstname') firstname: string,
    @param.query.string('lastname') lastname: string,
    @param.query.string('dob') dob: string,
  ): Promise<string | null> {
    this.debug(`/mollie/checkout`);

    let checkoutUrl: string | null = null;

    await this.mollieClient.customers
      .create({
        name: `${unescape(firstname)} ${unescape(lastname)}`,
        email: unescape(email),
        locale: Locale.de_AT,
        metadata: {
          dob,
        },
      })
      .then(async (customer: Customer) => {
        this.debug(`Customer ${customer.id} created`);

        // Store in Redis
        const redisCustomerPayload = {
          timestamp: moment().utc(),
          controller: 'mollie',
          method: 'checkout',
          data: customer,
          payments: [],
        };
        RedisUtil.redisClient.set(
          `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
          JSON.stringify(redisCustomerPayload),
          (err: any, _reply: any) => {
            if (err) {
              this.debug(`Redis: ${err}`);
            }
          },
        );

        checkoutUrl = await this.createMollieCheckoutUrl(customer);
      })
      .catch(reason => {
        this.debug(reason);
        throw new HttpErrors.InternalServerError(reason);
      });

    return checkoutUrl;
  }

  private async createMollieCheckoutUrl(customer: any) {
    let checkoutUrl: string;

    return this.mollieClient.payments
      .create({
        customerId: customer.id,
        billingEmail: customer.email,
        dueDate: moment()
          .add(14, 'days')
          .format('YYYY-MM-DD'),
        amount: {
          currency: 'EUR',
          value: process.env.MOLLIE_PAYMENT_AMOUNT!,
        },
        description: `${
          process.env.MOLLIE_PAYMENT_DESCRIPTION
        }`,
        locale: Locale.de_AT,
        redirectUrl: process.env.MOLLIE_CHECKOUT_REDIRECT_URL,
        webhookUrl: process.env.MOLLIE_WEBHOOK_PAYMENT,
      })
      .then(async (payment: Payment) => {
        this.debug(`Payment ${payment.id} for ${customer.id} created`);
        // Add payment payload to customer record
        await RedisUtil.redisGetAsync(
          `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
        ).then((custRecord: string | null) => {
          if (!custRecord) {
            this.debug(`Customer not found: ${customer.id}`);
            throw new HttpErrors.InternalServerError(`Customer not found`);
          }
          const redisPaymentPayload = {
            timestamp: moment().utc(),
            controller: 'mollie',
            method: 'checkout',
            data: payment,
          };
          let redisCustomerUpdate = JSON.parse(custRecord);
          if (!redisCustomerUpdate.payments) {
            redisCustomerUpdate = {...redisCustomerUpdate, ...{payments: []}};
          }
          redisCustomerUpdate.payments.push(redisPaymentPayload);
          RedisUtil.redisClient.set(
            `${RedisUtil.mollieCustomerPrefix}:${customer.id}`,
            JSON.stringify(redisCustomerUpdate),
            (err: any, _reply: any) => {
              if (err) {
                this.debug(`Redis: ${err}`);
              }
            },
          );
        });
        checkoutUrl = payment.getCheckoutUrl()!;
        // TODO: send mail
        return checkoutUrl;
      })
      .catch(reason => {
        this.debug(reason);
        throw new HttpErrors.InternalServerError(reason);
      });
  }

  @get('/mollie/payments', {
    parameters: [
      {name: 'custId', schema: {type: 'string'}, in: 'query', required: true},
    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async listCustomerPayments(
    @param.query.string('custId') custId: string,
  ): Promise<any[]> {
    this.debug(`/mollie/payments`);

    return this.mollieClient.customers_payments
      .all({customerId: custId})
      .then((payments: List<Payment>) => {
        this.debug(`Fetched ${payments.count} payment(s) for ${custId}`);
        const paymentsArray: Payment[] = [];

        payments.forEach(payment => {
          paymentsArray.push(payment);
        });

        return paymentsArray;
      })
      .catch(reason => {
        this.debug(reason);
        throw new HttpErrors.InternalServerError(reason);
      });
  }

  @get('/mollie/paymentstatus', {
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async listCustomerPaymentStatus(): Promise<any[]> {
    this.debug(`/mollie/paymentstatus`);

    const paymentstatus: any[] = [];

    const customers = await this.listCustomers();

    for (const customer of customers) {
      await this.mollieClient.customers_payments
        .all({customerId: customer.id})
        .then((payments: List<Payment>) => {
          this.debug(`Fetched ${payments.count} payment(s) for ${customer.id}`);
          const paymentsArray: Payment[] = [];

          payments.forEach(payment => {
            paymentsArray.push(payment);
          });
          const payload = {
            customer: customer,
            payments: paymentsArray,
          };

          paymentstatus.push(payload);
        })
        .catch(reason => {
          this.debug(reason);
          throw new HttpErrors.InternalServerError(reason);
        });
    }

    return paymentstatus;
  }

  @get('/mollie/customers', {
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-jwt')
  public async listCustomers(): Promise<Customer[]> {
    this.debug(`/mollie/customers`);

    const customerList: Customer[] = [];

    await this.mollieClient.customers
      .all({limit: 250})
      .then((customers: List<Customer>) => {
        this.debug(`#1 Fetched ${customers.count} customer entries`);
        customers.forEach(customer => {
          customerList.push(customer);
        });
        //   return customers.nextPage!();
        // })
        // .then((customers: List<Customer>) => {
        //   this.debug(`#2 Fetched ${customers.count} customer entries`);
        //   customers.forEach(customer => {
        //     customerList.push(customer);
        //   });
      })
      .catch(reason => {
        this.debug(reason);
        throw new HttpErrors.InternalServerError(reason);
      });

    return customerList;
  }

  private async asyncForEach(
    array: string | any[],
    callback: (arg0: any, arg1: number, arg2: any) => any,
  ) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }
}
