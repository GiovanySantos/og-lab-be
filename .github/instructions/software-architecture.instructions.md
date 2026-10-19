---
description: "Use when implementing, reviewing, or making architecture decisions for the OG Lab backend. Defines layer boundaries, ports, dependency injection, external services, caching, and testing expectations."
applyTo: "**/*.ts"
---

# Software architecture instructions

These instructions define the architectural direction for the OG Lab social network backend. Follow them when proposing, creating, changing, or reviewing code and architecture documentation. The initial application and toolchain are implemented; distinguish implemented components from planned capabilities.

## Language, goals, and technologies

- English is the project's default language. Use it for source code, tests, comments, documentation, agent communication, and engineering artifacts unless explicitly requested otherwise or required by an external interface.
- The project is a Node.js monolithic backend written in TypeScript. Its initial implementation uses Node.js 24+, TypeScript 6, Express 5, Jest 30 with ts-jest 29, ESLint 10, and npm. The application is under `src/`, with unit tests under `test/`. Consult `package.json`, the TypeScript/Jest/ESLint configuration, and the CI workflow for the exact supported versions and commands; update this instruction if those decisions change.
- Supabase is the first external service. Keep its integration replaceable and allow new external providers without leaking vendor details into business rules.
- Caching is a future capability. Do not add Redis, in-memory cache components, or cache wiring unless a task explicitly requires implementing that capability. Before implementing it, get an explicit decision on the applicable policy and record unresolved decisions; never invent cache precedence, TTLs, invalidation, or strategy. If introduced, keep cache implementations replaceable and out of direct domain dependencies.
- Express is the selected HTTP framework. Jest with ts-jest and V8 coverage is the selected unit test and coverage tool. TypeScript's compiler is the build tool; npm scripts define the supported build and quality commands. No DI library has been selected: inject dependencies explicitly and compose concrete dependencies at the application entry point without introducing a container unless separately decided.

## Layers and responsibilities

The intended runtime call flow for features that use domain and data-access layers proceeds from application entry points toward external services:

`routes/entry points → domain → repositories → clients/adapters → external services`

1. **Routes/entry points:** receive and validate transport input, call the appropriate domain use case, and translate its result into a transport response. They do not implement business rules or access repositories or clients directly. The current implementation has an Express `/health` route in `src/app.ts`; it does not yet implement the feature-layer flow below.
2. **Domain:** implements business rules and use cases. It declares the small repository ports its use cases consume, receives their implementations through injection, and does not know vendor protocols, SDKs, or vendor-specific models.
3. **Repositories:** implement the domain's repository ports. They receive required clients through injection, convert external data into domain contracts, and keep integration details out of the domain.
4. **Clients/adapters:** encapsulate communication with external services, such as Supabase REST, GraphQL, or database queries, and in-memory or Redis cache implementations. They contain no business rules.

The feed flow is a future architecture example, not an implemented feature: a future feed route calls the feed use case; that use case calls its injected feed repository port; the concrete repository adapter implements that port, calls its injected Supabase client, and maps the response to the domain contract. No domain, repository, client, or Supabase integration is implemented yet.

## Dependency injection and direction

- Inject the dependencies required by each layer; avoid implicit singletons, global service access, and service locators.
- The domain owns repository port declarations because the domain defines the needs of its use cases. Repository adapters implement those ports; the domain must not import repository implementations.
- Each port is declared by the layer that consumes it: repository ports belong to the domain, and client ports belong to the repository/adapters that call them. Concrete clients implement those client ports.
- At runtime, features using these layers should call domain use cases from entry points, which call injected repository ports; adapters call injected client ports. At source level, keep concrete implementations at the edges and wire them at an application composition root. The current application entry point is `src/index.ts`; do not infer that the future domain or adapter layers already exist.
- Keep contracts small and oriented around their consumers. Do not expose SDKs or vendor types across layers.
- Do not create dependencies in business rules. If a needed contract is undecided, record the open question rather than assuming a business rule.

## Testing

- Every production code file must have unit tests. Production code means code shipped or executed as part of the running application. The only production-code exception is a file named `index` that contains only re-exports.
- Require 100% statement, branch, function, and line coverage for production code. Do not exclude code to meet the target; only pure re-export barrels may be omitted.
- Test domain rules in isolation with injected repository doubles; test repositories with substituted clients; test clients with isolated external dependencies wherever practical.
- Include relevant success, failure, and boundary paths. Coverage does not replace behavioral assertions.
- Jest enforces 100% statement, branch, function, and line coverage for production code. Keep this threshold enabled in `jest.config.cjs`; do not weaken it or exclude production code to meet it.
- The current test runner is Jest with `ts-jest`, using the V8 coverage provider. Run `npm test -- --ci` for the CI test command; consult `package.json`, `jest.config.cjs`, and `.github/workflows/ci.yml` if commands or configuration change.
