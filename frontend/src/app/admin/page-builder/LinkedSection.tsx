'use client'

import { useQuery } from '@tanstack/react-query'
import { Link2, Link2Off } from 'lucide-react'
import {
  listCustomBlocks,
  sectionLinkState,
} from '@/frontend/blocks/packs/composer/custom-blocks-store'
import type { ComposedBlockConfig } from '@/frontend/blocks/packs/composer/render-composed-block'

type LinkProps = {
  config?: ComposedBlockConfig
  templateId?: string
  templateVersion?: number
  templateDetached?: boolean
}

/**
 * Editor panel note for a block made from a saved section (T7.1): is it still in step with the
 * section, and one click to bring it up to date or back to the section's design. Renders nothing
 * for a block that was never linked.
 */
export function LinkedSectionStatus({
  props,
  projectId,
  onApply,
}: {
  props: LinkProps
  projectId?: string
  /** Replaces the block's props with these (merged into the current ones by the caller). */
  onApply: (patch: Record<string, unknown>) => void
}) {
  const category = props.config?.category ?? ''
  const { data: sections } = useQuery({
    queryKey: ['custom-blocks', projectId ?? 'all', category],
    queryFn: () => listCustomBlocks(projectId, category),
    enabled: Boolean(props.templateId && category),
  })
  if (!props.templateId) return null
  const latest = sections?.find((s) => s.id === props.templateId)
  if (!sections) return null // still loading: say nothing rather than guess
  const state = sectionLinkState(props, latest)
  const apply = () =>
    latest &&
    onApply({ config: latest.config, templateVersion: latest.version, templateDetached: false })

  const note =
    state === 'current'
      ? `Linked to the saved section “${latest?.name}” (version ${latest?.version}).`
      : state === 'outdated'
        ? `The saved section “${latest?.name}” has a newer version (${latest?.version}); this block is on version ${props.templateVersion ?? 1}.`
        : state === 'detached'
          ? `Customised on this page, so changes to “${latest?.name}” are not applied here.`
          : 'The saved section this block came from was deleted. The block stays as it is.'

  return (
    <div
      className="space-y-2 border-b bg-white p-4 text-sm"
      data-testid="linked-section"
      data-state={state}
    >
      <p className="flex items-start gap-2">
        {state === 'missing' || state === 'detached' ? (
          <Link2Off className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        ) : (
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        )}
        <span>{note}</span>
      </p>
      {state === 'outdated' && (
        <button
          type="button"
          onClick={apply}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
        >
          Update this block
        </button>
      )}
      {state === 'detached' && (
        <button
          type="button"
          onClick={apply}
          className="w-full rounded-md border px-3 py-2 text-sm font-semibold"
        >
          Reset to the saved section
        </button>
      )}
    </div>
  )
}
