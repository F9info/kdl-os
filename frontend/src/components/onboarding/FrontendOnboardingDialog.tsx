'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const LATER_KEY = 'kdl_frontend_onboarding_later'
type Answer = 'yes' | 'no'
type Result = { choice: Answer; created: string[]; skipped: string[] }

function askedLater(): boolean {
  try {
    return sessionStorage.getItem(LATER_KEY) === '1'
  } catch {
    return false
  }
}

// First-run question for every admin until someone answers: does this install need a public website?
export function FrontendOnboardingDialog() {
  const qc = useQueryClient()
  const pathname = usePathname() ?? ''
  // Never cover a full-screen editor with the question.
  const inEditor = pathname.includes('/edit/') || pathname.startsWith('/admin/page-builder')
  const [later, setLater] = useState(askedLater)
  const [result, setResult] = useState<Result | null>(null)

  const { data } = useQuery({
    queryKey: ['onboarding', 'frontend'],
    queryFn: async () => (await api.get('/projects/onboarding')).data.data as { answered: boolean },
    retry: false,
  })

  const answer = useMutation({
    mutationFn: async (frontend: Answer) =>
      (await api.post('/projects/onboarding', { frontend })).data.data as Result,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['onboarding', 'frontend'] })
      qc.invalidateQueries({ queryKey: ['page-builder'] })
      if (r.choice === 'yes') setResult(r)
      else
        toast({
          title: 'Saved',
          description: 'No website was created. You can add pages any time in Page Builder.',
        })
    },
    onError: () =>
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' }),
  })

  const open = !!result || (!!data && !data.answered && !later && !inEditor)

  const postpone = () => {
    try {
      sessionStorage.setItem(LATER_KEY, '1')
    } catch {
      /* private mode: the pop-up simply returns on the next page load */
    }
    setLater(true)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (result ? setResult(null) : postpone())}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Your website is ready</DialogTitle>
              <DialogDescription>
                {result.created.length} page{result.created.length === 1 ? '' : 's'} created (Home,
                About, Services, Contact, FAQ) with neutral colours and “Your Brand” text. Change
                them in Page Builder and Themes.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" asChild>
                <Link href="/admin/page-builder" onClick={() => setResult(null)}>
                  Open Page Builder
                </Link>
              </Button>
              <Button asChild>
                <a href="/p/home" target="_blank" rel="noreferrer">
                  View website
                </a>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Do you need a front-end website?</DialogTitle>
              <DialogDescription>
                Choose “Yes” and KDL OS creates a ready 5-page website (Home, About, Services,
                Contact, FAQ) that you can edit. Choose “No” to use the admin and API only.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={postpone} disabled={answer.isPending}>
                Ask me later
              </Button>
              <Button
                variant="outline"
                onClick={() => answer.mutate('no')}
                disabled={answer.isPending}
              >
                No, backend only
              </Button>
              <Button onClick={() => answer.mutate('yes')} disabled={answer.isPending}>
                {answer.isPending ? 'Creating your website…' : 'Yes, create my website'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
