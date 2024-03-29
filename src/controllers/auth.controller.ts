import {authenticate} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {get} from '@loopback/rest';
import jwt from 'jsonwebtoken';
import {TokenServiceBindings} from '../keys';
import {RedisUtil} from '../utils/redis.util';

export class AuthController {
  private debug = require('debug')('api:AuthController');

  // private signSecret = process.env.AUTH_JWT_SECRET!;

  @inject(TokenServiceBindings.JWT_SECRET)
  private signSecret: string;

  constructor() {}

  @get('/auth/otp', {
    parameters: [
      {
        name: 'x-api-key',
        schema: {type: 'string'},
        in: 'header',
        required: true,
      },
    ],
    responses: {
      '200': {},
    },
  })
  @authenticate('team-vegan-api-key')
  public async authGetOTP(): Promise<string> {
    this.debug(`/auth/otp`);

    const ttlInSec = 60;

    // Generate JWT Token (short lived)
    const token = jwt.sign({}, this.signSecret, {expiresIn: `${ttlInSec}sec`});

    // Store JWT Token in Redis
    RedisUtil.redisClient().set(token, token, 'EX', ttlInSec);

    return token;
  }
}
