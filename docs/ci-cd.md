# Local quality pipeline

GitHub Actions and deployment workflows are currently disabled. Run the local
pipeline before publishing any branch or creating/updating a pull request:

```sh
npm run pipeline
```

The `pipeline` script runs these steps in order and stops immediately on
failure:

1. `npm ci` installs the exact dependency tree recorded in `package-lock.json`.
2. `npm run lint` rejects type escapes, assertions, and lint suppressions.
3. `npm run typecheck` checks the application and tests with strict TypeScript.
4. `npm test -- --ci` runs Jest and enforces 100% statement, branch, function,
   and line coverage. Jest discovers `*.test.ts` files inside source
   `__tests__` directories; those test files are excluded from production
   coverage and the build output.
5. `npm run build` compiles the production application.
6. `npm audit --audit-level=moderate` fails on moderate- or higher-severity
   dependency advisories.

## Pull requests and pushes

GitHub cannot enforce a local script as a required status check. Contributors
and agents must run `npm run pipeline` successfully before pushing a branch or
opening/updating a pull request. A reviewer should verify the result before
merging. Since there is no active Actions workflow, failed local checks do not
automatically block a push or merge on GitHub.

## Deployment

Automated deployment is not configured. Before adding CI/CD workflows:

1. Select development and production hosting targets and the supported
   deployment mechanism.
2. Configure scoped credentials as GitHub Actions secrets or OIDC, as supported
   by the hosting provider; never store credentials in the repository.
3. Configure a GitHub `production` environment with required reviewers and any
   deployment restrictions.
4. Restore CI workflows that execute the same checks as `npm run pipeline`,
   expose stable required status checks, and only deploy after all required
   checks pass.
