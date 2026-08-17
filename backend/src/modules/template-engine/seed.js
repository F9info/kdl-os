export default async function seed(tx) {
  await tx.settingField.updateMany({
    where: { owner_module: 'theme-engine' },
    data: { locked_by: 'template-engine' },
  });
}
