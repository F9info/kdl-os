import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import * as s from './schema.js';
import * as c from './controller.js';

const router = Router();
const perm = (action) => requirePermission('membership', action);

// Open endpoints: sign-up and gateway webhooks are rate limited per IP.
const open = (max, message) =>
  rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? max : 5000, standardHeaders: true, legacyHeaders: false, message: { success: false, message } });
const signupLimiter = open(30, 'Too many sign-up attempts, try again later');
const webhookLimiter = open(2000, 'Too many webhook requests');

// ----- public (no login) -----
router.get('/plans', c.listPlans);
router.get('/join-form/:planSlug', validate(s.joinFormSchema), c.joinForm);
router.post('/signup', signupLimiter, validate(s.signupSchema), c.signup);
router.post('/webhooks/:provider', webhookLimiter, c.webhook);

// ----- everything below needs a login -----
router.use(authenticate);

// ----- member area (the signed-in user must own a Member row) -----
router.get('/me', c.requireMember, c.getMe);
router.put('/me', c.requireMember, validate(s.profileSchema), c.putMe);
router.put('/me/fields', c.requireMember, validate(s.fieldsSchema), c.putMeFields);
router.get('/me/contacts', c.requireMember, c.getContacts);
router.post('/me/contacts', c.requireMember, validate(s.contactCreateSchema), c.postContact);
router.patch('/me/contacts/:id', c.requireMember, validate(s.contactUpdateSchema), c.patchContact);
router.delete('/me/contacts/:id', c.requireMember, validate(s.contactParamSchema), c.deleteContact);
router.get('/checkout/providers', c.requireMember, validate(s.checkoutProvidersSchema), c.getCheckoutProviders);
router.post('/checkout', c.requireMember, validate(s.checkoutSchema), c.postCheckout);
router.post('/payments/:id/offline-proof', c.requireMember, validate(s.offlineProofSchema), c.postOfflineProof);
router.post('/payments/:id/confirm', c.requireMember, validate(s.confirmSchema), c.postConfirm);
router.get('/me/payments', c.requireMember, c.getMyPayments);
router.get('/me/invoices', c.requireMember, c.getMyInvoices);
router.get('/me/invoices/:id', c.requireMember, validate(s.idParams), c.getMyInvoice);
router.post('/me/renew', c.requireMember, c.postRenew);
router.post('/me/change-plan', c.requireMember, validate(s.changePlanSchema), c.postChangePlan);
router.post('/me/cancel', c.requireMember, validate(s.cancelSchema), c.postCancel);
router.get('/me/access', c.requireMember, validate(s.accessSchema), c.getAccess);
router.get('/me/library', c.requireMember, c.getLibrary);

// ----- admin: overview -----
router.get('/admin/overview', perm('view'), c.adminOverview);

// ----- admin: plans -----
router.get('/admin/plans', perm('view'), validate(s.planListSchema), c.adminPlans);
router.post('/admin/plans', perm('add'), validate(s.planCreateSchema), c.adminPlanCreate);
router.get('/admin/plans/:id', perm('view'), validate(s.idParams), c.adminPlanGet);
router.patch('/admin/plans/:id', perm('edit'), validate(s.planUpdateSchema), c.adminPlanUpdate);
router.delete('/admin/plans/:id', perm('delete'), validate(s.idParams), c.adminPlanDelete);
router.post('/admin/plans/:id/archive', perm('edit'), validate(s.idParams), c.adminPlanArchive);
router.post('/admin/plans/:id/prices', perm('edit'), validate(s.priceCreateSchema), c.adminPriceCreate);
router.patch('/admin/prices/:id', perm('edit'), validate(s.priceUpdateSchema), c.adminPriceUpdate);
router.delete('/admin/prices/:id', perm('edit'), validate(s.idParams), c.adminPriceDelete);
router.put('/admin/plans/:id/benefits', perm('edit'), validate(s.benefitsSchema), c.adminBenefits);
router.put('/admin/plans/:id/field-groups', perm('edit'), validate(s.planFieldGroupsSchema), c.adminPlanFieldGroups);
router.put('/admin/plans/:id/access-rules', perm('edit'), validate(s.planAccessRulesSchema), c.adminPlanAccessRules);

// ----- admin: members (fixed paths before :id) -----
router.get('/admin/members/export', perm('export'), validate(s.exportSchema), c.adminMemberExport);
router.post('/admin/members/bulk', perm('edit'), validate(s.bulkSchema), c.adminMemberBulk);
router.post('/admin/members/import/preview', perm('add'), validate(s.importSchema), c.adminImportPreview);
router.post('/admin/members/import/commit', perm('add'), validate(s.importSchema), c.adminImportCommit);
router.get('/admin/members', perm('view'), validate(s.memberListSchema), c.adminMembers);
router.post('/admin/members', perm('add'), validate(s.memberCreateSchema), c.adminMemberCreate);
router.get('/admin/members/:id', perm('view'), validate(s.idParams), c.adminMemberGet);
router.patch('/admin/members/:id', perm('edit'), validate(s.memberUpdateSchema), c.adminMemberUpdate);
router.post('/admin/members/:id/extend', perm('edit'), validate(s.extendSchema), c.adminMemberExtend);
router.post('/admin/members/:id/change-plan', perm('edit'), validate(s.adminChangePlanSchema), c.adminMemberChangePlan);
router.post('/admin/members/:id/suspend', perm('edit'), validate(s.reasonSchema), c.adminMemberSuspend);
router.post('/admin/members/:id/reactivate', perm('edit'), validate(s.idParams), c.adminMemberReactivate);
router.post('/admin/members/:id/cancel', perm('edit'), validate(s.adminCancelSchema), c.adminMemberCancel);
router.post('/admin/members/:id/record-payment', perm('edit'), validate(s.recordPaymentSchema), c.adminMemberRecordPayment);
router.post('/admin/members/:id/notes', perm('edit'), validate(s.notesSchema), c.adminMemberNotes);
router.get('/admin/members/:id/contacts', perm('view'), validate(s.idParams), c.adminContactList);
router.post('/admin/members/:id/contacts', perm('edit'), validate(s.adminContactCreate), c.adminContactCreate);
router.patch('/admin/members/:id/contacts/:cid', perm('edit'), validate(s.adminContactUpdate), c.adminContactUpdate);
router.delete('/admin/members/:id/contacts/:cid', perm('edit'), validate(s.adminContactParams), c.adminContactDelete);
router.get('/admin/members/:id/activity', perm('view'), validate(s.memberActivitySchema), c.adminMemberActivity);

// ----- admin: approvals -----
router.get('/admin/approvals', perm('view'), validate(s.approvalListSchema), c.adminApprovals);
router.get('/admin/approvals/:subscriptionId', perm('view'), validate(s.approvalParamSchema), c.adminApprovalGet);
router.post('/admin/approvals/:subscriptionId/approve', perm('approve'), validate(s.approvalParamSchema), c.adminApprove);
router.post('/admin/approvals/:subscriptionId/reject', perm('approve'), validate(s.approvalRejectSchema), c.adminReject);

// ----- admin: payments & invoices -----
router.get('/admin/payments', perm('view'), validate(s.paymentListSchema), c.adminPayments);
router.get('/admin/payments/:id', perm('view'), validate(s.idParams), c.adminPaymentGet);
router.post('/admin/payments/:id/verify', perm('approve'), validate(s.idParams), c.adminPaymentVerify);
router.post('/admin/payments/:id/reject', perm('approve'), validate(s.paymentRejectSchema), c.adminPaymentReject);
router.post('/admin/payments/:id/refund', perm('approve'), validate(s.paymentRefundSchema), c.adminPaymentRefund);
router.get('/admin/invoices', perm('view'), validate(s.invoiceListSchema), c.adminInvoices);
router.get('/admin/invoices/:id', perm('view'), validate(s.idParams), c.adminInvoiceGet);
router.post('/admin/invoices/:id/void', perm('approve'), validate(s.invoiceVoidSchema), c.adminInvoiceVoid);

// ----- admin: payment providers (/order before /:id) -----
router.get('/admin/payment-providers', perm('view'), validate(s.providerListSchema), c.adminProviders);
router.post('/admin/payment-providers', perm('add'), validate(s.providerCreateSchema), c.adminProviderCreate);
router.patch('/admin/payment-providers/order', perm('edit'), validate(s.providerOrderSchema), c.adminProviderOrder);
router.get('/admin/payment-providers/:id', perm('view'), validate(s.idParams), c.adminProviderGet);
router.patch('/admin/payment-providers/:id', perm('edit'), validate(s.providerUpdateSchema), c.adminProviderUpdate);
router.delete('/admin/payment-providers/:id', perm('delete'), validate(s.idParams), c.adminProviderDelete);
router.post('/admin/payment-providers/:id/test', perm('edit'), validate(s.idParams), c.adminProviderTest);
router.post('/admin/payment-providers/:id/publish', perm('edit'), validate(s.idParams), c.adminProviderAction('publish'));
router.post('/admin/payment-providers/:id/hide', perm('edit'), validate(s.idParams), c.adminProviderAction('hide'));
router.post('/admin/payment-providers/:id/archive', perm('edit'), validate(s.idParams), c.adminProviderAction('archive'));

// ----- admin: field packs -----
router.get('/admin/field-groups', perm('view'), c.adminGroups);
router.post('/admin/field-groups', perm('add'), validate(s.groupCreateSchema), c.adminGroupCreate);
router.get('/admin/field-groups/presets', perm('view'), c.adminPresets);
router.post('/admin/field-groups/presets/apply', perm('add'), validate(s.presetApplySchema), c.adminPresetApply);
router.patch('/admin/field-groups/:id', perm('edit'), validate(s.groupUpdateSchema), c.adminGroupUpdate);
router.delete('/admin/field-groups/:id', perm('delete'), validate(s.idParams), c.adminGroupDelete);
router.post('/admin/field-groups/:id/fields', perm('edit'), validate(s.fieldCreateSchema), c.adminFieldCreate);
router.patch('/admin/fields/:id', perm('edit'), validate(s.fieldUpdateSchema), c.adminFieldUpdate);
router.delete('/admin/fields/:id', perm('edit'), validate(s.idParams), c.adminFieldDelete);

// ----- admin: settings -----
router.get('/admin/settings', perm('view'), c.adminSettingsGet);
router.put('/admin/settings', perm('edit'), validate(s.settingsSchema), c.adminSettingsPut);

export default router;
