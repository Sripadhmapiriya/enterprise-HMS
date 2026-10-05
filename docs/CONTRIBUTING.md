# Engineering Standards & Contribution Guide

This guide establishes the mandatory engineering, design, and testing standards for all contributions to the Enterprise HMS codebase.

---

## 1. Non-Negotiable Ground Rules

1. **Zero Prohibited Terminology**: Strictly avoid using legacy sequential project numbering labels in code, UI, comments, commit messages, or documentation. Use "workstream", "module", "release", or domain descriptors.
2. **Zero Direct Prisma Access in `apps/web`**: All web pages must interact with the backend through the authenticated REST API client (`apps/web/src/lib/api.ts`). Direct `@prisma/client` imports in web components will fail CI.
3. **Zero Placeholder Text**: Code must never contain `TODO`, "coming soon", "Pending", "module active", or mock demo data in shipped surfaces.
4. **No Emojis in Clinical UI**: The design system strictly enforces Lucide SVG icons (`@enterprise-hms/ui`) for clinical and operational clarity.
5. **Full Output Enforcement**: Never truncate code with `// ...rest of file`. Always generate complete, compilable source files.

---

## 2. Monorepo Quality Gate

Before submitting a change or creating a commit, you must run and pass the full verification command:

```bash
npm run verify
```

This command runs:
- `npm run typecheck` across all 8 workspaces
- `npm run test` across all 17 Vitest test suites (235+ tests)
- `npm run check:integrity` (scans for prohibited Phase strings, direct Prisma imports, placeholders, and committed secrets)

---

## 3. Branching & Commit Conventions

- Use conventional commits: `feat(domain): description`, `fix(domain): description`, `chore: description`.
- Ensure all tests pass locally before committing.
