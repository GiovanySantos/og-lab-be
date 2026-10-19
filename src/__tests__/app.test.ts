import request from 'supertest';
import { createApp } from '../app.js';

describe('createApp', () => {
  it('returns a healthy status response', async () => {
    await request(createApp())
      .get('/health')
      .expect(200, { status: 'ok' });
  });
});
