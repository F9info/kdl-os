const SRC = 'https://checkout.razorpay.com/v1/checkout.js'

interface RazorpayCtor {
  new (opts: Record<string, unknown>): { open: () => void; on: (e: string, cb: () => void) => void }
}

/** Loads Razorpay's standard checkout.js on demand (only once an order exists). */
export function loadRazorpay(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor }
  if (w.Razorpay) return Promise.resolve(w.Razorpay)
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SRC
    s.async = true
    s.onload = () =>
      w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Payment window failed to load'))
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'))
    document.body.appendChild(s)
  })
}
