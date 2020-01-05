/* eslint-disable @typescript-eslint/no-this-alias */
import { get, param, HttpErrors } from "@loopback/rest";
import jwt from 'jsonwebtoken';
import { RedisUtil } from "../utils/redis.util";

export class AuthController {
  private debug = require('debug')('api:AuthController');

  private signSecret = process.env.AUTH_JWT_SECRET!;

  constructor() { }

  @get('/auth/verify', {
    parameters: [
      { name: 'x-api-otp', schema: { type: 'string' }, in: 'header', required: true },
    ],
    responses: {
      '200': {},
    },
  })
  public async authVerifyOTP(
    @param.header.string('x-api-key') apiOtp: string,
  ): Promise<boolean> {
    this.debug(`/auth/verify with x-api-otp ${apiOtp}`);

    const valid = await RedisUtil.redisGetAsync(apiOtp)
      .then((token: string) => {
        if (!token) {
          this.debug(`x-api-otp ${apiOtp} not found in Redis`);
          return false;
        }

        try {
          jwt.verify(apiOtp, this.signSecret);
        } catch (err) {
          this.debug(`jwt.verify failed: ${err}`);
          return false;
        }

        // Invalidate token
        RedisUtil.redisClient.del(apiOtp);

        return true;
      })

    return valid;
  }

  @get('/auth/otp', {
    parameters: [
      { name: 'x-api-key', schema: { type: 'string' }, in: 'header', required: true },
    ],
    responses: {
      '200': {}
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
