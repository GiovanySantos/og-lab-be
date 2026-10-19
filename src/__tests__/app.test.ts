import request from 'supertest';
import { createApp } from '../app.js';

describe('createApp', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a healthy status response', async () => {
    await request(createApp())
      .get('/health')
      .expect(200, { status: 'ok' });
  });

  it('logs the method, path, status, and duration of completed requests', async () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);

    await request(createApp())
      .get('/health')
      .expect(200, { status: 'ok' });

    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[HTTP\] GET \/health 200 \d+ms$/),
    );
  });
});
