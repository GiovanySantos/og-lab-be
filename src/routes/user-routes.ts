import express, {
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import {
  DuplicateUserError,
  ImageStorageError,
  InvalidCredentialsError,
  InvalidTokenError,
  UserInputError,
  UserNotFoundError,
  UserRepositoryError,
  UserService,
  type TokenService,
} from '../domain/users.js';
import type { ParamsDictionary } from 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Locals {
    userId: string;
  }
}

type ErrorResponse = { error: string };
type JsonBody = Record<string, string>;
type JsonInput = object | string | number | boolean | null | undefined;
type JsonRequest = Request<ParamsDictionary, object, JsonInput>;

export function createAuthRouter(users: UserService): express.Router {
  const router = express.Router();

  router.post(
    '/register',
    async (request: JsonRequest, response: Response) => {
      const body = stringBody(request);
      const result = await users.register({
        username: requiredField(body, 'username'),
        email: requiredField(body, 'email'),
        password: requiredField(body, 'password'),
      });
      response.status(201).json(result);
    },
  );

  router.post(
    '/login',
    async (request: JsonRequest, response: Response) => {
      const body = stringBody(request);
      const result = await users.login({
        email: requiredField(body, 'email'),
        password: requiredField(body, 'password'),
      });
      response.status(200).json(result);
    },
  );

  return router;
}

export function createUserRouter(
  users: UserService,
  tokens: TokenService,
): express.Router {
  const router = express.Router();

  router.get('/me', authenticate(tokens), async (_request, response) => {
    response.status(200).json(await users.getProfile(response.locals.userId));
  });

  router.patch('/me', authenticate(tokens), async (request: JsonRequest, response) => {
    const body = stringBody(request);
    if (Object.keys(body).length !== 1) {
      throw new UserInputError('Only the username can be changed.');
    }

    response.status(200).json(
      await users.updateUsername(
        response.locals.userId,
        requiredField(body, 'username'),
      ),
    );
  });

  router.patch(
    '/me/password',
    authenticate(tokens),
    async (request: JsonRequest, response) => {
      const body = stringBody(request);
      if (
        Object.keys(body).length !== 2 ||
        body['currentPassword'] === undefined ||
        body['newPassword'] === undefined
      ) {
        throw new UserInputError(
          'Current and new passwords are required to change a password.',
        );
      }

      response.status(200).json(
        await users.changePassword(
          response.locals.userId,
          body['currentPassword'],
          body['newPassword'],
        ),
      );
    },
  );

  router.post(
    '/me/profile-image',
    authenticate(tokens),
    express.raw({
      limit: '5mb',
      type: ['image/jpeg', 'image/png', 'image/webp'],
    }),
    async (request, response) => {
      const contentType = request.get('content-type')?.split(';')[0];
      if (
        contentType !== 'image/jpeg' &&
        contentType !== 'image/png' &&
        contentType !== 'image/webp'
      ) {
        response.status(415).json({ error: 'Use a JPEG, PNG, or WebP image.' });
        return;
      }

      if (!Buffer.isBuffer(request.body)) {
        throw new UserInputError('An image file is required.');
      }

      if (!hasMatchingImageSignature(request.body, contentType)) {
        throw new UserInputError('Image content does not match its content type.');
      }

      response.status(200).json(
        await users.uploadProfileImage(
          response.locals.userId,
          request.body,
          contentType,
        ),
      );
    },
  );

  router.delete('/me', authenticate(tokens), async (_request, response) => {
    await users.deleteAccount(response.locals.userId);
    response.status(204).end();
  });

  return router;
}

export function createErrorHandler(): (
  error: Error,
  request: Request,
  response: Response<ErrorResponse>,
  next: NextFunction,
) => void {
  return (error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    if (error instanceof UserInputError) {
      response.status(400).json({ error: error.message });
      return;
    }

    if (
      error instanceof InvalidCredentialsError ||
      error instanceof InvalidTokenError
    ) {
      response.status(401).json({ error: 'Authentication failed.' });
      return;
    }

    if (error instanceof DuplicateUserError) {
      response.status(409).json({ error: error.message });
      return;
    }

    if (error instanceof UserNotFoundError) {
      response.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof SyntaxError && 'body' in error) {
      response.status(400).json({ error: 'Request body must contain valid JSON.' });
      return;
    }

    if (error.name === 'PayloadTooLargeError') {
      response.status(413).json({ error: 'Image must not exceed 5 MB.' });
      return;
    }

    if (error instanceof UserRepositoryError) {
      console.error('[HTTP] User repository request failed', error);
      response.status(502).json({ error: 'User service is unavailable.' });
      return;
    }

    if (error instanceof ImageStorageError) {
      console.error('[HTTP] Profile image storage request failed', error);
      response.status(502).json({ error: 'Profile image storage is unavailable.' });
      return;
    }

    console.error('[HTTP] Unhandled request error', error);
    response.status(500).json({ error: 'An unexpected error occurred.' });
  };
}

function authenticate(tokens: TokenService): RequestHandler {
  return (request, response, next) => {
    const authorization = request.get('authorization');
    const token =
      authorization === undefined
        ? undefined
        : /^Bearer ([^\s]+)$/i.exec(authorization)?.[1];

    if (token === undefined) {
      next(new InvalidTokenError('A bearer token is required.'));
      return;
    }

    let userId: string;
    try {
      userId = tokens.verify(token);
    } catch (error) {
      next(error);
      return;
    }

    response.locals.userId = userId;
    next();
  };
}

function stringBody(request: JsonRequest): JsonBody {
  if (
    request.body === null ||
    request.body === undefined ||
    typeof request.body !== 'object' ||
    Array.isArray(request.body)
  ) {
    throw new UserInputError('A JSON object is required.');
  }

  const entries = Object.entries(request.body);
  const result: JsonBody = {};

  for (const [key, value] of entries) {
    if (typeof value !== 'string') {
      throw new UserInputError('Request body contains missing or invalid fields.');
    }

    result[key] = value;
  }

  return result;
}

function requiredField(body: JsonBody, field: string): string {
  const value = body[field];

  if (value === undefined) {
    throw new UserInputError(`The ${field} field is required.`);
  }

  return value;
}

function hasMatchingImageSignature(
  image: Buffer,
  contentType: 'image/jpeg' | 'image/png' | 'image/webp',
): boolean {
  if (contentType === 'image/jpeg') {
    return (
      image.length >= 3 &&
      image[0] === 0xff &&
      image[1] === 0xd8 &&
      image[2] === 0xff
    );
  }

  if (contentType === 'image/png') {
    return image.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }

  return (
    image.length >= 12 &&
    image.toString('ascii', 0, 4) === 'RIFF' &&
    image.toString('ascii', 8, 12) === 'WEBP'
  );
}
