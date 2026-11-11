// The membership audit events (MembershipEvent.key, written by util.recordEvent at every state change)
// -> the communication events they trigger. Pure.
import { fmtMoney } from './render.js';

/** @returns {{key:string, data?:object}[]} */
export function commEventsFor(key, data = {}, { self = true } = {}) {
  const sweep = !!data.sweep;
  switch (key) {
    case 'member.joined':
      return [{ key: 'account.created' }, ...(data.free ? [] : [{ key: 'membership.purchased' }])];
    case 'member.added':
      return data.welcome === false ? [] : [{ key: 'account.created' }];
    case 'member.activated':
      return [{ key: data.approved ? 'application.approved' : 'membership.activated' }, { key: 'membership.benefits_activated' }];
    case 'member.rejoined':
      return [{ key: 'membership.reactivated' }, { key: 'membership.benefits_activated' }];
    case 'subscription.resumed':
    case 'subscription.reactivated':
      return [{ key: 'membership.reactivated' }];
    case 'subscription.suspended':
      return [{ key: 'membership.suspended' }, { key: 'access.revoked' }];
    case 'subscription.extended':
      return [{ key: 'membership.extended' }];
    case 'subscription.expired':
      return [{ key: 'membership.expired' }, { key: 'access.revoked' }];
    case 'subscription.past_due':
      return [{ key: 'renewal.failed' }];
    case 'subscription.rejected':
      return [{ key: 'application.rejected' }];
    case 'subscription.cancel_scheduled':
      return [{ key: 'cancellation.confirmed' }];
    case 'subscription.cancelled':
      if (sweep) return [{ key: 'cancellation.effective' }, { key: 'access.revoked' }];
      if (data.reason === 'plan_changed' || data.reason === 'checkout_abandoned') return [];
      return self ? [{ key: 'cancellation.confirmed' }, { key: 'cancellation.effective' }] : [{ key: 'cancellation.by_admin' }, { key: 'access.revoked' }];
    case 'subscription.downgraded':
    case 'subscription.plan_changed':
      return [{ key: 'plan.changed', data: { plan_change: true } }];
    case 'subscription.autorenew_on':
      return [{ key: 'autorenew.enabled' }];
    case 'subscription.autorenew_off':
      return [{ key: 'autorenew.disabled' }];
    case 'payment.paid': {
      const out = [];
      if (data.verified) out.push({ key: 'payment.offline_verified' });
      if (data.renewal) out.push({ key: 'renewal.succeeded' });
      else if (!data.verified) out.push({ key: 'payment.succeeded' });
      if (data.invoiced) out.push({ key: 'invoice.generated' });
      return out;
    }
    case 'payment.failed':
      return [{ key: data.renewal ? 'renewal.failed' : 'payment.failed' }];
    case 'payment.rejected':
      return [{ key: 'payment.failed' }];
    case 'payment.cancelled':
      return [{ key: 'payment.cancelled' }];
    case 'payment.refunded':
      return [{ key: data.partial ? 'payment.partially_refunded' : 'payment.refunded', data: { vars: { refund_amount: fmtMoney(data.amount, data.currency) } } }];
    case 'payment.proof_submitted':
      return [{ key: 'payment.offline_submitted' }];
    case 'checkout.started':
      return data.manual ? [{ key: data.renewal ? 'renewal.pending' : 'payment.pending' }] : [];
    case 'member.profile_updated':
    case 'member.updated':
    case 'member.fields_updated':
      return [{ key: 'membership.updated', data: { vars: { changed_fields: (data.fields ?? []).join(', ').replace(/_/g, ' ') || 'profile details' } } }];
    case 'member.email_changed':
      return [{ key: 'email.changed' }];
    case 'member.mobile_changed':
      return [{ key: 'mobile.changed' }];
    case 'contact.added':
      return [{ key: 'contact.invited' }];
    default:
      return [];
  }
}
