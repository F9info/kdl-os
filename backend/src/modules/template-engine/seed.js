// Template Engine Phase 1 seed — locks theme-engine setting fields.
// Phase 0 behaviour retained: template-engine installed → theme-engine fields become read-only
// to prevent parallel edits while Studio orchestrates the token write.
export default async function seed(tx) {
  await tx.settingField.updateMany({
    where: { owner_module: 'theme-engine' },
    data: { locked_by: 'template-engine' },
  });
}
