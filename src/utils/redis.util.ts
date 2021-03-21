/* eslint-disable @typescript-eslint/naming-convention */
import redis from 'redis';
import {promisify} from 'util';

export class RedisUtil {
  private static retryStrategy = require('node-redis-retry-strategy');

  public static redisClient = redis.createClient({
    port: Number.parseInt(
      process.env.REDIS_PORT ? process.env.REDIS_PORT : '6379',
    ),
    host: process.env.REDIS_HOST,
    retry_strategy: RedisUtil.retryStrategy(),
  });

  public static redisGetAsync = promisify(RedisUtil.redisClient.get).bind(
    RedisUtil.redisClient,
  );

  public static async cleanup(): Promise<string | Error> {
    return new Promise((resolve, reject) => {
      RedisUtil.redisClient.flushdb((err, succeeded) => {
        if (err) {
          reject(err);
        }
        resolve(succeeded);
      });

    });
  }

  public static discourseCustomerPrefix = 'teamveganat:discourse';
  public static mailchimpMemberPrefix = 'teamveganat:mailchimp';
  public static mollieCustomerPrefix = 'teamveganat:mollie';
  public static patPrefix = 'teamveganat:pat';
  public static statsPrefix = 'teamveganat:stats';
  public static teamMemberPrefix = 'teamveganat:member';
  public static whPaymentsPrefix = 'teamveganat:hook-pay:';
  public static whSubscriptionPrefix = 'teamveganat:hook-sub:';
}
