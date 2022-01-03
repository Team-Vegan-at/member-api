/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
import {RedisUtil} from '../utils/redis.util';

export class PATService {
  private debug = require('debug')('api:PATService');

  public generatePAT(email: string): string {
    this.debug(`/PATService/generatePAT`);

    const crypto = require('crypto');
    const salt = crypto.randomBytes(256);
    const hash = crypto.scryptSync(email, salt, 24);

    const ttlInSec = 21600; // 6 hours
    const pat = hash.toString('base64').replace(/[^a-zA-Z0-9-_]/g, '').substring(0,10);
    RedisUtil.redisClient.set(`${RedisUtil.patPrefix}:${pat}`, email, 'EX', ttlInSec);
    return pat;
  }

  /**
   *
   * @param pat
   * @return email address
   */
  public async validatePAT(pat: string): Promise<string> {
    this.debug(`/PATService/validatePAT`);

    return new Promise(async (resolve, reject) => {
      await RedisUtil.redisGetAsync(`${RedisUtil.patPrefix}:${pat}`).then(
        (email: string | null) => {
          if (!email) {
            this.debug(`PAT ${pat} not found in Redis`);
            return reject();
          }

          return resolve(email);
        },
      );
    });
  }
}
