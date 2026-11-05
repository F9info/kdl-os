export type ImageOp =
  | { op: 'crop'; left: number; top: number; width: number; height: number }
  | {
      op: 'resize'
      width?: number
      height?: number
      fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
    }
  | { op: 'rotate'; angle: number; background?: string }
  | { op: 'flip' }
  | { op: 'flop' }
  | { op: 'brightness'; factor: number }
  | { op: 'contrast'; factor: number }
  | { op: 'saturation'; factor: number }
  | { op: 'grayscale' }
  | { op: 'blur'; sigma?: number }
  | { op: 'sharpen' }
  | { op: 'negate' }
  | {
      op: 'text_watermark'
      text: string
      position?: WatermarkPosition
      opacity?: number
      font_size?: number
      color?: string
    }
  | {
      op: 'logo_watermark'
      logo_media_id: string
      position?: WatermarkPosition
      opacity?: number
      scale?: number
    }
  | { op: 'compress'; quality?: number; format?: 'jpeg' | 'webp' | 'avif' | 'png' }

export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface ProcessingJob {
  id: string
  name: string
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed'
  progress: number
  result: Record<string, unknown> | null
  failedReason: string | null
  timestamp: number
  processedOn: number | null
  finishedOn: number | null
}

export interface MediaVersion {
  id: string
  media_id: string
  version: number
  path: string
  size: number
  checksum: string | null
  created_by: string | null
  note: string | null
  created_at: string
  url: string
}
