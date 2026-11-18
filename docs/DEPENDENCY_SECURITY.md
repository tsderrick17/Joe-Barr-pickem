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

One, below. (2026-10-26: the `braces` advisory GHSA-vfj7-8cjw-p6xm no longer appears in `npm audit`, and the development-only `zod` advisory GHSA-mrhx-c7xc-m3w5, reached through `eslint-config-next` → `eslint-plugin-react-hooks`, was fixed by `npm audit fix` within the same major version.)

The high-severity gate runs `node scripts/audit-gate.mjs`, which is `npm audit` less exactly the advisories in this table.

An exception, when one is needed, is a row in this table; `test/security-headers.test.mjs` fails once its review date has passed.

| Advisory | Scope | Exposure and decision | Owner | Review by |
| --- | --- | --- | --- | --- |
| `GHSA-fc5q-39xc-vjpf` | `picomatch` <=4.0.7 (ReDoS on repeated extglobs), reached only through `@sentry/nextjs` → `@rollup/plugin-commonjs` / `@rollup/pluginutils` / `fdir` | Published 2026-11-17 with no fixed version. Build-time only: the patterns are fixed in our own build config and never come from a request, so no untrusted input reaches it. The only offered fix downgrades Sentry to 8.38 (a breaking major). Owner approved the exception on 2026-11-17, an explicit departure from the no-production-path rule above. 2026-11-18: still no fixed release (every picomatch version is affected, including 2.x under `eslint-config-next`); fixes are open upstream (micromatch/picomatch PRs #264-#274). Remove once picomatch ships a fix. | Commissioner | 2026-12-15 |

The review command is:

```text
npm audit --json
```

Record a new exception here before weakening a gate. Do not use a broad package
override merely to make an advisory disappear: verify that the parent package
supports the substituted version and that lint, build, tests, and the relevant
runtime paths still pass.
