'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Add member is a full page now (members/new); this keeps old `open`/`onClose` callers working by sending them there. */
export function AddMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  useEffect(() => {
    if (!open) return
    onClose()
    router.push('/admin/membership/members/new')
  }, [open, onClose, router])
  return null
}
