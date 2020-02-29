import { get, param, HttpErrors } from '@loopback/rest';
import jwt from 'jsonwebtoken';
import { RedisUtil } from '../utils/redis.util';
import { TokenServiceBindings } from '../keys';
import { inject } from '@loopback/core';

export class AuthController {
  private debug = require('debug')('api:AuthController');

  // private signSecret = process.env.AUTH_JWT_SECRET!;

  @inject(TokenServiceBindings.TOKEN_SECRET)
  private signSecret: string;

  constructor() { }

  @get('/auth/otp', {
    parameters: [
      {
        name: 'x-api-key',
        schema: { type: 'string' },
        in: 'header',
        required: true,
      },
    ],
    responses: {
      '200': {},
    },
  })
  public async authGetOTP(
    @param.header.string('x-api-key') apiKey: string,
  ): Promise<string> {
    this.debug(`/auth/otp with x-api-key ${apiKey}`);

    const ttlInSec = 60;

    // Check against process.env.X_API_KEY
    if (apiKey !== process.env.X_API_KEY) {
      throw HttpErrors.Unauthorized;
    }

    // Generate JWT Token (short lived)
    const token = jwt.sign({}, this.signSecret, { expiresIn: `${ttlInSec}sec` });

    // Store JWT Token in Redis
    RedisUtil.redisClient.set(token, token, 'EX', ttlInSec);

    return token;
  }
}
