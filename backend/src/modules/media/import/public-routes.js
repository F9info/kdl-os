// Unauthenticated router for the OAuth redirect target only. Must be mounted
// BEFORE the main media router (which applies `authenticate` to everything
// under /api/media) — the provider's browser redirect carries no Bearer token,
// so this route resolves the user from the signed `state` param instead
// (see cloud-import.service.js completeOAuth/parseState).
import { Router } from 'express';
import { oauthCallback } from './controller.js';

const router = Router();

router.get('/:provider/callback', oauthCallback);

export default router;
