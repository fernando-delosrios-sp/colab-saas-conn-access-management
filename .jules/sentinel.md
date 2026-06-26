## 2025-02-28 - [Sensitive Data Exposure in Error Logs]

**Vulnerability:** Axios errors thrown from catch blocks were being directly logged using `logger.error(error)` or thrown directly into strings. Because Axios errors serialize the entire HTTP request and response configuration, this leaks sensitive information like headers (e.g. `Authorization` containing Personal Access Tokens) into public/internal logs.
**Learning:** Connectors using Axios or similar HTTP libraries risk inadvertently dumping highly sensitive credentials into logs when exceptions occur.
**Prevention:** Always use a helper utility (e.g., `getErrorMessage`) to safely extract and log only the descriptive `message` string instead of logging the whole error object.

## 2025-02-28 - [Filter Injection in API Queries]

**Vulnerability:** User-controlled input (`name`) was being interpolated directly into query filters (e.g. `name eq "${name}"`) without escaping in `src/isc-client.ts`. An attacker could inject unescaped double quotes to break out of the string literal and inject malicious filter conditions.
**Learning:** Directly interpolating unescaped user strings into query structures or API filter parameters leads to injection vulnerabilities, allowing attackers to manipulate queries.
**Prevention:** Always escape user input (like double quotes `"` and backslashes `\`) before injecting it into string-based query filters. Create an escaping utility function (`escapeFilterString`) and apply it consistently.

## 2025-02-28 - [Insecure Transmission of Credentials]

**Vulnerability:** The API credentials (`clientId`, `clientSecret`) were allowed to be transmitted over unencrypted `http://` connections if the user misconfigured `config.baseurl`. This exposes credentials in plain text over the network.
**Learning:** It is crucial to validate user-provided base URLs to enforce `https://` for external endpoints to ensure data in transit is encrypted.
**Prevention:** In the `ISCClient` constructor, validate that `config.baseurl` starts with `https://` (while allowing `http://localhost` and `http://127.0.0.1` for local development) before making API requests. Also validate the presence of authentication credentials.
