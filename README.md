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

1. Apply the database schema using the Supabase CLI migration workflow below.
   The `users` table has row-level security enabled and grants access only to
   the server-side `service_role`.
   Use an HTTPS Supabase URL in deployed environments; HTTP is accepted only
   for `localhost`, `127.0.0.1`, or `::1` during local development.
2. Create the R2 bucket named by `R2_BUCKET`. Configure a public custom domain
   for profile images and set `R2_PUBLIC_BASE_URL` to that origin so Thumbor can
   fetch stored objects. Use R2 credentials scoped to that bucket.
3. Configure a deployed Thumbor service with the same `THUMBOR_SECURITY_KEY`
   (at least 32 random bytes) and set `THUMBOR_BASE_URL` to its public HTTPS
   origin.
4. Set `JWT_SECRET` to at least 32 random bytes. Keep every secret server-side;
   never expose the Supabase service-role key, R2 credentials, JWT secret, or
   Thumbor key to a client.

### Database migrations

The Supabase CLI is installed as a project development dependency. Run it
through npm scripts so every developer uses the version in `package-lock.json`.
Docker Desktop must be running for the local Supabase stack.
The local database version in `supabase/config.toml` must match the remote
project's Postgres major version; check it with `SHOW server_version;` in the
remote SQL Editor before starting local services.

Start the local services and apply pending migrations to the local database:

```powershell
npm run db:start:local
npm run db:push:local
```

Stop the local services with `npm run db:stop:local`.

To recreate the local database from all migrations, use
`npm run db:reset:local`. **This deletes data in the local Supabase database.**

Create a new migration with:

```powershell
npm run db:migration:new -- add_a_descriptive_change
```

Review and test every new migration against the local database before applying
it remotely. Sign in to the Supabase CLI once on your machine:

```powershell
npm exec -- supabase login
```

For each remote environment, use that project's **Project Ref** from the
Supabase dashboard. Always specify the target explicitly; do not rely on a
previously linked project:

```powershell
$devProjectRef = "replace-with-dev-project-ref"
npm run db:migration:list:remote -- $devProjectRef
npm run db:push:remote:dry-run -- $devProjectRef
npm run db:push:remote -- $devProjectRef
```

After the development deployment is verified, review the production plan and
push using the production project's distinct ref:

```powershell
$prodProjectRef = "replace-with-prod-project-ref"
npm run db:migration:list:remote -- $prodProjectRef
npm run db:push:remote:dry-run -- $prodProjectRef
npm run db:push:remote -- $prodProjectRef
```

The CLI prompts for the database password when needed and confirms before
applying migrations. Do not pass `--yes`, put database passwords or access
tokens in command arguments, or commit credentials. The remote push scripts
skip Vault synchronization and only apply SQL migrations. Inspect the dry-run
output and target ref before approving a remote change. Take/verify a
production backup and schedule potentially disruptive migrations
appropriately. GitHub Actions deployment is not configured; any future
automation should keep credentials in protected secrets and require an
approved production environment.

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

ESLint requires explicit type annotations for variable declarations and
destructured parameters, and rejects explicit `any`, `unknown`, and `never`
types, type assertions, non-null assertions, TypeScript suppression comments,
and inline ESLint configuration. TypeScript's strict compiler checks apply to
application and test code. Tests live in `__tests__` directories beside the
source paths they cover (for example, `src/__tests__` contains tests for files
directly in `src`).

Non-standard dependency choices, version decisions, overrides, and package
patches are documented in the [dependency decision ledger](docs/dependency-decisions.md).

Run `npm run pipeline` before pushing a branch or opening/updating a pull
request. GitHub Actions and automated deployment are currently disabled;
quality checks must be run locally.
