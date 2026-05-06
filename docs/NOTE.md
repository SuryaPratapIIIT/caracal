# Architecture Rewrite Notice

We undertook a major rewrite after [`v2026.04.25`](https://github.com/Garudex-Labs/caracal/releases/tag/v2026.04.25).

All commits made after this release are part of the following migration:

> **Rewrite: Introduce new architecture and migrate core system to Go & TypeScript**

This rewrite transitions the core platform from Python to Go and TypeScript, with significant improvements in:

- Performance
- Scalability
- Maintainability
- System architecture and developer experience

As this is a large-scale architectural migration, some areas of the codebase are still being actively rewritten, stabilized, and hardened for production use.

```
!! IMPORTANT !!

> The directory where this `NOTE.md` exists are not yet fully updated as part of the rewrite and are still under active implementation and migration.
> Most of the new architecture and core functionality has already been implemented, while remaining areas and edge cases are continuously being covered and improved.
```

During this transition phase, you may encounter:

- Incomplete implementations
- Breaking changes
- Temporary inconsistencies
- Missing edge-case handling
- Ongoing refactors

Please bear with us while we continue improving and stabilizing the platform.

If you prefer the previous stable implementation, the older codebase has been preserved in the `legacy` branch.