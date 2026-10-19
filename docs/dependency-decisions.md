# Dependency decision ledger

This ledger records intentional dependency or version choices that deviate from
normal upstream resolution or established project policy. Keep each decision
next to the manifest and lockfile change that implements it.

Routine lockfile updates within declared version ranges do not need a separate
entry. See the [dependency decisions instruction](../.github/instructions/dependency-decisions.instructions.md)
for the recording requirements.

## Active decisions

### DD-001: Override `argparse` in Jest's legacy YAML dependency chain

- **Status:** Active
- **Recorded:** 2026-10-19
- **Scope:** The npm override for `argparse` under `js-yaml@3.15.2` in
  `package.json`.
- **Selected dependency:** `argparse@2.0.1`, replacing the vulnerable
  `argparse@1.0.10` resolved by `js-yaml@3.15.2` (which declared
  `argparse@^1.0.7`).
- **Dependency path:** `ts-jest` → `@jest/transform` → `babel-plugin-istanbul`
  → `@istanbuljs/load-nyc-config` → `js-yaml@3.15.2` → `argparse` →
  `sprintf-js@1.0.3`.
- **Reason:** npm reported the moderate-severity
  [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c):
  `sprintf-js` is vulnerable to denial of service through unbounded precision
  specifiers. Retaining the existing Jest and `ts-jest` versions avoids an
  unnecessary test-runner downgrade while removing the vulnerable package from
  the resolved tree.
- **Alternatives and compatibility:** npm's automated fix proposed a major
  downgrade of `ts-jest`, incompatible with the Jest 30 setup. `argparse@2.0.1`
  is outside the `^1.0.7` range declared by this legacy `js-yaml` release, so
  the override deliberately substitutes a major dependency version. This is
  limited to `js-yaml@3.15.2`; the `argparse` CLI remains compatible with the
  YAML package's usage.
- **Validation:** A clean `npm ci` succeeded; `npm audit
  --audit-level=moderate` reported zero vulnerabilities; `npm run check`
  passed with 100% statement, branch, function, and line coverage; the
  installed `js-yaml` CLI help command ran successfully.
- **Revisit/remove when:** Remove the override when upstream Jest/coverage
  dependencies no longer resolve the affected legacy chain, or when a
  compatible upstream release replaces the vulnerable `sprintf-js` path.
  Confirm with a clean install, `npm audit --audit-level=moderate`, and the
  project checks before removal.
