---
name: architecture-consultation
description: "Consult or explain the OG Lab backend software architecture, determine which layer owns a responsibility, and guide dependency flows across routes, domain, repositories, clients, Supabase, and cache."
---

# Architecture consultation

Use this skill when asked to explain, assess, or apply the OG Lab backend architecture, including decisions about layers, dependency injection, data flow, Supabase, or caching.

## Procedure

1. Read the [architecture instructions](../../../.github/instructions/software-architecture.instructions.md) and use them as the source of truth.
2. Verify selected technologies, directory layout, scripts, and enforcement against the current manifests and tool configuration. If a code or configuration change is in scope, follow the project-wide [customization consistency review](../../../AGENTS.md#customization-and-architecture-consistency): inspect all project instructions, skills, and custom agents and update any guidance made stale by the final implementation.
3. Identify the flow or responsibility in question and place it in the appropriate layer:
   - transport entry points and routing;
   - business rules and use cases (`domain`);
   - contract adaptation and data access (`repositories`);
   - technical vendor and cache integration (`clients/adapters`).
4. Describe the dependency and call path. The feed flow in the instructions is a future example, not an implemented feature.
5. Check that dependencies are injected and external details stay at the edges. Identify cross-layer coupling or business rules placed in clients or routes.
6. Distinguish established decisions from open questions. Use the selected stack and project configuration where they exist; do not invent a DI library, cache policy, TTL, invalidation strategy, API contract, or physical source layout.
7. When recommending a change, identify the unit tests needed to preserve the 100% coverage target defined in the instructions and place them in a `__tests__` directory within the source path they cover.

## Boundaries

- This skill guides architecture consultations and decisions; it does not authorize introducing technologies or policies that have not been selected. Confirm current decisions in the repository before treating them as open.
- When multiple compatible solutions are possible, explain the simplest option and state its assumptions without presenting an assumption as an established decision.
