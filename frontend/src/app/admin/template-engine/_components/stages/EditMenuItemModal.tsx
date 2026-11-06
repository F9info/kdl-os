'use client'

import { useEffect, useState } from 'react'
import type { MenuItemNode } from '@/app/admin/menus/_tree'
import { Modal } from '@/components/shared/Modal'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export interface MenuItemPatch {
  label: string
  url: string
  open_in_new_tab: boolean
}

/** Edit one menu item: its label, where it goes (not for page links) and whether it opens in a new tab. */
export function EditMenuItemModal({
  item,
  onClose,
  onSave,
}: {
  item: MenuItemNode | null
  onClose: () => void
  onSave: (id: string, patch: MenuItemPatch) => void
}) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [openInNewTab, setOpenInNewTab] = useState(false)
  useEffect(() => {
    if (item) {
      setLabel(item.label)
      setUrl(item.url ?? '')
      setOpenInNewTab(item.open_in_new_tab)
    }
  }, [item])

  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title="Edit Menu Item"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!label.trim()}
            onClick={() => {
              if (item) onSave(item.id, { label: label.trim(), url, open_in_new_tab: openInNewTab })
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Label" required>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FormField>
        {item?.link_type !== 'page' && (
          <FormField label="URL">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} />
          </FormField>
        )}
        <FormField label="Open in new tab">
          <Switch checked={openInNewTab} onCheckedChange={setOpenInNewTab} />
        </FormField>
      </div>
    </Modal>
  )
}
