'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { SetupWizard } from './SetupWizard'

// Same keys as the dialog this replaces, so an install that already answered stays answered and a
// "Ask me later" still lasts the browser session.
const LATER_KEY = 'kdl_frontend_onboarding_later'

function askedLater(): boolean {
  try {
    return sessionStorage.getItem(LATER_KEY) === '1'
  } catch {
    return false
  }
}

// Shows the setup wizard on first run (until the old `onboarding.frontend` answer exists).
export function SetupWizardGate() {
  const pathname = usePathname() ?? ''
  const { can } = usePermissions()
  // Never cover a full-screen editor.
  const inEditor = pathname.includes('/edit/') || pathname.startsWith('/admin/page-builder')
  const [later, setLater] = useState(askedLater)
  // Once shown it stays open until closed: finishing saves the answer, which must not unmount the
  // wizard before its last step.
  const [active, setActive] = useState(false)

  // The wizard changes identity, products and pages, so only show it to someone who can.
  const allowed =
    can('settings:edit') && can('modules:edit') && can('modules:add') && can('projects:update')

  const { data } = useQuery({
    queryKey: ['onboarding', 'frontend'],
    enabled: allowed,
    queryFn: async () => (await api.get('/projects/onboarding')).data.data as { answered: boolean },
    retry: false,
  })

  const shouldOpen = allowed && !!data && !data.answered && !later && !inEditor
  useEffect(() => {
    if (shouldOpen) setActive(true)
  }, [shouldOpen])

  const close = () => {
    try {
      sessionStorage.setItem(LATER_KEY, '1')
    } catch {
      /* private mode: the wizard simply returns on the next page load */
    }
    setLater(true)
    setActive(false)
  }

  return <SetupWizard open={active} onClose={close} />
}
