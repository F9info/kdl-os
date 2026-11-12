import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import * as s from './schema.js';
import * as c from './controller.js';
import * as a from './auth/controller.js';
import * as cm from './comm/controller.js';

const router = Router();
const perm = (action) => requirePermission('membership', action);

// Open endpoints: sign-up and gateway webhooks are rate limited per IP.
const open = (max, message) =>
  rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'production' ? max : 5000, standardHeaders: true, legacyHeaders: false, message: { success: false, message } });
const signupLimiter = open(30, 'Too many sign-up attempts, try again later');
const webhookLimiter = open(2000, 'Too many webhook requests');
const otpLimiter = open(20, 'Too many code requests, try again later');
const authLimiter = open(60, 'Too many attempts, try again later');

// Delivery runs in a BullMQ worker; start it with the module (never under test).
if (process.env.NODE_ENV !== 'test') import('./comm/worker.js').then((m) => m.startCommWorker()).catch(() => {});

// ----- public (no login) -----
router.get('/plans', c.listPlans);
router.get('/join-form/:planSlug', validate(s.joinFormSchema), c.joinForm);
router.post('/signup', signupLimiter, validate(s.signupSchema), c.signup);
router.post('/webhooks/:provider', webhookLimiter, c.webhook);

// login: mobile OTP, social providers (OAuth2 / OIDC authorization code + PKCE), account linking
router.post('/auth/otp/send', otpLimiter, validate(s.otpSendSchema), a.otpSend);
router.post('/auth/otp/verify', otpLimiter, validate(s.otpVerifySchema), a.otpVerify);
router.get('/auth/providers', a.providers);
router.get('/auth/oauth/:provider', authLimiter, validate(s.oauthStartSchema), a.oauthStart);
router.get('/auth/oauth/:provider/callback', authLimiter, a.oauthCallback);
router.post('/auth/oauth/:provider/callback', authLimiter, express.urlencoded({ extended: false }), a.oauthCallback); // Apple form_post
router.post('/auth/link', authLimiter, validate(s.linkSchema), a.link);

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
router.post('/me/resume', c.requireMember, c.postResume);
router.post('/me/auto-renew', c.requireMember, validate(s.autoRenewSchema), c.postAutoRenew);
router.get('/me/identities', a.myIdentities);
router.delete('/me/identities/:id', validate(s.identityParams), a.deleteIdentity);
router.get('/me/sessions', a.mySessions);
router.post('/me/sessions/logout-all', a.logoutAll);
router.delete('/me/sessions/:id', a.deleteSession);
router.get('/me/notifications', c.requireMember, validate(s.notificationListSchema), cm.myNotifications);
router.patch('/me/notifications/read', c.requireMember, validate(s.notificationReadSchema), cm.myRead);
router.get('/me/notifications/unread-count', c.requireMember, cm.myUnread);
router.get('/me/communication-preferences', c.requireMember, cm.myPrefs);
router.put('/me/communication-preferences', c.requireMember, validate(s.commPrefsSchema), cm.myPrefsPut);
router.post('/me/whatsapp-opt-in', c.requireMember, cm.waOptIn);
router.post('/me/whatsapp-opt-out', c.requireMember, cm.waOptOut);

// ----- admin: overview -----
router.get('/admin/overview', perm('view'), c.adminOverview);

// ----- admin: plans -----
router.get('/admin/plans', perm('view'), validate(s.planListSchema), c.adminPlans);
router.put('/admin/plans/order', perm('edit'), validate(s.planOrderSchema), c.adminPlanOrder);
router.patch('/admin/plans/order', perm('edit'), validate(s.planOrderSchema), c.adminPlanOrder);
router.post('/admin/plans', perm('add'), validate(s.planCreateSchema), c.adminPlanCreate);
router.get('/admin/plans/:id', perm('view'), validate(s.idParams), c.adminPlanGet);
router.patch('/admin/plans/:id', perm('edit'), validate(s.planUpdateSchema), c.adminPlanUpdate);
router.delete('/admin/plans/:id', perm('delete'), validate(s.idParams), c.adminPlanDelete);
router.post('/admin/plans/:id/archive', perm('edit'), validate(s.planArchiveSchema), c.adminPlanArchive);
router.post('/admin/plans/:id/prices', perm('edit'), validate(s.priceCreateSchema), c.adminPriceCreate);
router.patch('/admin/prices/:id', perm('edit'), validate(s.priceUpdateSchema), c.adminPriceUpdate);
router.delete('/admin/prices/:id', perm('edit'), validate(s.idParams), c.adminPriceDelete);
router.put('/admin/plans/:id/benefits', perm('edit'), validate(s.benefitsSchema), c.adminBenefits);
router.put('/admin/plans/:id/field-groups', perm('edit'), validate(s.planFieldGroupsSchema), c.adminPlanFieldGroups);
router.put('/admin/plans/:id/access-rules', perm('edit'), validate(s.planAccessRulesSchema), c.adminPlanAccessRules);

// ----- admin: coupons -----
router.get('/admin/coupons', perm('view'), validate(s.couponListSchema), c.adminCoupons);
router.post('/admin/coupons', perm('add'), validate(s.couponCreateSchema), c.adminCouponCreate);
router.patch('/admin/coupons/:id', perm('edit'), validate(s.couponUpdateSchema), c.adminCouponUpdate);
router.delete('/admin/coupons/:id', perm('delete'), validate(s.idParams), c.adminCouponDelete);

// ----- admin: members (fixed paths before :id) -----
router.get('/admin/members/segments', perm('view'), c.adminSegments);
router.post('/admin/members/segments', perm('view'), validate(s.segmentSchema), c.adminSegmentCreate);
router.delete('/admin/members/segments/:id', perm('view'), validate(s.idParams), c.adminSegmentDelete);
router.get('/admin/gstin/lookup', perm('view'), c.adminGstin);
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
router.get('/admin/members/:id/change-plan/quote', perm('view'), c.adminChangePlanQuote);
router.post('/admin/members/:id/send-password-reset', perm('edit'), validate(s.idParams), c.adminSendReset);
router.post('/admin/members/:id/resend-welcome', perm('edit'), validate(s.idParams), c.adminResendWelcome);
router.get('/admin/members/:id/activity', perm('view'), validate(s.memberActivitySchema), c.adminMemberActivity);

// ----- admin: approvals -----
router.get('/admin/approvals/count', perm('view'), c.adminApprovalsCount);
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

// ----- admin: communication (events, templates, reminders, logs, settings) -----
const comm = '/admin/communication';
router.get(`${comm}/events`, perm('view'), cm.events);
router.post(`${comm}/events`, perm('edit'), validate(s.commEventCreateSchema), cm.eventCreate);
router.patch(`${comm}/events/:key`, perm('edit'), validate(s.commEventSwitchSchema), cm.eventSwitch);
router.get(`${comm}/templates`, perm('view'), validate(s.commTemplateListSchema), cm.templates);
router.get(`${comm}/templates/:event/:channel/:lang`, perm('view'), validate(s.commTemplateParams), cm.templateGet);
router.put(`${comm}/templates/:event/:channel/:lang`, perm('edit'), validate(s.commTemplatePutSchema), cm.templatePut);
router.post(`${comm}/templates/:event/:channel/:lang/test`, perm('edit'), validate(s.commTestSchema), cm.templateTest);
router.get(`${comm}/variables`, perm('view'), validate(s.commVariablesSchema), cm.variables);
router.get(`${comm}/logs/export`, perm('export'), validate(s.commLogListSchema), cm.logsExport);
router.post(`${comm}/logs/retry-failed`, perm('edit'), cm.logsRetryFailed);
router.get(`${comm}/logs`, perm('view'), validate(s.commLogListSchema), cm.logs);
router.get(`${comm}/logs/:id`, perm('view'), cm.logGet);
router.post(`${comm}/logs/:id/retry`, perm('edit'), cm.logRetry);
router.get(`${comm}/reminders`, perm('view'), cm.remindersGet);
router.put(`${comm}/reminders`, perm('edit'), validate(s.commRemindersSchema), cm.remindersPut);
router.get(`${comm}/settings`, perm('view'), cm.settingsGet);
router.put(`${comm}/settings`, perm('edit'), validate(s.commSettingsSchema), cm.settingsPut);
router.post(`${comm}/settings/whatsapp/sync`, perm('edit'), cm.settingsSync);
router.post(`${comm}/settings/:channel/test`, perm('edit'), validate(s.commSettingsTestSchema), cm.settingsTest);

// ----- admin: social login providers (fixed paths before :key) -----
router.get('/admin/auth/providers', perm('view'), a.adminProviders);
router.get('/admin/auth/presets', perm('view'), a.adminPresets);
router.post('/admin/auth/providers', perm('add'), validate(s.authProviderCreateSchema), a.adminProviderCreate);
router.put('/admin/auth/providers/reorder', perm('edit'), validate(s.authProviderReorderSchema), a.adminProviderReorder);
router.patch('/admin/auth/providers/:key', perm('edit'), validate(s.authProviderUpdateSchema), a.adminProviderUpdate);
router.put('/admin/auth/providers/:key', perm('edit'), validate(s.authProviderUpdateSchema), a.adminProviderUpdate);
router.delete('/admin/auth/providers/:key', perm('delete'), validate(s.authProviderKeyParams), a.adminProviderDelete);
router.post('/admin/auth/providers/:key/test', perm('edit'), validate(s.authProviderKeyParams), a.adminProviderTest);

// ----- admin: settings -----
router.get('/admin/settings', perm('view'), c.adminSettingsGet);
router.put('/admin/settings', perm('edit'), validate(s.settingsSchema), c.adminSettingsPut);

export default router;
