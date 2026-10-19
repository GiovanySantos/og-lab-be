# CI/CD

The GitHub Actions workflow in `.github/workflows/ci.yml` runs lint, strict
TypeScript checks, production builds, Jest unit tests with 100% statement,
branch, function, and line coverage, and an npm audit for moderate-or-higher
vulnerabilities on pull requests targeting `main`.

## Preventing merges before checks pass

GitHub Actions reports job results; a workflow file by itself does not require
those checks for merging. To block merges, a repository administrator must
configure a ruleset or branch-protection rule for `main` in GitHub repository
settings:

1. Require a pull request before merging.
2. Require the `Type safety and build`, `Unit tests and coverage`, and
   `Dependency audit` status checks to pass.
3. Require at least one approving review.
4. Require all review conversations to be resolved.
5. Optionally require branches to be up to date before merging.

These repository settings have not been applied by this change. Without them,
GitHub may allow merging even when a workflow check fails.

## Deployment status

The desired flow is automatic development deployment after changes reach
`main`, plus production deployment started manually with approval. The hosting
platform is not selected yet, so no real deployment action or credentials can
be configured.

Until a hosting platform is selected, both deployment jobs intentionally fail
with an explicit configuration error rather than report a successful
no-deployment. The development placeholder runs after CI on pushes to `main`.
The production placeholder runs only when `CI/CD` is manually dispatched from
`main` and uses the GitHub `production` environment.

Before enabling real deployments:

1. Select development and production hosting targets and the supported
   deployment mechanism.
2. Configure scoped credentials as GitHub Actions secrets or OIDC, as supported
   by the hosting provider; never store credentials in the repository.
3. Configure a GitHub `production` environment with required reviewers and any
   deployment restrictions. Declaring the environment in workflow YAML alone
   does not require approval.
4. Replace the failing placeholders with deployment steps that consume the
   chosen targets and credentials, and validate those steps before enabling
   production.
