## 2026-06-21 - Cache and Hoist Connector Operations

**Learning:** In the SailPoint Connector SDK architecture, processing entitlements and iterating through groups can result in N+1 API problems or redundant AST parsing due to nested loops. Here, calling `isc.getSource(sourceId)` repetitively and executing `stringToMembership` logic across identical source structures or role definitions caused performance overhead.
**Action:** Always cache simple lookups (like `sourceOwnerMap` for `ownerId`) and hoist complex parsing operations (like `stringToMembership`) outside of inner entity loops when their inputs (like role `assignmentDefinition`) are scoped to the parent iteration.

## 2024-06-22 - Cached Velocity Template Compilation

**Learning:** In loops processing thousands of items (like entitlements), parsing and compiling template strings (like `velocityjs`) on every iteration creates a significant bottleneck.
**Action:** Introduced a module-level `Map` cache to memoize the compiled velocity AST by template string, drastically reducing rendering overhead for repeated templates.
