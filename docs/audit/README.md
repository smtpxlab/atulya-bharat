# ABR — Technical Audit (Read-Only Handover)

Generated: 2026-06-15. Snapshot of the Atulya Bharat Run platform before the next milestone (dedicated Node.js backend + Admin CMS expansion).

This audit is **read-only**: no code, schema, RLS, edge function, or configuration was changed in its production. All findings cite file paths or DB objects; unverified items are marked `Not implemented`, `Not found`, or `Needs verification`.

## How to read

| # | Document | Audience |
|---|---|---|
| 00 | [Executive Summary](./00-executive-summary.md) | Founders / PM |
| 01 | [Architecture Overview](./01-architecture.md) (Mermaid diagrams) | Tech lead |
| 02 | [Folder Structure](./02-folder-structure.md) | New engineers |
| 03 | [Frontend Audit](./03-frontend.md) | Frontend team |
| 04 | [Service Layer Audit](./04-service-layer.md) | Frontend team |
| 05 | [Database Audit](./05-database.md) | Backend / data |
| 06 | [RBAC & Security](./06-rbac-security.md) | Security |
| 07 | [Edge Functions](./07-edge-functions.md) | Backend |
| 08 | [Storage](./08-storage.md) | Backend |
| 09 | [SEO](./09-seo.md) | Marketing |
| 10 | [Performance](./10-performance.md) | Tech lead |
| 11 | [Monitoring & Error Handling](./11-monitoring.md) | Tech lead |
| 12 | [Environment Variables](./12-env-variables.md) | DevOps |
| 13 | [Admin Readiness](./13-admin-readiness.md) | PM |
| 14 | [Node.js Backend Readiness](./14-node-backend-readiness.md) | Architect |
| 15 | [Tech Debt Register](./15-tech-debt-register.md) | Tech lead |
| 16 | [Roadmap (30/60/90)](./16-roadmap.md) | Founders / PM |

Diagrams: [`diagrams/`](./diagrams/) (Mermaid `.mmd` files).
