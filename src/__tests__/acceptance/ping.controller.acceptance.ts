import {Client, expect} from '@loopback/testlab';
import {MemberApiApplication} from '../..';
import {setupApplication} from './test-helper';

describe('PingController', () => {
  let app: MemberApiApplication;
  let client: Client;

  before('setupApplication', async () => {
    ({app, client} = await setupApplication());
  });

  after(async () => {
    await app.stop();
  });

  it('invokes GET /ping', async () => {
    const version = require('../../../package.json').version;
    const res = await client.get('/ping').expect(200);
    expect(res.body).to.containEql({greeting: `Up! API Version ${version}`});
  });
});
