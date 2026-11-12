import type { Metadata } from 'next'
import { InstallWizard } from '@/components/install/InstallWizard'

export const metadata: Metadata = { title: 'Set up KDL OS', robots: { index: false } }

export default function InstallPage() {
  return <InstallWizard />
}
