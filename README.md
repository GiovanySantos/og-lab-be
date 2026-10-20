# OG Lab Backend

Node.js backend for the OG Lab community, using Express and TypeScript.

## Requirements

- Node.js 24 or later
- npm

## Getting started

```sh
npm ci
Copy-Item .env.example .env
npm run build
npm start
```

Set the service credentials and secret values in `.env` before starting the
server. Node.js 24 loads this file for both `npm start` and `npm run watch`.
Keep `.env` private; only the placeholder `.env.example` belongs in source
control. The server fails fast when required configuration is missing or
invalid.

### External services

1. Apply `supabase/migrations/20261019210000_create_users_table.sql` to the
   Supabase project using its SQL Editor. The table has row-level security
   enabled and grants access only to the server-side `service_role`.
2. Create the R2 bucket named by `R2_BUCKET`. Configure a public custom domain
   for profile images and set `R2_PUBLIC_BASE_URL` to that origin so Thumbor can
   fetch stored objects. Use R2 credentials scoped to that bucket.
3. Configure a deployed Thumbor service with the same `THUMBOR_SECURITY_KEY`
   (at least 32 random bytes) and set `THUMBOR_BASE_URL` to its public HTTPS
   origin.
4. Set `JWT_SECRET` to at least 32 random bytes. Keep every secret server-side;
   never expose the Supabase service-role key, R2 credentials, JWT secret, or
   Thumbor key to a client.

### User and authentication API

The server listens on port `3000` by default; set `PORT` to choose another
port. `GET /health` returns the service health status.

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Create an account and return its user profile and access token. |
| `POST` | `/auth/login` | Public | Verify email/password and return the profile and access token. |
| `GET` | `/users/me` | Bearer token | Read the authenticated user's profile. |
| `PATCH` | `/users/me` | Bearer token | Change the username. |
| `PATCH` | `/users/me/password` | Bearer token + current password | Change the password after reauthentication. |
| `POST` | `/users/me/profile-image` | Bearer token | Upload a JPEG, PNG, or WebP image as the raw request body (`Content-Type` must match); maximum 5 MB. |
| `DELETE` | `/users/me` | Bearer token | Delete the authenticated user's account and profile image. |

User IDs are UUIDs. Usernames and email addresses are unique without
case-sensitivity. Passwords must be 12–128 characters and are stored as
scrypt hashes; password hashes are never returned by the API. Email changes
and refresh tokens are not supported in this first iteration. Access tokens
are signed with HS256 and expire after 15 minutes.

Profile uploads store the original image in R2. Profile responses include a
signed Thumbor URL requesting WebP output at quality 80; Thumbor transforms
images when they are served rather than persisting a second optimized copy.

## Quality checks

```sh
npm run pipeline
```

This command installs exactly the versions in `package-lock.json`, then runs
ESLint, strict TypeScript checks, Jest unit tests with 100% statement, branch,
function, and line coverage, the production build, and an npm audit that fails
on moderate-or-higher vulnerabilities.

ESLint rejects explicit `any`, `unknown`, and `never` types, type assertions,
non-null assertions, TypeScript suppression comments, and inline ESLint
configuration. TypeScript's strict compiler checks apply to application and
test code. Tests live in `__tests__` directories beside the source paths they
cover (for example, `src/__tests__` contains tests for files directly in `src`).

Non-standard dependency choices, version decisions, overrides, and package
patches are documented in the [dependency decision ledger](docs/dependency-decisions.md).

Run `npm run pipeline` before pushing a branch or opening/updating a pull
request. GitHub Actions and automated deployment are currently disabled;
quality checks must be run locally.
