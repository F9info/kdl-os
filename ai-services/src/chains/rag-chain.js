import { retrieveChunks } from '../knowledge/retrieve.js';
import { brainRouter } from '../orchestrator/brain-router.js';
import { wrapUntrusted } from '../governance/compliance.js';
import { addMessage, getContext } from '../orchestrator/context-manager.js';

export async function ragChain(query, sessionId, priority = 'MEDIUM', options = {}) {
  // tenantId scopes the vector lookup; it is not a brain option, so keep it out of the model call.
  const { tenantId, ...brainOptions } = options;
  const [chunks, history] = await Promise.all([
    retrieveChunks(query, 5, tenantId),
    getContext(sessionId),
  ]);

  const contextBlock = wrapUntrusted(chunks.map((c) => c.content));

  const systemPrompt = [
    'You are a helpful AI assistant for the KDL Starter Kit platform.',
    contextBlock,
  ].filter(Boolean).join('\n\n');

  const messages = [
    ...history.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: query },
  ];

  const response = await brainRouter(messages, priority, {
    system: systemPrompt,
    sessionId,
    tenantId,
    ...brainOptions,
  });

  if (!response.error) {
    await Promise.all([
      addMessage(sessionId, 'user', query),
      addMessage(sessionId, 'assistant', response.content),
    ]);
  }

  return response;
}
