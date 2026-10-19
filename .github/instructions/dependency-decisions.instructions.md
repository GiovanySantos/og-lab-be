---
description: "Use when adding, updating, removing, or reviewing dependencies, package versions, lockfiles, npm overrides, resolutions, patches, forks, or other dependency substitutions. Requires recording non-standard dependency decisions."
applyTo:
  - "**/package.json"
  - "**/package-lock.json"
  - "**/npm-shrinkwrap.json"
  - "**/pnpm-lock.yaml"
  - "**/yarn.lock"
  - "**/patches/**"
  - "**/.yarn/patches/**"
---

# Dependency decision records

- Read the [dependency decision ledger](../../docs/dependency-decisions.md) before changing dependency declarations or resolution rules.
- Apply the project-wide guidance consistency review in [AGENTS.md](../../AGENTS.md#customization-and-architecture-consistency) for every dependency change; check all architecture instructions, skills, and custom agents against the resulting manifests, lockfile, and quality-gate scripts.
- Record every intentional dependency choice that deviates from the repository's established versions or normal upstream resolution in that ledger in the same change. This includes overrides, resolutions, patches, forks, security substitutions, exceptional pins, and unsupported or prerelease versions.
- Make one explicit record for every override, resolution, patch, or fork. Do not rely on a lockfile, a manifest comment, a pull request description, or this instruction as the decision record.
- Each record must state the affected package and selected version/range; the dependency path or scope; the reason and relevant advisory/source link; rejected alternatives and compatibility impact; validation performed; and the condition for revisiting or removing the exception.
- Update an existing record when a decision changes or is removed. Mark superseded decisions clearly instead of silently deleting their history.
- Routine lockfile refreshes that resolve versions within existing manifest ranges and established policy do not require new records. If a lockfile change introduces a deliberate non-standard selection, record it.
- If the reason or compatibility evidence for an existing or proposed exception is unclear, inspect package metadata and test compatibility; ask the user before inventing a rationale.
- Keep the ledger and dependency change together, and verify the lockfile is reproducible with a clean install and the project's relevant checks.
