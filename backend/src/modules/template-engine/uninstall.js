// Template Engine uninstall — release theme-engine field locks.
// Run data (TemplateEngineRun + TemplateEngineStage) is retained (non-destructive uninstall —
// TEMPLATE_ENGINE_ARCH §2 mode-switch semantics: runs resume when re-enabled).
export default async function uninstall(tx) {
  await tx.settingField.updateMany({
    where: { locked_by: 'template-engine' },
    data: { locked_by: null },
  });
}
