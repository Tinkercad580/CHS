# 0001 — The API is defined once, in a shared contract package

**Status:** accepted, 2026-09-25

**Context.** Three clients (admin web, resident app, gate app) and one server
must agree on every path, payload and error. MASTER_SPEC E3 suggests
generating client types from OpenAPI; that adds a build step and still lets
the server drift from its own spec.

**Decision.** `packages/contract` declares each endpoint as data — method,
path, zod schemas, access rule, invalidation. The server binds handlers to
those objects and validates with the same schemas; clients derive typed calls
and React Query keys from them; OpenAPI is generated from them at runtime.
The server refuses to start with an unbound endpoint.

**Consequences.** One place to change an API. No codegen. The contract must
stay dependency-free (zod only) and compatible with every consumer's compiler
settings (`erasableSyntaxOnly`, `verbatimModuleSyntax`). Output parsing costs
a little CPU per response and buys a guarantee that no undeclared field leaves
the server.
