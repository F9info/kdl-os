// Collateral module seed — COLLATERAL_SPEC.md §2.
// Ensures the collateral engine is installed and enabled so the template-engine
// orchestrator can drive it headlessly via /api/collateral/*.
export default async function seed(tx) {
  await tx.module.upsert({
    where:  { slug: 'collateral' },
    create: { slug: 'collateral', status: 'ENABLED' },
    update: { status: 'ENABLED' },
  });
}
