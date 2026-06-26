## 2025-02-28 - [Sensitive Data Exposure in Error Logs]

**Vulnerability:** Axios errors thrown from catch blocks were being directly logged using `logger.error(error)` or thrown directly into strings. Because Axios errors serialize the entire HTTP request and response configuration, this leaks sensitive information like headers (e.g. `Authorization` containing Personal Access Tokens) into public/internal logs.
**Learning:** Connectors using Axios or similar HTTP libraries risk inadvertently dumping highly sensitive credentials into logs when exceptions occur.
**Prevention:** Always use a helper utility (e.g., `getErrorMessage`) to safely extract and log only the descriptive `message` string instead of logging the whole error object.

## 2025-02-28 - [Filter Injection in API Queries]

**Vulnerability:** User-controlled input (`name`) was being interpolated directly into query filters (e.g. `name eq "${name}"`) without escaping in `src/isc-client.ts`. An attacker could inject unescaped double quotes to break out of the string literal and inject malicious filter conditions.
**Learning:** Directly interpolating unescaped user strings into query structures or API filter parameters leads to injection vulnerabilities, allowing attackers to manipulate queries.
**Prevention:** Always escape user input (like double quotes `"` and backslashes `\`) before injecting it into string-based query filters. Create an escaping utility function (`escapeFilterString`) and apply it consistently.

## 2024-06-26 - Server-Side Template Injection via Velocity Templates

**Vulnerability:**
The `buildName` utility in `src/utils/index.ts` parsed and evaluated user-controlled template strings via `velocityjs` without sandboxing or restriction. This allowed for Server-Side Template Injection (SSTI), leading to arbitrary code execution (RCE) via `process.env` traversal, typically exploited using `$object.constructor.constructor("return process.env")()`.

**Learning:**
`velocityjs` templates, like many template engines running on NodeJS, allow accessing the prototype chain of objects passed in the rendering context. If these objects aren't strictly filtered or the AST isn't constrained, attackers can access the `Function` constructor and execute arbitrary javascript code on the server.

**Prevention:**
Always strictly validate or sandbox template execution contexts. In `velocityjs`, a robust mitigation is to parse the template into an Abstract Syntax Tree (AST) first and traverse it to block any access to `property` or `method` names corresponding to `constructor` before compilation and execution.
