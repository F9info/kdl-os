// Moved to backend/src/shared/utils/crypto.js (shared by integrations + media AI providers).
// This shim keeps existing integrations-module imports working.
export { encrypt, decrypt } from '../../../shared/utils/crypto.js';
