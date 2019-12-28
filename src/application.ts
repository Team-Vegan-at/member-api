/* eslint-disable @typescript-eslint/no-floating-promises */
import { BootMixin } from '@loopback/boot';
import { ApplicationConfig } from '@loopback/core';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import { RestApplication, OpenApiSpec } from '@loopback/rest';
import { ServiceMixin } from '@loopback/service-proxy';
import path from 'path';
import { MySequence } from './sequence';
import express from 'express';
import { Request, Response } from 'express';

export class MemberApiApplication extends BootMixin(
  ServiceMixin(RestApplication),
) {

  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up the custom sequence
    this.sequence(MySequence);

    // Set up default home page
    this.static('/', path.join(__dirname, '../public'));

    // // Set up checkout page
    const checkoutRouter = express();
    checkoutRouter.get('/start', function (req: Request, res: Response) {
      // ... Edit user UI ...
      console.debug(`++ checkout()`);
      // res.sendStatus(401);
      res.redirect('/checkout/stripe');
      // return res;
    });

    const spec: OpenApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'LoopBack Application',
        version: '1.0.0',
      },
      paths: {
        '/checkout': {
          get: {
            parameters: [{ name: 'name', in: 'query', schema: { type: 'string' } }],
            responses: {
              '200': {
                description: 'greeting text',
                content: {
                  'application/json': {
                    schema: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };

    this.mountExpressRouter('/checkout', checkoutRouter, spec);

    // Customize @loopback/rest-explorer configuration here
    this.bind(RestExplorerBindings.CONFIG).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
    };
  }
}
