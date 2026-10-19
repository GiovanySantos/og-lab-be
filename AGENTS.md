# OG Lab Backend

This repository contains the Node.js monolithic backend for the OG Lab social network. This file is the shared entry point for coding agents from any provider. Before working on the project, read the architecture instructions in [`.ai/instructions/software-architecture.instructions.md`](.ai/instructions/software-architecture.instructions.md). For architecture questions, analysis, or decisions, consult the [architecture consultation skill](.ai/skills/architecture-consultation/SKILL.md). When preparing a pull request, follow the [pull request authoring skill](.ai/skills/pull-request-authoring/SKILL.md) and the GitHub [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

## Project guidelines

- English is the project's default language and must be used for all project artifacts and agent communication, including source code, tests, comments, documentation, commit messages, branch/PR descriptions, and AI usage disclosures. Use another language only when explicitly requested or required by an external interface.
- The backend will use TypeScript, using the latest stable version compatible with the dependencies and tools adopted by the project.
- Supabase is the first external service; the architecture must allow other services to be added without coupling business rules to vendors.
- Redis and in-memory caching are requirements. Cache policies and implementation details have not yet been decided; do not assume TTLs, strategies, or precedence without an explicit decision.
- Preserve the separation between entry points/routes, domain, repositories, and clients described in the architecture instructions. Inject dependencies explicitly and construct the dependency graph at a composition root.
- Every production code file must have unit tests. The target is 100% coverage; files named `index` that only re-export modules are the sole exception. Preserve this target and add tests for new behavior and error paths.
- Do not assume an HTTP framework, dependency injection library, source directory layout, test library, build commands, or API conventions that have not yet been selected. Inspect existing files and configuration before proposing or adding tools.

## Cross-agent usage

Treat this `AGENTS.md` and its referenced documents as the shared project guidelines regardless of agent provider or editor. If a tool has its own discovery mechanism for instructions or skills, use it for discovery while keeping these documents as the source of truth and avoiding duplicated content.
