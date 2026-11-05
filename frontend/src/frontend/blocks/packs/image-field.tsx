import { useState } from 'react'
import type { CustomField } from '@puckeditor/core'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaPicker } from '@/components/shared/MediaPicker'

/**
 * Image field for Puck's `fields` schema — a URL text box plus an "Upload"
 * button that opens the shared media library (same MediaPicker + /media/upload
 * flow as the Composer's ImageUrlField, packs/composer/atoms.tsx). Typing or
 * pasting a URL directly still works; Upload is the alternative, not a
 * replacement.
 */
function ImageFieldInner({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <div className="flex gap-2">
        <input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
          className="shrink-0 gap-1.5"
          title="Upload or choose from media library"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </Button>
      </div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="mt-2 h-16 w-auto rounded border border-slate-200 object-cover"
        />
      )}
      {pickerOpen && (
        <MediaPicker
          open
          onClose={() => setPickerOpen(false)}
          onSelect={(media) => {
            const url = media[0]?.url
            if (url) onChange(url)
            setPickerOpen(false)
          }}
          typeFilter="IMAGE"
        />
      )}
    </div>
  )
}

export function imageField(label = 'Image'): CustomField<string> {
  return {
    type: 'custom',
    render: ({ value, onChange }) => (
      <ImageFieldInner label={label} value={value} onChange={onChange} />
    ),
  }
}
