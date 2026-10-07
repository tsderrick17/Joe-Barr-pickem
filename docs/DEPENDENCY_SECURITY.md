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

## Current reviewed exception

| Advisory | Scope | Exposure and decision | Owner | Review by |
| --- | --- | --- | --- | --- |
| `GHSA-vfj7-8cjw-p6xm` (`braces` stack exhaustion) | Development-only path through `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` | ESLint receives repository-controlled file patterns during CI; it is not shipped or passed player input. npm's proposed fix downgrades `eslint-config-next` across major versions and is incompatible with the current Next.js toolchain. Keep Dependabot enabled and remove this exception when the supported Next.js chain updates `braces`. | Repository owner | 2026-11-03 |

The review command is:

```text
npm audit --json
```

Record a new exception here before weakening a gate. Do not use a broad package
override merely to make an advisory disappear: verify that the parent package
supports the substituted version and that lint, build, tests, and the relevant
runtime paths still pass.
