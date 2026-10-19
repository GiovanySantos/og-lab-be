---
name: architecture-consultation
description: "Consult or explain the OG Lab backend software architecture, determine which layer owns a responsibility, and guide dependency flows across routes, domain, repositories, clients, Supabase, and cache."
---

# Architecture consultation

Use this skill when asked to explain, assess, or apply the OG Lab backend architecture, including decisions about layers, dependency injection, data flow, Supabase, or caching.

## Procedure

1. Read the [architecture instructions](../../../.github/instructions/software-architecture.instructions.md) and use them as the source of truth.
2. Identify the flow or responsibility in question and place it in the appropriate layer:
   - transport entry points and routing;
   - business rules and use cases (`domain`);
   - contract adaptation and data access (`repositories`);
   - technical vendor and cache integration (`clients/adapters`).
3. Describe the dependency and call path. For example, the feed flow is route → feed domain → feed repository → Supabase client.
4. Check that dependencies are injected and external details stay at the edges. Identify cross-layer coupling or business rules placed in clients or routes.
5. Distinguish established decisions from open questions. Do not invent a framework, DI library, cache policy, TTL, invalidation strategy, API contract, or physical source layout.
6. When recommending a change, identify the unit tests needed to preserve the 100% coverage target defined in the instructions.

## Boundaries

- This skill guides architecture consultations and decisions; it does not authorize introducing technologies or policies that have not been selected.
- When multiple compatible solutions are possible, explain the simplest option and state its assumptions without presenting an assumption as an established decision.
