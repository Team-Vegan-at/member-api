import { MemberApiApplication } from './application';
import { ApplicationConfig } from '@loopback/core';

export { MemberApiApplication };

export async function main(options: ApplicationConfig = {}) {
  require('dotenv').config();
  const debug = require('debug')('api:app');
  const app = new MemberApiApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  debug(`Server is running at ${url}`);
  debug(`Try ${url}/ping`);

  return app;
}
