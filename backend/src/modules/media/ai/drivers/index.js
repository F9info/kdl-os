import openrouterVision from './openrouter-vision.js';
import replicate from './replicate.js';
import whisperLocal from './whisper-local.js';
import openaiWhisperApi from './openai-whisper-api.js';
import openaiEmbeddings from './openai-embeddings.js';

// AI features (mirror AiFeature enum, lowercase): feature → required driver method
export const FEATURES = {
  vision: 'analyzeImage',
  image_ops: 'runImageOp',
  speech_to_text: 'transcribe',
  embeddings: 'embed',
};

const registry = {
  'openrouter-vision': openrouterVision,
  replicate,
  'whisper-local': whisperLocal,
  'openai-whisper-api': openaiWhisperApi,
  'openai-embeddings': openaiEmbeddings,
};

export default registry;

export function getDriver(driverName) {
  const d = registry[driverName];
  if (!d) throw new Error(`Unknown AI provider driver: ${driverName}`);
  return d;
}

export function driversForFeature(feature) {
  return Object.values(registry).filter((d) => d.features.includes(feature));
}
