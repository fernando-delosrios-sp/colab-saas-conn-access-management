## 2026-06-21 - Cache and Hoist Connector Operations

**Learning:** In the SailPoint Connector SDK architecture, processing entitlements and iterating through groups can result in N+1 API problems or redundant AST parsing due to nested loops. Here, calling `isc.getSource(sourceId)` repetitively and executing `stringToMembership` logic across identical source structures or role definitions caused performance overhead.
**Action:** Always cache simple lookups (like `sourceOwnerMap` for `ownerId`) and hoist complex parsing operations (like `stringToMembership`) outside of inner entity loops when their inputs (like role `assignmentDefinition`) are scoped to the parent iteration.

## 2024-06-22 - Cached Velocity Template Compilation

**Learning:** In loops processing thousands of items (like entitlements), parsing and compiling template strings (like `velocityjs`) on every iteration creates a significant bottleneck.
**Action:** Introduced a module-level `Map` cache to memoize the compiled velocity AST by template string, drastically reducing rendering overhead for repeated templates.

## 2026-06-26 - Concurrent Access Profile, Application, and Role Provisioning

**Learning:** When performing mass object creation or updates across external APIs in a `for...of` loop, awaiting each API call sequentially can cause significant performance bottlenecks due to network I/O blockages.
**Action:** Transformed sequential `for...of` loops into concurrent execution paths utilizing `Promise.all(Array.from(map.entries()).map(async ([key, val]) => {...}))`. This dramatically decreases execution time by parallelizing network operations while maintaining single-threaded safety for subsequent application-level state updates.

## 2026-06-24 - Batching API Lookups for Performance

**Learning:** Unbounded sequential API calls within loops (e.g. `getAccessProfileByName` or `getRoleByName` during entitlement mapping) cause significant N+1 blockages and slow down evaluation phases. However, when refactoring to `Promise.all` across arrays of unknown sizes, there's a risk of socket exhaustion or rate limits.
**Action:** Always prefer grouped concurrent batching (or at least executing over deduplicated maps) for lookup API requests to remove sequential wait times, but consider concurrency limits when API arrays could be large to avoid HTTP 429s or timeouts.

## 2024-06-23 - Scope Aggregation Maps Inside Iteration Loops

**Learning:** When aggregating nested data entities across an array of definitions (like assigning entitlements to roles or access profiles based on a configuration block), initializing the aggregation container (e.g. `entitlementMap`) outside the definition loop caused memory leaking and exponential redundant processing overhead in subsequent loop iterations.
**Action:** Always restrict the lexical scope of accumulator Maps/Sets to the tightest loop block containing the processing context. Re-initialize them inside the loop to avoid dragging prior state into the next configuration evaluation unless the state explicitly needs to cross iterations.

## 2024-06-27 - Pre-fetching Related Application and Source Entities

**Learning:** Within deep, nested iteration loops, doing on-the-fly network lookups for dependencies (such as getting application or source ownership data via API) creates immense N+1 bottlenecks.
**Action:** Before executing nested iteration loops for object processing, do a pre-pass to collect unique identifiers (like `sourceId` and `appName`). Batch fetch these dependencies concurrently via `Promise.all`, store them in memory maps, and then process the loop synchronously.

## 2026-06-28 - Optimize array equality checks

**Learning:** Array sorting (O(n log n)) for simple equality checks creates unnecessary performance overhead in loops. For deep equality on unordered lists, use O(n) frequency maps or Sets.
**Action:** Use Sets or frequency maps instead of array sorting for array equality comparisons.

## 2026-07-01 - Prevent N+1 API query bottlenecks in Entitlement Fetching

**Learning:** Sequential processing in loops of remote data fetches leads to N+1 API query bottlenecks which impact application performance. In this connector SDK context, fetching entitlements in a sequential manner per access profile definition resulted in poor throughput.
**Action:** Batched network requests by extracting unique queries into Sets and fetching them concurrently using a concurrency limiter utility (`processConcurrent`) with `Promise.all` before iteration begins.

## 2026-06-29 - Batching API Lookups with "in" filter

**Learning:** Unbounded sequential API calls within loops or even bounded concurrent single API requests using `name eq "xyz"` can hit rate limits or have a large network overhead when evaluating many items.
**Action:** Replace concurrent individual calls with batched queries using the `name in ("x", "y")` filter, chunking the list to avoid URL length constraints while drastically reducing network round trips.

## 2026-07-10 - Worker-pool Model for Batch I/O Operations

**Learning:** When using chunked `Promise.all` for concurrency (e.g. `processConcurrent`), the entire chunk must complete before the next chunk can start. This causes "head-of-line" blocking where one slow API request delays the processing of all other items in subsequent chunks, reducing network throughput.
**Action:** Utilize a worker-pool model instead. By spinning up a fixed number of workers that continuously pull from the queue, idle workers can immediately process new items as soon as they finish their current task, ensuring smoother and higher network I/O throughput.

## 2024-07-01 - Worker-pool pattern for batch API requests

**Learning:** Using a chunked `Promise.all` approach for concurrent operations can cause "head-of-line" blocking, where the entire chunk waits for the slowest request to complete before processing the next chunk.
**Action:** Replace chunked `Promise.all` loops with a worker-pool concurrency model. This allows idle workers to instantly pull and process the next item in the queue, eliminating idle waiting and increasing throughput for network I/O bound operations.

## $(date +%Y-%m-%d) - Pre-fetch entitlements for role definition queries concurrently

**Learning:** During role processing, iterating sequentially over role definitions and executing API queries inside the loop (`await isc.listEntitlements(definition.query)`) creates a massive N+1 query bottleneck, exacerbating network latency and slowing down execution.
**Action:** Always pre-fetch nested dependencies in batches using a concurrency limiter (like `processConcurrent`) before entering inner loops, caching the results in a Map or Set to replace network I/O with O(1) memory lookups.

## $(date +%Y-%m-%d) - Optimize JSON Patch payloads construction

**Learning:** Unconditionally adding unchanged fields into JSON Patch payloads (e.g. updating large arrays like `entitlements` or `accessProfiles`) greatly inflates the request body size, leading to slower network I/O and longer API response processing times on the remote server.
**Action:** When evaluating if an update is needed (e.g. after comparing existing objects to new data), conditionally append only the JSON Patch operations (`{op: 'replace' ...}`) for the fields that have explicitly changed.

## 2024-05-30 - [Batch API Calls Instead of Client-Side Filtering]
**Learning:** The fallback search methods for access profiles and roles (`searchAccessProfilesByNames`, `searchRolesByNames`) were paginating over the entire tenant's directory (fetching all records) and filtering client-side. This is O(N) over all tenant records, causing massive network overhead, rate limits, and memory spikes for large environments.
**Action:** Always utilize server-side filtering (e.g., the `in` operator) when looking up multiple specific items by name. Reused existing batched, concurrent lookup utilities (`getAccessProfilesByNames`, `getRolesByNames`) which fetch records in chunks of 30 using `name in ("x", "y")` to eliminate full tenant scans.
