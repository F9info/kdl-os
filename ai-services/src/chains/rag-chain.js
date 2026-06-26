import { retrieveChunks } from '../knowledge/retrieve.js';
import { brainRouter } from '../orchestrator/brain-router.js';
import { addMessage, getContext } from '../orchestrator/context-manager.js';

export async function ragChain(query, sessionId, priority = 'MEDIUM', options = {}) {
  const [chunks, history] = await Promise.all([
    retrieveChunks(query, 5),
    getContext(sessionId),
  ]);

  const contextBlock = chunks.length > 0
    ? `Relevant context:\n${chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')}`
    : '';

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
    ...options,
  });

  if (!response.error) {
    await Promise.all([
      addMessage(sessionId, 'user', query),
      addMessage(sessionId, 'assistant', response.content),
    ]);
  }

  return response;
}
