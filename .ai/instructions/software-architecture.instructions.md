# Software architecture instructions

These instructions define the initial architecture for the OG Lab social network backend. Follow them when creating, changing, or reviewing code and architecture documentation.

## Language, goals, and technologies

- English is the project's default language. Use it for source code, tests, comments, documentation, agent communication, and engineering artifacts unless explicitly requested otherwise or required by an external interface.
- The project is a Node.js monolithic backend written in TypeScript. Use the latest stable TypeScript version compatible with the selected dependencies and tools.
- Supabase is the first external service. Keep its integration replaceable and allow new external providers without leaking vendor details into business rules.
- The system will use in-memory caching and Redis. Treat them as replaceable implementations, not direct domain dependencies. Cache policy, precedence, TTLs, and invalidation strategy are undecided; do not invent these requirements.
- Do not assume an HTTP framework, DI library, test library, source directory layout, or build tool until the project selects one.

## Layers and responsibilities

The dependency flow starts at application entry points and proceeds inward:

`routes/entry points → domain → repositories → clients/adapters → external services`

1. **Routes/entry points:** receive and validate transport input, call the appropriate domain use case, and translate its result into a transport response. They do not implement business rules or access repositories or clients directly.
2. **Domain:** implements business rules and use cases. It receives required repositories through injection and does not know vendor protocols, SDKs, or vendor-specific models.
3. **Repositories:** adapt data-access and service contracts to business needs. They receive required clients through injection, convert external data into contracts used by the domain, and keep integration details out of it.
4. **Clients/adapters:** encapsulate communication with external services, such as Supabase REST, GraphQL, or database queries, and in-memory or Redis cache implementations. They contain no business rules.

Use the feed flow as an example: the feed route calls the feed domain/use case; that domain uses its injected feed repository; the repository calls its injected Supabase client and adapts the response to the contract expected by the domain.

## Dependency injection and direction

- Inject the dependencies required by each layer; avoid implicit singletons, global service access, and service locators.
- Entry points depend on the domain; the domain depends on repository contracts; repositories depend on client/adapter contracts. Concrete implementations stay at the edges.
- Construct and connect concrete implementations at an application composition root. Do not spread dependency creation through business rules.
- Keep contracts small and oriented around consumer use cases. Do not expose SDKs or vendor types across layers.
- If the location or contract of an abstraction is undecided, preserve the separation above and record the open question instead of assuming a business rule.

## Testing

- Every production code file must have unit tests; files named `index` that only re-export modules are excluded.
- The target is 100% statement, branch, function, and line coverage for production code included in coverage. Do not exclude code to meet the target; only pure re-export barrels may be omitted.
- Test domain rules in isolation with injected repository doubles; test repositories with substituted clients; test clients with isolated external dependencies wherever practical.
- Include relevant success, failure, and boundary paths. Coverage does not replace behavioral assertions.
- Before changing coverage configuration or adding tools, inspect the existing setup and preserve project conventions.
