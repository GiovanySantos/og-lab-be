---
description: "Use when implementing, reviewing, or making architecture decisions for the OG Lab backend. Defines layer boundaries, ports, dependency injection, external services, caching, and testing expectations."
applyTo: "**/*.ts"
---

# Software architecture instructions

These instructions define the architectural direction for the OG Lab social network backend. Follow them when proposing, creating, changing, or reviewing code and architecture documentation. The initial application and toolchain are implemented; distinguish implemented components from planned capabilities.

## Language, goals, and technologies

- English is the project's default language. Use it for source code, tests, comments, documentation, agent communication, and engineering artifacts unless explicitly requested otherwise or required by an external interface.
- The project is a Node.js monolithic backend written in TypeScript. Its initial implementation uses Node.js 24+, TypeScript 6, Express 5, Jest 30 with ts-jest 29, ESLint 10, and npm. The application is under `src/`; colocate unit tests in `__tests__` directories within the source path they cover. Consult `package.json` and the TypeScript/Jest/ESLint configuration for the exact supported versions, layout, and commands; update this instruction if those decisions change.
- ESLint requires explicit type annotations on TypeScript variable declarations and destructured parameters, including test files. Keep annotations specific and do not weaken the rule to allow inferred declarations.
- Supabase is the first external service. Keep its integration replaceable and allow new external providers without leaking vendor details into business rules.
- Database schema changes are versioned as SQL files under `supabase/migrations/` and applied with the project-local Supabase CLI. Do not run migrations during application startup; use explicit local or remote npm scripts and an explicit project ref for remote operations.
- Caching is a future capability. Do not add Redis, in-memory cache components, or cache wiring unless a task explicitly requires implementing that capability. Before implementing it, get an explicit decision on the applicable policy and record unresolved decisions; never invent cache precedence, TTLs, invalidation, or strategy. If introduced, keep cache implementations replaceable and out of direct domain dependencies.
- Express is the selected HTTP framework. Jest with ts-jest and V8 coverage is the selected unit test and coverage tool. TypeScript's compiler is the build tool; npm scripts define the supported build and quality commands. No DI library has been selected: inject dependencies explicitly and compose concrete dependencies at the application entry point without introducing a container unless separately decided.
- GitHub Actions CI/CD is currently disabled. The local quality gate is `npm run pipeline`; run it before pushing changes or opening/updating a pull request. Consult `docs/ci-cd.md` for its contents and deployment status.

## Layers and responsibilities

The intended runtime call flow for features that use domain and data-access layers proceeds from application entry points toward external services:

`routes/entry points → domain → repositories → clients/adapters → external services`

1. **Routes/entry points:** receive and validate transport input, call the appropriate domain use case, and translate its result into a transport response. They do not implement business rules or access repositories or clients directly. `src/app.ts` exposes `/health` and mounts the authentication and user-profile routes from `src/routes/user-routes.ts`.
2. **Domain:** implements business rules and use cases. `src/domain/users.ts` owns user registration, login, self-service profile management, password changes, account deletion, and the ports it consumes for persistence, password hashing, tokens, and images. The domain receives implementations through injection and does not know vendor protocols, SDKs, or vendor-specific models.
3. **Repositories:** implement the domain's repository ports. `SupabaseUserRepository` maps user records to/from the Supabase REST contract and receives its `SupabaseRestClient` through injection.
4. **Clients/adapters:** encapsulate communication with external services and security libraries. `FetchSupabaseRestClient` handles Supabase REST requests; `AwsS3ObjectClient` and `R2ImageStorage` handle Cloudflare R2 objects through the S3-compatible API; `ThumborImageUrl` creates signed, optimized image URLs; and `security.ts` adapts Node.js scrypt and JWT operations. They contain no business rules.

The feed flow remains a future architecture example: a future feed route calls the feed use case; that use case calls its injected feed repository port; the concrete repository adapter implements that port, calls its injected Supabase client, and maps the response to the domain contract. The user/authentication flow is implemented as described above.

## Dependency injection and direction

- Inject the dependencies required by each layer; avoid implicit singletons, global service access, and service locators.
- The domain owns repository port declarations because the domain defines the needs of its use cases. Repository adapters implement those ports; the domain must not import repository implementations.
- Each port is declared by the layer that consumes it: repository ports belong to the domain, and client ports belong to the repository/adapters that call them. Concrete clients implement those client ports.
- At runtime, features should call domain use cases from entry points, which call injected repository ports; adapters call injected client ports. At source level, keep concrete implementations at the edges and wire them at the application composition root. `src/index.ts` is the composition root for the user/authentication flow; do not infer that the future feed domain or adapters already exist.
- Keep contracts small and oriented around their consumers. Do not expose SDKs or vendor types across layers.
- Do not create dependencies in business rules. If a needed contract is undecided, record the open question rather than assuming a business rule.

## Testing

- Every production code file must have unit tests. Production code means code shipped or executed as part of the running application. The only production-code exception is a file named `index` that contains only re-exports.
- Place tests under `__tests__` directories next to the source path they cover. For example, `src/__tests__/` contains tests for files directly under `src/`; tests for files under `src/domain/` belong under `src/domain/__tests__/`.
- Require 100% statement, branch, function, and line coverage for production code. Do not exclude code to meet the target; only pure re-export barrels may be omitted.
- Test domain rules in isolation with injected repository doubles; test repositories with substituted clients; test clients with isolated external dependencies wherever practical.
- Include relevant success, failure, and boundary paths. Coverage does not replace behavioral assertions.
- Jest enforces 100% statement, branch, function, and line coverage for production code. Keep this threshold enabled in `jest.config.cjs`; do not weaken it or exclude production code to meet it.
- The current test runner is Jest with `ts-jest`, using the V8 coverage provider. `npm run pipeline` runs the complete local quality gate; consult `package.json`, `jest.config.cjs`, and `docs/ci-cd.md` if commands or checks change.
