'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { installApi, setSetupToken } from './install-api'

/**
 * First screen of a fresh install: the setup token. It is printed once in the server log when the backend
 * starts (or set with KDL_SETUP_TOKEN), so only someone with access to the server can begin the installation.
 */
export function SetupTokenGate({ onAccepted }: { onAccepted: () => void }) {
  const [token, setToken] = useState('')
  const verify = useMutation({
    mutationFn: async () => {
      setSetupToken(token.trim())
      try {
        await installApi.post('/token')
      } catch (err) {
        setSetupToken('')
        throw err
      }
    },
    onSuccess: onAccepted,
  })

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-primary">
        <KeyRound className="h-5 w-5" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-foreground">Enter the setup token</h1>
      </div>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        To keep a new installation private, the installer asks for a token that only the server
        shows.
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (token.trim().length >= 8) verify.mutate()
        }}
      >
        <FormField
          label="Setup token"
          required
          hint="Find it in the backend log: docker compose logs backend | grep SETUP. Lost it? Run npm run install:token."
        >
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Setup token"
            className="font-mono"
          />
        </FormField>
        {verify.error && <ErrorAlert error={verify.error} />}
        <div className="flex justify-end">
          <Button type="submit" disabled={token.trim().length < 8 || verify.isPending}>
            {verify.isPending ? 'Checking…' : 'Continue'}
          </Button>
        </div>
      </form>
    </section>
  )
}
