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
