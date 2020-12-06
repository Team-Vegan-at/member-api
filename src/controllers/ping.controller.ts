import {Request, RestBindings, get, ResponseObject} from '@loopback/rest';
import {inject} from '@loopback/core';

/**
 * OpenAPI response for ping()
 */
const PING_RESPONSE: ResponseObject = {
  description: 'Ping Response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          greeting: {type: 'string'},
          date: {type: 'string'},
          url: {type: 'string'},
          headers: {
            type: 'object',
            properties: {
              'Content-Type': {type: 'string'},
            },
            additionalProperties: true,
          },
        },
      },
    },
  },
};

/**
 * A simple controller to bounce back http requests
 */
export class PingController {
  // Map to `GET /ping`
  @get('/ping', {
    responses: {
      '200': PING_RESPONSE,
    },
  })
  ping(
    @inject(RestBindings.Http.REQUEST) request: Request
  ): object {
    const version = require('../../package.json').version;
    // Reply with a greeting, the current time, the url, and request headers
    return {
      greeting: `Up! API Version ${version}`,
      date: new Date(),
      headers: { ...request.headers },
      url: request.url
    };
  }
}
