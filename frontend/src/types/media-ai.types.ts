export type AiFeature = 'vision' | 'image_ops' | 'speech_to_text'

export interface AiFieldDef {
  key: string
  required: boolean
}

export interface AiDriverDef {
  driver: string
  features: AiFeature[]
  credential_fields: AiFieldDef[]
  config_fields: AiFieldDef[]
  ops?: string[]
}

export interface AiProvider {
  id: string
  feature: string // backend stores upper-case enum (VISION | IMAGE_OPS | SPEECH_TO_TEXT)
  driver: string
  name: string
  config: Record<string, unknown> | null
  is_active: boolean
  credentials_set: boolean
  created_at: string
  updated_at: string
}

export interface AiFeatureStatus {
  configured: boolean
  driver: string | null
}

export const AI_FEATURES: AiFeature[] = ['vision', 'image_ops', 'speech_to_text']

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  vision: 'Vision (tagging & captions)',
  image_ops: 'Image Ops (bg removal, upscale, enhance)',
  speech_to_text: 'Speech to Text',
}
