import { InvoiceView } from '@/frontend/membership/Billing'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <InvoiceView id={id} />
}
