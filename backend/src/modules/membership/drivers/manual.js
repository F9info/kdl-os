// Bank transfer / cheque / cash: nothing is called remotely. The member pays outside, submits a UTR
// (and proof), an admin verifies. Instructions come from the provider's manual_config.
const unsupported = (what) => () => {
  const err = new Error(`${what} is not available for offline payments`);
  err.status = 400;
  throw err;
};

export const manualDriver = {
  type: 'MANUAL',
  createOrder: async (_ctx, _creds, provider) => ({ instructions: provider?.manual_config ?? {} }),
  verifyWebhook: unsupported('Webhooks'),
  parseWebhook: () => null,
  verifyCheckout: unsupported('Client confirmation'),
  // Money goes back by hand; the caller records it.
  refund: async () => ({ refund_id: null, manual: true }),
  test: async () => ({ ok: true, message: 'Offline method: nothing to test' }),
};
