import express, { type Express, type Request, type Response } from 'express';

type HealthResponse = {
  status: 'ok';
};

export function createApp(): Express {
  const app = express();

  app.get(
    '/health',
    (_request: Request, response: Response<HealthResponse>): void => {
      response.status(200).json({ status: 'ok' });
    },
  );

  return app;
}
