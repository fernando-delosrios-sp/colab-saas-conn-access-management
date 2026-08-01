## 2025-02-28 - [Sensitive Data Exposure in Error Logs]

**Vulnerability:** Axios errors thrown from catch blocks were being directly logged using `logger.error(error)` or thrown directly into strings. Because Axios errors serialize the entire HTTP request and response configuration, this leaks sensitive information like headers (e.g. `Authorization` containing Personal Access Tokens) into public/internal logs.
**Learning:** Connectors using Axios or similar HTTP libraries risk inadvertently dumping highly sensitive credentials into logs when exceptions occur.
**Prevention:** Always use a helper utility (e.g., `getErrorMessage`) to safely extract and log only the descriptive `message` string instead of logging the whole error object.

## 2025-02-28 - [Filter Injection in API Queries]

**Vulnerability:** User-controlled input (`name`) was being interpolated directly into query filters (e.g. `name eq "${name}"`) without escaping in `src/isc-client.ts`. An attacker could inject unescaped double quotes to break out of the string literal and inject malicious filter conditions.
**Learning:** Directly interpolating unescaped user strings into query structures or API filter parameters leads to injection vulnerabilities, allowing attackers to manipulate queries.
**Prevention:** Always escape user input (like double quotes `"` and backslashes `\`) before injecting it into string-based query filters. Create an escaping utility function (`escapeFilterString`) and apply it consistently.

## 2025-06-26 - Logged URLs in axios retry exposure fix

**Vulnerability:**
The `src/axios.ts` file logged the full `requestConfig.url` when an axios request failed and triggered a retry. This full URL could contain sensitive query parameters (such as access tokens, secrets, or PII) which would be exposed in plain text in the connector logs.

**Learning:**
Logging request URLs during failure cases without redacting query strings can lead to credential or data leaks. It's crucial to always strip or mask query parameters when logging URLs.

**Prevention:**
Parse or split the URL and only log the base URL path (e.g., `url?.split('?')[0]`).

## 2024-06-26 - Server-Side Template Injection via Velocity Templates

**Vulnerability:**
The `buildName` utility in `src/utils/index.ts` parsed and evaluated user-controlled template strings via `velocityjs` without sandboxing or restriction. This allowed for Server-Side Template Injection (SSTI), leading to arbitrary code execution (RCE) via `process.env` traversal, typically exploited using `$object.constructor.constructor("return process.env")()`.

**Learning:**
`velocityjs` templates, like many template engines running on NodeJS, allow accessing the prototype chain of objects passed in the rendering context. If these objects aren't strictly filtered or the AST isn't constrained, attackers can access the `Function` constructor and execute arbitrary javascript code on the server.

**Prevention:**
Always strictly validate or sandbox template execution contexts. In `velocityjs`, a robust mitigation is to parse the template into an Abstract Syntax Tree (AST) first and traverse it to block any access to `property` or `method` names corresponding to `constructor` before compilation and execution.

## 2025-02-28 - [Insecure Transmission of Credentials]

**Vulnerability:** The API credentials (`clientId`, `clientSecret`) were allowed to be transmitted over unencrypted `http://` connections if the user misconfigured `config.baseurl`. This exposes credentials in plain text over the network.
**Learning:** It is crucial to validate user-provided base URLs to enforce `https://` for external endpoints to ensure data in transit is encrypted.
**Prevention:** In the `ISCClient` constructor, validate that `config.baseurl` starts with `https://` (while allowing `http://localhost` and `http://127.0.0.1` for local development) before making API requests. Also validate the presence of authentication credentials.

## 2026-06-28 - [SSRF & Insecure Credential Transmission via Weak URL Validation]

**Vulnerability:** The application was validating if `config.baseurl` used HTTPS by simply checking if the string started with `https://`, `http://localhost`, or `http://127.0.0.1`.
**Learning:** Checking string prefixes for URL validation is easily bypassed. An attacker can supply a domain like `http://localhost.attacker.com` which matches the prefix check (`.startsWith('http://localhost')`), allowing unencrypted transmission of credentials and potentially creating a Server-Side Request Forgery (SSRF) vulnerability.
**Prevention:** Always use proper URL parsing (e.g., `new URL(config.baseurl)`) to validate URL structure and parts (like `protocol` and `hostname`) rather than relying on substring string manipulation.

## 2025-07-01 - Prevent Unencrypted Transmission of Credentials

**Vulnerability:** The application previously permitted insecure communication via `http://localhost` and `http://127.0.0.1` exceptions when validating the `baseurl` in `ISCClient`. While seemingly benign for local development, allowing unencrypted HTTP transmission can expose sensitive configuration parameters, like `clientId` and `clientSecret`, during potentially misconfigured or unauthorized local connections, presenting a security risk.

**Learning:** Exceptions in security enforcement policies, such as allowing HTTP for local environments, often become vulnerabilities or can be bypassed if the environment behaves unexpectedly or in cases of configuration drift. We must strictly enforce HTTPS for all secure communication layers without exception in production-ready services.

**Prevention:** We have completely removed the HTTP exceptions from the `baseurl` validation logic. The URL scheme is now exclusively required to be `https:`. The URL validation tests were also updated to verify this rule.

## 2025-02-28 - [Resource Exhaustion Risk in External API Calls]

**Vulnerability:** External API calls were being made via `sailpoint-api-client` (which uses `axios` underneath) without an explicit timeout configured in `baseOptions`. Hanging requests from a sluggish or unresponsive downstream API could cause the Node.js application to block workers, consume all available memory and connections, leading to a Denial of Service (DoS).
**Learning:** Default HTTP client configurations often have no timeout (or a very long one). It's crucial to explicitly define timeouts on API configurations to ensure the application fails fast and releases resources during network or third-party service degradation.
**Prevention:** Always inject a sane timeout (e.g., 30000ms) into `this.config.baseOptions` when initializing external API clients. Make sure to preserve existing `baseOptions` using spread syntax.

## 2025-02-28 - [DoS via Socket Exhaustion in Concurrent Loops]

**Vulnerability:** The application was using unbounded `Promise.all` arrays to perform dozens or hundreds of concurrent API requests (e.g. `isc.getAccessProfileByName`). This causes sudden spikes in network traffic, exhausting available sockets and leading to DoS conditions, timeouts, and API rate limits (HTTP 429).
**Learning:** Sending unbounded concurrent requests to external APIs using `Promise.all` directly is a severe denial of service and stability risk when processing large arrays of configuration entities.
**Prevention:** Introduce and enforce a concurrency limiter (like the `processConcurrent` utility) to batch operations into manageable chunks, limiting the maximum simultaneous connections to the API.

## 2024-05-24 - [Velocity Template Sandbox Escape Mitigation]

**Vulnerability:** The existing `hasConstructor` validation for Velocity templates in `src/utils/index.ts` only blocked access to the `constructor` property when referenced as an identifier. It failed to prevent access to `__proto__` and also missed index-based accesses (e.g., `['constructor']` or `['__proto__']`). This could allow Sandbox Escapes or Prototype Pollution in `velocityjs`.
**Learning:** AST-based validation for template engines must explicitly check for property access through index notation (strings in brackets) as well as direct identifiers. Checking only `.constructor` is insufficient because an attacker can easily bypass it with `['constructor']`.
**Prevention:** The validation logic must recursively inspect AST nodes to explicitly block `__proto__` and ensure that `index` nodes with string values are checked for banned properties alongside standard `property` and `method` nodes.

## 2025-02-28 - [Server-Side Template Injection via Velocity Templates (Update)]

**Vulnerability:** The existing `hasConstructor` validation for Velocity templates in `src/utils/index.ts` only blocked access to the `constructor` and `__proto__` properties. It failed to prevent access to the `prototype` property, and it also allowed executing arbitrary macros like `#evaluate()`. This could allow Sandbox Escapes or Prototype Pollution in `velocityjs` to achieve Server-Side Template Injection (SSTI).
**Learning:** AST-based validation for template engines must explicitly check for the `prototype` property and execution of macros (like `#evaluate()`) because attackers can use these paths to bypass basic sandbox checks and execute dynamic code.
**Prevention:** The validation logic in `isUnsafeVelocityAST` must be updated to explicitly check for the `prototype` string inside identifiers and index properties. Furthermore, we must check for nodes of type `macro_call` where the identifier is `evaluate`.

## 2025-02-28 - [Server-Side Template Injection via Dynamic Velocity String Concatenation]

**Vulnerability:** Attackers could bypass static literal AST checks for prototype pollution (SSTI/RCE) in `velocityjs` templates by dynamically concatenating strings within `#set` directives (e.g., `#set($c = "con" + "structor")`) and then using the constructed variable for property access (e.g., `$foo[$c]`).
**Learning:** Checking explicit string literal identifiers in AST properties or indices is insufficient. The AST validation logic must recursively traverse `math` nodes within variable assignments to evaluate statically concatenated strings for blocked properties (like `constructor`, `__proto__`, `prototype`, `process`, etc.).
**Prevention:** Always include logic to evaluate complex `math` and `string` nodes statically when inspecting template Abstract Syntax Trees (ASTs) for Server-Side Template Injection vectors.

## 2025-02-28 - [Avoiding False Positives in Velocity AST Sandboxing]

**Vulnerability:** Implementing overly aggressive AST node validation globally inside Velocity engines (e.g. blocking the string literal "constructor" unconditionally) breaks legitimate templating functions and strings like `#set($role = "constructor")` causing unintended application downtime.
**Learning:** AST validation for template sandboxes must be context-aware. Banned strings should only be restricted in sensitive evaluation contexts (such as `index` node references) where prototype pollution or SSTI could occur, rather than globally across all nodes.
**Prevention:** Keep track of defined variables in `#set` directives that evaluate to potentially dangerous literal strings. Verify that those specific variables (and directly dangerous string literals) are only blocked when actually used to index or access properties on other objects.
