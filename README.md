# OG Lab Backend

Node.js backend for the OG Lab community, using Express and TypeScript.

## Requirements

- Node.js 24 or later
- npm

## Getting started

```sh
npm ci
npm run build
npm start
```

The server listens on port `3000` by default. Set `PORT` to use another port.
The `GET /health` endpoint returns the service health status.

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
