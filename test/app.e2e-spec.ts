/** Só para este ficheiro e2e: AppModule usa guard permissivo (Nest 11 regista APP_GUARD com token interno UUID). */
process.env.BEETHOVEN_E2E = '1';
process.env.AUTH0_DOMAIN ??= 'test-tenant.us.auth0.com';
process.env.AUTH0_AUDIENCE ??= 'https://beethoven-api-test';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

jest.setTimeout(30_000);

describe('beethoven-api (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  it('/artists (GET)', () => {
    return request(app.getHttpServer()).get('/artists').expect(200);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
