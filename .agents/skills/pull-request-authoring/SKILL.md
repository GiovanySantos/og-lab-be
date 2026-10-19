---
name: pull-request-authoring
description: "Prepare and open a pull request for OG Lab: target main, follow the development and production deployment flow, and write the required English title, type, description, context and motivation, and AI usage disclosure."
---

# Pull request authoring

Use this skill when preparing, creating, or updating a pull request for the OG Lab backend.

## Branch and deployment flow

1. Keep implementation work on a feature branch; do not commit implementation directly to `main`.
2. Open every pull request with `main` as its base branch.
3. Treat the desired flow as automatic deployment to development after changes reach `main` and manually approved production deployment. Do not claim either is operational until the hosting platform and deploy steps are configured; current deployment jobs fail explicitly while that setup is pending.
4. GitHub workflow status checks do not by themselves block merging. Check the [CI/CD guide](../../../docs/ci-cd.md) for the branch-protection/ruleset settings required to enforce checks and reviews, and report accurately if those settings have not been applied.
5. Production deployment requires a configured GitHub `production` environment with required reviewers as well as a protected, working deployment job. Declaring an environment in YAML alone does not enforce approval.
6. A pull request does not itself deploy to production. Do not merge a pull request, trigger a deployment, or claim a production release as part of opening the PR unless explicitly requested and authorized.
7. Before opening the PR, inspect the branch diff against `main`, check the working tree, and run relevant tests or checks. Report checks that could not be run; never claim a check passed without evidence.
8. Before opening the PR, complete the project-wide [customization and architecture consistency review](../../../AGENTS.md#customization-and-architecture-consistency), including a fresh inventory of all project instructions, skills, and custom agents against the final branch state.

## Pull request title and description

- Write the GitHub PR title in English and make it clearly describe the implementation.
- Write the entire PR description in English.
- Use the repository's [GitHub pull request template](../../../.github/PULL_REQUEST_TEMPLATE.md). If the hosting interface does not populate it automatically, copy its sections into the PR description.
- The description must contain these sections, in this order: `# Title`, `## Type`, `## Description`, `## Context and Motivation`, and `## AI Usage`.
- `# Title` is an H1 that repeats the descriptive implementation title. Under `## Type`, select exactly one of Feature, Fix, or Chore using a Markdown task-list checkbox.
- Replace all placeholders with truthful, specific information. Do not leave template instructions or empty sections in the final PR.

## AI usage disclosure

- Disclose every AI model used to plan, implement, review, or test the change when known. Use the exact model identifier if available; do not guess a model name.
- Describe the method used (for example, vibe coding, RPI, or open-spec) and how it was applied to this project. If none of these labels fits, explain the actual workflow in plain English.
- Summarize AI contributions and the human review or verification performed. Be factual, do not overstate validation, and do not include secrets or sensitive prompts.
- If model details are unavailable, say so explicitly and name only what is known; never fabricate usage details.

## Create and verify the PR

1. Ensure the description follows the required template and accurately reflects the branch diff.
2. Create the PR with `base: main`, the current feature branch as `head`, and the English title and description. Use the available GitHub MCP pull-request creation tool when available; otherwise use the authenticated GitHub workflow already configured for the environment.
3. Verify the returned PR URL, base branch, head branch, title, and open state. Report the link and any checks that remain outstanding.
4. Do not merge the PR or deploy to production unless separately requested and authorized.
