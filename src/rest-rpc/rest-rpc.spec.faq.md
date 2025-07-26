# Frequently Asked Questions

**Q: Why not use GraphQL instead?**

A: While I appreciate GraphQL's power, I found it introduces too much learning curve for  frontend teams who are already productive with REST patterns. GraphQL requires learning query syntax, new tooling, different error handling, and complex caching strategies. My REST-RPC approach lets teams keep using familiar request calls while still getting more productive less headache endpoints and put more of their time on business logic than stretching with new tooling. Sometimes the path of least resistance is the right path.

**Q: Why not use tRPC for type safety?**

A: I actually love tRPC's type safety, but it forces you into a monorepo or complex type-sharing setup. Since I work with separate frontend/backend sometimes repositories (which is pretty common than mono repos), tRPC's main benefits disappear while adding infrastructure complexity. I wanted the type safety without the coupling, which is why I'm planning client magic using the spec schemas part - think tRPC-like inference without the monorepo requirement, we can use the schemas sent over the wire to generate some frontend type inferences and still get good stuff.

**Q: Why not stick to pure REST principles?**

A: I tried, but enterprise business logic just doesn't fit cleanly into HTTP verbs. When I have operations like `calculateShipping`, `processPayment`, or `generateReport`, forcing these into PUT/POST feels artificial. I'd rather be explicit about what the operation does than pretend it's a resource update. Business clarity trumps HTTP purity for internal and complex systems.

**Q: Doesn't this violate HTTP semantics by using POST for everything?**

A: Absolutely, and I'm okay with that trade-off. I prioritize business clarity and consistent patterns over semantic correctness. For internal enterprise APIs where I control both ends, the benefits of explicit actions outweigh the loss of HTTP-level caching. I can always add caching at the application layer where it makes more sense anyways and still though it has to be explicit, there ways to force caching for post requests still client side.


**Q: How does this compare to JSON-RPC or other RPC standards?**

A: I borrowed from RPC concepts but kept REST-like discoverability because I wanted the best of both worlds:

| Feature       | JSON-RPC        | My REST-RPC                         | Traditional REST         |
| ------------- | --------------- | ----------------------------------- | ------------------------ |
| Discovery     | External docs   | Built-in `/services` endpoints      | HATEOAS (rarely works)   |
| HTTP Methods  | POST only       | GET for discovery, POST for actions | Full HTTP verb semantics |
| URL Structure | Single endpoint | Service-based endpoints             | Resource-based endpoints |
| Validation    | Manual          | Auto-generated and builtin schemas  | Manual or OpenAPI        |

**Q: What about OpenAPI/Swagger compatibility?**

A: I'm planning to add Swagger support in future versions, but honestly, I don't think it's as critical here. My `/services/schema` endpoint already provides machine-readable API docs, and since everything follows the same action pattern, there's less need for detailed endpoint documentation. When I do add Swagger, it'll focus on service/action details rather than trying to map everything to traditional REST patterns.

**Q: How do you handle caching without proper HTTP verbs?**

A: For enterprise internal APIs, I rely on application-level caching strategies - Redis, database query optimization, service-level caching. HTTP-level caching is often overrated for complex business logic anyway. Most enterprise operations involve multiple data sources and complex calculations that don't cache well at the HTTP layer.

**Q: Is this approach RESTful?**

A: Nope, not in the strict sense, and I'm not pretending it is. I violate the uniform interface constraint by not using HTTP verbs semantically. I call it "REST-RPC" because it borrows REST's discoverability while using RPC's explicit operations. It's a hybrid that works for my use cases, not a pure implementation of either.

**Q: How do you handle idempotency without PUT/DELETE?**

A: I handle idempotency at the application level using the `resourceId` + `action` combination for deduplication, idempotency keys in payloads when needed, and database constraints. It's actually cleaner than trying to force business operations into HTTP verb semantics that don't quite fit.

**Q: What about performance and scalability?**

A: For internal enterprise APIs, I've found that business logic is usually the bottleneck, not HTTP routing. Single endpoints per service actually simplify load balancing, and I can scale services independently. The auto-generation features optimize for development speed over performance for basic crud, which is the right trade-off for most enterprise scenarios.

**Q: How do you version this API?**

A: I use multiple strategies:

- URL versioning for major changes: `/api/v1/services/users` → `/api/v2/services/users`
- Action evolution: Add new actions, deprecate old ones gradually
- Payload evolution: Add optional fields, maintain backward compatibility
- Service splitting: Break large services into focused ones

The action-based approach actually makes versioning easier since I can add new actions without breaking existing ones.

**Q: What about testing and mocking?**

A: The consistent request/response format actually makes testing simpler. One POST endpoint per service reduces mock complexity, standardized responses enable generic error handling, and action-based testing makes business logic cleaner to test. I can mock entire services with a single endpoint handler.

**Q: You mentioned client magic - what's that about?**

A: I'm working on client libraries that use the Zod schemas from `/services/schema` to provide tRPC-like type inference without monorepo coupling. Imagine getting full TypeScript autocomplete and validation on your frontend just by pointing to the schema endpoint - and some codegen magic, It's like having your cake and eating it too.

**Q: What about action effects and scheduling?**

A: I'm planning to add action effects (like triggering other actions after completion) and action scheduling (cron-like scheduling for actions). The action-based architecture makes these features natural extensions. Think of it as building a workflow engine on top of the service layer.

**Q: Any plans for real-time features?**

A: I'm considering WebSocket support for action subscriptions - imagine subscribing to action results or getting real-time updates when certain actions complete. The service/action model maps well to event-driven architectures.

**Q: Is this becoming a full framework?**

A: Absolutely! I'm working on turning this into a complete framework that teams can adopt without having to rebuild everything from scratch. The goal is to package all the patterns, tooling, and best practices I've developed into something that maintains the same quality and developer experience regardless of who implements it.

The framework will include:

- **CLI tools** for scaffolding new services and actions
- **Code generators** for common patterns (CRUD, auth, validation)
- **Client libraries** for multiple languages (TypeScript, Python, Go, Rust, etc)
- **Development tools** like service explorers and testing utilities
- **Deployment templates** for common platforms (Docker, Kubernetes, serverless)
- **Monitoring and observability** built-in from day one

And right now still only used internally but Nile Squad already has fullstack framework called Nile already implementing these ideas.

**Q: How will you ensure quality doesn't degrade as it becomes a framework?**

A: I'm taking a few approaches to maintain quality:

1. **Battle-tested patterns**: Everything in the framework comes from real production usage, not theoretical ideals
2. **Comprehensive testing**: The framework will have extensive test suites and real-world validation
3. **Gradual rollout**: I'm starting with internal teams before open-sourcing, so I can catch issues early
4. **Strong defaults**: The framework will be opinionated about the right way to do things, reducing the chance for quality degradation
5. **Continuous dogfooding**: I'll keep using it for my own projects, so I'll feel the pain if quality drops

**Q: When will this framework be available?**

A: I'm targeting for internal use for now, with an open-source release following once I've validated it across multiple projects. I want to make sure it's genuinely useful and not just another "framework of the week."

The plan is to start with the core service/action patterns, then gradually add the client magic, scheduling, and advanced features. I'd rather ship something solid and simple than something complex and buggy. And no pressure here anyone can implement this architecture on their own in any language.

**Q: When should I NOT use this approach?**

A: Don't use this if you're building public APIs where REST conventions are expected, simple CRUD apps where REST mapping is natural, or performance-critical apps requiring HTTP caching. Also skip it if your team is already happy with GraphQL or if you're working across organizational boundaries where standards matter more than productivity.

**Q: What's the migration path from existing REST APIs?**

A: I recommend gradual migration:

1. Start new services with REST-RPC
2. Create adapter services wrapping existing REST endpoints
3. Migrate high-change services first
4. Keep stable CRUD services as-is
5. Use an API gateway for unified interface

**Q: How do you train teams on this approach?**

A: I tell them "it's just POST with a standard body format" and focus on thinking in business actions rather than HTTP verbs. The learning curve is minimal since it builds on familiar HTTP concepts. Most developers get it within a day because they're already thinking in terms of functions and operations anyway.

The key is showing them the `/services` endpoints for discovery and emphasizing the consistent error handling. Once they see how much boilerplate disappears, they're usually sold.

**Q: What if I want to contribute to the framework development?**

A: I'm always open to feedback and contributions! Right now I'm in the design and validation phase, so input on patterns, use cases, and pain points is incredibly valuable. Reason why I open-sourced it, I'll need help with a few things, client libraries for different languages, integrations with various databases and platforms, and real-world testing across different types of projects and so on.

The best way to contribute right now is to try the patterns in your own projects and share what works (and what doesn't). That real-world feedback is what will make this framework genuinely useful rather than just another mental exercise.

## Final Notes

This is still an experimental architecture, only tested with implementation of hono js, drizzle orm, bun js, and postgres + sqlite. There may be variations in implementation depending on the framework and database used. Also Typescript and Zod for validation is strongly recommended or any other that can satisfy similar qualities of those two.
