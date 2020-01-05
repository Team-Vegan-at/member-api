/* eslint-disable @typescript-eslint/camelcase */
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
}
