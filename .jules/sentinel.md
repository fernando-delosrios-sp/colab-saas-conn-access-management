## 2025-02-28 - [Sensitive Data Exposure in Error Logs]
**Vulnerability:** Axios errors thrown from catch blocks were being directly logged using `logger.error(error)` or thrown directly into strings. Because Axios errors serialize the entire HTTP request and response configuration, this leaks sensitive information like headers (e.g. `Authorization` containing Personal Access Tokens) into public/internal logs.
**Learning:** Connectors using Axios or similar HTTP libraries risk inadvertently dumping highly sensitive credentials into logs when exceptions occur.
**Prevention:** Always use a helper utility (e.g., `getErrorMessage`) to safely extract and log only the descriptive `message` string instead of logging the whole error object.
