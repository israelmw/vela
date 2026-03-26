# Contributing to Vela

Thanks for helping improve Vela. This document is the single entry point for contributors.

## Principles

- **README as contract:** Large behavior or schema changes should stay aligned with [README.md](./README.md).
- **Vertical slices:** Prefer end-to-end slices (channel → control plane → runtime) over dead code in packages.
- **Vercel-first:** Target Fluid Compute, Neon, Blob, and AI Gateway patterns documented in the README.

## Development setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev   # runs turbo dev; web app lives in apps/web
```

Copy `.env.example` to `.env.local` and fill `DATABASE_URL` (and optional Blob / Slack / OIDC vars). Run migrations from `@vela/db` when the schema changes.

## Repository layout

| Path | Role |
|------|------|
| `apps/web` | Next.js app — API routes, admin UI |
| `packages/control-plane` | Threads, sessions, runs, messages |
| `packages/agent-runtime` | Agent turn / resume |
| `packages/tool-router` | Builtin dispatch + policy-wrapped execution |
| `packages/policy-engine` | `canUseTool` |
| `packages/skill-resolver` | Skill attachment |
| `packages/db` | Drizzle schema, migrations, dev seed |
| `packages/channels` | Slack verification / adapters |
| `packages/workflow`, `packages/sandbox` | Durable / isolation stubs — evolve with care |

## Pull requests

- **One concern per PR** when possible (e.g. policy fix separate from UI polish).
- Update or add tests under `packages/**/*.test.ts` (Vitest).
- Run `pnpm typecheck` and `pnpm test` before pushing.

## Issue labels (for maintainers)

Suggested GitHub labels:

- `good-first-issue` — small, well-scoped
- `area/control-plane` / `area/runtime` / `area/channels` / `area/policy` / `area/db`
- `kind/bug` / `kind/feature` / `kind/docs`

## Code of conduct

All participants must follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree your contributions are licensed under the same terms as the project ([MIT](./LICENSE)).
