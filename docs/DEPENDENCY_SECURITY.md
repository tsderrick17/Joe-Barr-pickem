# Dependency security policy

Production dependencies fail the application gate for any high or critical
advisory. The complete dependency tree, including build and test tooling, fails
for critical advisories. Dependabot keeps lower-severity and development-only
findings visible between pull requests.

An exception must name the advisory, affected dependency path, exposure,
reason an upgrade or override is unsafe, owner, and next review date. Exceptions
never apply to a production dependency or to code that processes untrusted
runtime input. Remove an exception as soon as the supported dependency chain
contains a fix.

## Current reviewed exceptions

None. (2026-10-26: the `braces` advisory GHSA-vfj7-8cjw-p6xm no longer appears in `npm audit`, and the development-only `zod` advisory GHSA-mrhx-c7xc-m3w5, reached through `eslint-config-next` → `eslint-plugin-react-hooks`, was fixed by `npm audit fix` within the same major version. `npm audit` reports 0 vulnerabilities.)

An exception, when one is needed, is a row in this table; `test/security-headers.test.mjs` fails once its review date has passed.

| Advisory | Scope | Exposure and decision | Owner | Review by |
| --- | --- | --- | --- | --- |

The review command is:

```text
npm audit --json
```

Record a new exception here before weakening a gate. Do not use a broad package
override merely to make an advisory disappear: verify that the parent package
supports the substituted version and that lint, build, tests, and the relevant
runtime paths still pass.
