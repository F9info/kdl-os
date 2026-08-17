export default async function uninstall(tx) {
  await tx.settingField.updateMany({
    where: { locked_by: 'template-engine' },
    data: { locked_by: null },
  });
}
