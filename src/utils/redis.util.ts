/* eslint-disable @typescript-eslint/naming-convention */
import {createClient} from 'redis';

export class RedisUtil {
  private static redisClientInstance: any;
  private static logger = require('debug')('utils:Redis');

  public static redisClient = () => {
    if (!RedisUtil.redisClientInstance) {
      RedisUtil.redisClientInstance = createClient({
        url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT ? Number.parseInt(process.env.REDIS_PORT) : 6379}`,
        // retry_strategy: RedisUtil.retryStrategy(),
      });

      RedisUtil.redisClientInstance.on('error', (err: any) => {
        RedisUtil.logger.debug(err);
      });

      RedisUtil.redisClientInstance.connect();
    }

    return RedisUtil.redisClientInstance;
  }

  public static async cleanup(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      RedisUtil.redisClient().flushDb().then((value: any) => {
        resolve(value);
      }).catch((reason: any) => {
        reject(reason);
      })
    });
  }

  public static async scan(key: string): Promise<never> {
    const debug = require('debug')('utils:RedisUtil:scan');
    debug('start');
    return new Promise( (resolve, reject) => {
      debug(`KEYS ${key}`);
      RedisUtil.redisClient().keys(`${key}`)
        .then((matchingKeys: any) => {
          // matchingKeys will be an array of strings if matches were found
          // otherwise it will be an empty array.
          debug(`KEYS ${key} ${matchingKeys.length}`);
          resolve(matchingKeys);
      }).catch((err: any) => {
        debug(`${err}`);
        reject(err);
      });
    });
  }

  public static discourseCustomerPrefix = 'teamveganat:discourse';
  public static mailchimpMemberPrefix =   'teamveganat:mailchimp';
  public static mollieCustomerPrefix =    'teamveganat:mollie';
  public static molliePaymentPrefix =     'teamveganat:mollie:payment';
  public static patPrefix =               'teamveganat:pat';
  public static statsPrefix =             'teamveganat:stats';
  public static teamMemberPrefix =        'teamveganat:member';
  public static whPaymentsPrefix =        'teamveganat:hook-pay';
  public static whSubscriptionPrefix =    'teamveganat:hook-sub';
}
