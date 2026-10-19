import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';

type HealthResponse = {
  status: 'ok';
};

export function createApp(): Express {
  const app = express();

  app.use(
    (
      request: Request,
      response: Response,
      next: NextFunction,
    ): void => {
      const startedAt = Date.now();

      response.on('finish', () => {
        console.info(
          `[HTTP] ${request.method} ${request.originalUrl} ${String(response.statusCode)} ${String(Date.now() - startedAt)}ms`,
        );
      });

      next();
    },
  );

  app.get(
    '/health',
    (_request: Request, response: Response<HealthResponse>): void => {
      response.status(200).json({ status: 'ok' });
    },
  );

  return app;
}
