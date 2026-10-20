import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { UserService, type TokenService } from './domain/users.js';
import { createAuthRouter, createErrorHandler, createUserRouter } from './routes/user-routes.js';

type HealthResponse = {
  status: 'ok';
};

export function createApp(
  dependencies: { users: UserService; tokens: TokenService },
): Express {
  const app: Express = express();

  app.use(
    (
      request: Request,
      response: Response,
      next: NextFunction,
    ): void => {
      const startedAt: number = Date.now();

      response.on('finish', () => {
        console.info(
          `[HTTP] ${request.method} ${request.originalUrl} ${String(response.statusCode)} ${String(Date.now() - startedAt)}ms`,
        );
      });

      next();
    },
  );

  app.use(express.json({ limit: '16kb', strict: false }));
  app.use('/auth', createAuthRouter(dependencies.users));
  app.use('/users', createUserRouter(dependencies.users, dependencies.tokens));

  app.get(
    '/health',
    (_request: Request, response: Response<HealthResponse>): void => {
      response.status(200).json({ status: 'ok' });
    },
  );

  app.use(createErrorHandler());

  return app;
}
