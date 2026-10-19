# OG Lab Backend

This repository contains the planned Node.js monolithic backend for the OG Lab social network. This file is the shared entry point for coding agents from any provider. Before implementation or architecture work, read the [architecture instructions](.github/instructions/software-architecture.instructions.md). For architecture questions, analysis, or decisions, follow the [architecture consultation skill](.agents/skills/architecture-consultation/SKILL.md). When preparing a pull request, follow the [pull request authoring skill](.agents/skills/pull-request-authoring/SKILL.md) and the GitHub [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

## Project guidelines

- Use English for all project artifacts and agent communication, including source code, tests, comments, documentation, commit messages, branch/PR descriptions, and AI usage disclosures. Use another language only when explicitly requested or required by an external interface.
- TypeScript is the selected language for the planned implementation. Use the latest stable version compatible with the dependencies and tools adopted by the project; do not imply that a codebase or toolchain already exists.
- Supabase is the first external service; the architecture must allow other services to be added without coupling business rules to vendors.
- Caching is a future capability, not a requirement to add Redis or in-memory cache components to every change. Do not implement or wire caching until a task explicitly requires it and the applicable policy is decided; never invent cache precedence, TTLs, invalidation, or strategy.
- Preserve the layer and dependency rules in the architecture instructions. Declare repository ports in the domain, implement them in repository adapters, inject dependencies explicitly, and construct concrete dependencies at a composition root.
- Every production code file must have unit tests and 100% statement, branch, function, and line coverage. The sole production-code exception is an `index` file containing only re-exports. Do not weaken this requirement or exclude code to meet it.
- Do not assume an HTTP framework, dependency injection library, source directory layout, test library, build commands, or API conventions that have not yet been selected. Inspect existing files and configuration before proposing or adding tools.

## Cross-agent usage

Treat this `AGENTS.md` and its referenced documents as the shared project guidelines regardless of agent provider or editor. The skills in `.agents/skills/` are on-demand workflows: use the architecture consultation skill for architecture questions, analysis, or decisions, and the pull request authoring skill when preparing a pull request. If a provider does not discover these skills automatically, read the relevant `SKILL.md` directly. Keep these shared documents as the source of truth; do not duplicate their content in provider-specific files.
