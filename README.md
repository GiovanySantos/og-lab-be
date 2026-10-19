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
npm run lint
npm run typecheck
npm test -- --ci
npm run build
```

The Jest suite enforces 100% statement, branch, function, and line coverage for
production TypeScript files. ESLint rejects explicit `any`, `unknown`, and
`never` types, type assertions, non-null assertions, TypeScript suppression
comments, and inline ESLint configuration. TypeScript's strict compiler checks
apply to both application and test code.

The GitHub Actions workflow runs type-safety/build checks, unit tests, and a
dependency audit in separate CI jobs; any failed check fails the workflow.

Non-standard dependency choices, version decisions, overrides, and package
patches are documented in the [dependency decision ledger](docs/dependency-decisions.md).
