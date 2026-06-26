import { errorResponse } from '../utils/response.js';

export function transcribeController(_req, res) {
  return errorResponse(res, 'Transcription not yet implemented. Planned: Whisper API integration.', 501);
}
