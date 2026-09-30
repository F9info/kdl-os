# Team Module

## New Module Checklist

Satisfy all items before the review gate:

- [ ] manifest valid (Zod), slug matches folder + schema file + apiPrefix
- [ ] all models in own prisma/schema/team.prisma; migration applies clean
- [ ] all routes behind moduleGate(slug) + authenticate + requirePermission
- [ ] permissions registered via manifest only (never manual seeder edits)
- [ ] every mutation calls writeActivity
- [ ] frontend pages wrapped in ModuleGuard; nav via frontend manifest only
- [ ] module works when OTHER modules are disabled
- [ ] disable → re-enable round-trip leaves no orphan state
