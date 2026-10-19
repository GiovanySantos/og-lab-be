---
description: "Use when implementing, reviewing, or making architecture decisions for the OG Lab backend. Defines layer boundaries, ports, dependency injection, external services, caching, and testing expectations."
applyTo: "**/*.ts"
---

# Software architecture instructions

These instructions define the selected architectural direction for the planned OG Lab social network backend. Follow them when proposing, creating, changing, or reviewing code and architecture documentation. The repository currently has no application implementation or selected toolchain; do not describe planned components as already implemented.

## Language, goals, and technologies

- English is the project's default language. Use it for source code, tests, comments, documentation, agent communication, and engineering artifacts unless explicitly requested otherwise or required by an external interface.
- The project is planned as a Node.js monolithic backend written in TypeScript. TypeScript is the selected language, but no implementation or toolchain is present yet. Use the latest stable TypeScript version compatible with dependencies and tools selected by the project.
- Supabase is the first external service. Keep its integration replaceable and allow new external providers without leaking vendor details into business rules.
- Caching is a future capability. Do not add Redis, in-memory cache components, or cache wiring unless a task explicitly requires implementing that capability. Before implementing it, get an explicit decision on the applicable policy and record unresolved decisions; never invent cache precedence, TTLs, invalidation, or strategy. If introduced, keep cache implementations replaceable and out of direct domain dependencies.
- Do not assume an HTTP framework, DI library, test library, source directory layout, or build tool until the project selects one.

## Layers and responsibilities

The runtime call flow proceeds from application entry points toward external services:

`routes/entry points → domain → repositories → clients/adapters → external services`

1. **Routes/entry points:** receive and validate transport input, call the appropriate domain use case, and translate its result into a transport response. They do not implement business rules or access repositories or clients directly.
2. **Domain:** implements business rules and use cases. It declares the small repository ports its use cases consume, receives their implementations through injection, and does not know vendor protocols, SDKs, or vendor-specific models.
3. **Repositories:** implement the domain's repository ports. They receive required clients through injection, convert external data into domain contracts, and keep integration details out of the domain.
4. **Clients/adapters:** encapsulate communication with external services, such as Supabase REST, GraphQL, or database queries, and in-memory or Redis cache implementations. They contain no business rules.

Use the feed flow as an example: the feed route calls the feed use case; that use case calls its injected feed repository port; the concrete repository adapter implements that port, calls its injected Supabase client, and maps the response to the domain contract.

## Dependency injection and direction

- Inject the dependencies required by each layer; avoid implicit singletons, global service access, and service locators.
- The domain owns repository port declarations because the domain defines the needs of its use cases. Repository adapters implement those ports; the domain must not import repository implementations.
- Each port is declared by the layer that consumes it: repository ports belong to the domain, and client ports belong to the repository/adapters that call them. Concrete clients implement those client ports.
- At runtime, entry points call domain use cases, which call injected repository ports; adapters call injected client ports. At source level, keep concrete implementations at the edges and wire them at an application composition root.
- Keep contracts small and oriented around their consumers. Do not expose SDKs or vendor types across layers.
- Do not create dependencies in business rules. If a needed contract is undecided, record the open question rather than assuming a business rule.

## Testing

- Every production code file must have unit tests. Production code means code shipped or executed as part of the running application. The only production-code exception is a file named `index` that contains only re-exports.
- Require 100% statement, branch, function, and line coverage for production code. Do not exclude code to meet the target; only pure re-export barrels may be omitted.
- Test domain rules in isolation with injected repository doubles; test repositories with substituted clients; test clients with isolated external dependencies wherever practical.
- Include relevant success, failure, and boundary paths. Coverage does not replace behavioral assertions.
- No test runner or coverage tool has been selected. Do not assume or add one until the project selects it. Once selected, configure and run it to enforce all four coverage measures without weakening this requirement.
