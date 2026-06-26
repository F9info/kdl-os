const PII_PATTERNS = [
  { name: 'email',       re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,       replacement: '[EMAIL]' },
  { name: 'phone_us',    re: /(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g,   replacement: '[PHONE]' },
  { name: 'credit_card', re: /\b(?:\d[ \-]?){13,16}\b/g,                                 replacement: '[CC]'    },
  { name: 'ssn',         re: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,                          replacement: '[SSN]'   },
];

export function scrubInput(text) {
  if (typeof text !== 'string') return text;
  let scrubbed = text;
  for (const { re, replacement } of PII_PATTERNS) {
    scrubbed = scrubbed.replace(re, replacement);
  }
  return scrubbed;
}

export function scrubMessages(messages) {
  if (!Array.isArray(messages)) return scrubInput(messages);
  return messages.map((m) => ({ ...m, content: scrubInput(m.content) }));
}
