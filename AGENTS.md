# OG Lab Backend

This repository contains the Node.js monolithic backend for the OG Lab social network. This file is the shared entry point for coding agents from any provider. Before implementation or architecture work, read the [architecture instructions](.github/instructions/software-architecture.instructions.md). For architecture questions, analysis, or decisions, follow the [architecture consultation skill](.agents/skills/architecture-consultation/SKILL.md). When preparing a pull request, follow the [pull request authoring skill](.agents/skills/pull-request-authoring/SKILL.md) and the GitHub [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

Before changing dependency manifests, lockfiles, package patches, overrides, or resolution rules, read the [dependency decisions instruction](.github/instructions/dependency-decisions.instructions.md). Record every non-standard dependency or version choice and its rationale in the [dependency decision ledger](docs/dependency-decisions.md) in the same change.

## Project guidelines

- Use English for all project artifacts and agent communication, including source code, tests, comments, documentation, commit messages, branch/PR descriptions, and AI usage disclosures. Use another language only when explicitly requested or required by an external interface.
- The selected initial stack is Node.js 24+, TypeScript 6, Express 5, Jest 30 with ts-jest 29, ESLint 10, and npm. Check `package.json` and the checked-in tool configurations for current versions and commands; do not rely on stale version examples in guidance.
- ESLint requires explicit type annotations on TypeScript variable declarations and destructured parameters, including test files. Keep annotations specific and do not weaken the rule to allow inferred declarations.
- The application is implemented under `src/`; place Jest unit tests in a `__tests__` directory within the source path they cover (for example, `src/__tests__/` for files directly under `src/`).
- GitHub Actions CI/CD is currently disabled. Before pushing any branch or opening/updating a pull request, run `npm run pipeline` and require it to pass. See `docs/ci-cd.md` for the exact checks and current enforcement limitations.
- Supabase is the first external service; the architecture must allow other services to be added without coupling business rules to vendors.
- Caching is a future capability, not a requirement to add Redis or in-memory cache components to every change. Do not implement or wire caching until a task explicitly requires it and the applicable policy is decided; never invent cache precedence, TTLs, invalidation, or strategy.
- Preserve the layer and dependency rules in the architecture instructions. Declare repository ports in the domain, implement them in repository adapters, inject dependencies explicitly, and construct concrete dependencies at a composition root.
- Every production code file must have unit tests and 100% statement, branch, function, and line coverage. The sole production-code exception is an `index` file containing only re-exports. Do not weaken this requirement or exclude code to meet it.
- Express and Jest are selected; no DI library has been selected. Inspect existing files and configuration before introducing additional tools or changing established API and build conventions.

## Customization and architecture consistency

- For **every task that changes any project file**, review the complete current project guidance before finishing: this `AGENTS.md`, every `*.instructions.md` under `.github/instructions/`, every `SKILL.md` under `.agents/skills/`, and every custom agent definition under `.github/agents/` (for example, `*.agent.md`). Enumerate files from the working tree rather than relying on a remembered list; a directory may be empty. Generated files under `node_modules/`, `coverage/`, and `dist/` are not project changes.
- Compare all of those instructions, skills, and agent definitions with the final code, package manifests, tool configurations, CI workflows, and project documentation. Update any statements made stale by the change in the same task. If a guidance file describes a decision as open or unselected, verify the current implementation before preserving that claim.
- Treat newly added or changed framework, runtime, package, test, build, CI, source-layout, architectural-layer, and security-policy choices as triggers for this consistency review. Do not limit review to files directly matched by an instruction's `applyTo`.
- When changing or adding a project skill or custom agent, review the other project skills and custom agents too, so shared workflows and responsibilities remain consistent.
- Do not rewrite guidance that remains accurate. If a requested change leaves a real conflict unresolved, explain the conflict instead of claiming the review is complete.

## Local quality gate before publishing

- Before **every `git push`** and before **opening or updating any pull request**, run `npm run pipeline` from the repository root and require a successful exit. This applies to implementation changes and documentation-only changes.
- If the pipeline fails, do not push or open/update the PR. Fix the failure, rerun the entire `npm run pipeline`, and only proceed after it passes. If it cannot be run because prerequisites or external services are unavailable, stop before publishing and report the blocker; do not claim it passed.
- `npm run pipeline` performs a clean lockfile install (`npm ci`), lint, strict type-check, Jest tests with enforced coverage, production build, and moderate-or-higher npm audit. Do not replace it with only a subset of checks.
- GitHub Actions is currently disabled, so local validation is the required gate. Do not assume GitHub can enforce this command as a required status check.
- After `npm run pipeline` passes for the requested changes, commit those changes and push the commit to the current feature branch by default. Do not push directly to `main`. If the user explicitly asks not to commit or push, or publication is blocked, honor that instruction and explain the outcome.

## Cross-agent usage

Treat this `AGENTS.md` and its referenced documents as the shared project guidelines regardless of agent provider or editor. The skills in `.agents/skills/` are on-demand workflows: use the architecture consultation skill for architecture questions, analysis, or decisions, and the pull request authoring skill when preparing a pull request. If a provider does not discover these skills automatically, read the relevant `SKILL.md` directly. Keep these shared documents as the source of truth; do not duplicate their content in provider-specific files.
