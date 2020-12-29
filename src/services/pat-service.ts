/* eslint-disable no-async-promise-executor */
/* eslint-disable @typescript-eslint/no-misused-promises */
import moment from 'moment';
import {RedisUtil} from '../utils/redis.util';

export class PATService {
  private debug = require('debug')('api:PATService');

  public async generatePAT(email: string): Promise<string> {
    this.debug(`/PATService/generatePAT`);

    return new Promise((resolve, reject) => {
      const ttlInSec = 21600; // 6 hours

      const bcrypt = require('bcrypt');
      const saltRounds = 10;

      bcrypt.hash(moment().utc().toISOString(), saltRounds, (err: unknown, hash: string) => {
        if (err) {
          this.debug(err);
          return reject(err);
        }
        const buff = Buffer.from(hash, 'utf-8');
        const pat = buff.toString('base64').substring(0,10);
        RedisUtil.redisClient.set(`${RedisUtil.patPrefix}:${pat}`, email, 'EX', ttlInSec);
        return resolve(pat);
      });
    });
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
