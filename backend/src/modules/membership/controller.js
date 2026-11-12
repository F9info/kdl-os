import { successResponse, errorResponse } from '../../shared/utils/response.js';
import * as pub from './public.service.js';
import * as me from './member.service.js';
import * as co from './checkout.service.js';
import * as plans from './plans.service.js';
import * as members from './members.service.js';
import * as billing from './billing.service.js';
import * as providers from './providers.service.js';
import * as coupons from './coupons.service.js';
import * as fields from './fields.service.js';
import { getSettings, putSettings } from './settings.js';
import { PRESET_KEYS } from './presets.js';

// Every handler: run the service, wrap the result, and hand failures to the error middleware.
const h = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (err) {
    if (err.errors) return errorResponse(res, err.message, err.status ?? 422, err.errors);
    next(err);
  }
};
const actor = (req) => req.user?.id ?? null;
const v = (req) => req.validated;

// ----- member middleware -----
export async function requireMember(req, res, next) {
  try {
    req.member = await me.memberForUser(req.user.id);
    next();
  } catch (err) {
    next(err);
  }
}

// Same cookies as POST /api/auth/login, so a new member is signed in by the sign-up response.
const IS_PROD = process.env.NODE_ENV === 'production';
function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('kdl-auth-token', accessToken, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: 15 * 60 * 1000, path: '/' });
  res.cookie('kdl-refresh-token', refreshToken, { httpOnly: true, sameSite: 'strict', secure: IS_PROD, maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
}

// ----- public -----
export const listPlans = h(() => pub.listPublicPlans().then((items) => ({ items, total: items.length, page: 1, limit: items.length })));
export const joinForm = h((req) => pub.joinForm(v(req).params.planSlug, v(req).query.member_type));
export const signup = async (req, res, next) => {
  try {
    const { refreshToken, ...out } = await pub.signup(v(req).body);
    setAuthCookies(res, out.accessToken, refreshToken);
    return successResponse(res, out, 201);
  } catch (err) {
    if (err.errors) return errorResponse(res, err.message, err.status ?? 422, err.errors);
    next(err);
  }
};
export const webhook = h((req) => pub.handleWebhook(req.params.provider, { rawBody: req.rawBody, headers: req.headers, body: req.body }));

// ----- member area -----
export const getMe = h((req) => me.getMe(req.member));
export const putMe = h((req) => me.updateProfile(req.member, v(req).body, actor(req)).then((member) => ({ member })));
export const putMeFields = h((req) => me.updateFields(req.member, v(req).body, actor(req)).then((fieldsOut) => ({ fields: fieldsOut })));
export const getContacts = h((req) => me.listContacts(req.member.id).then((items) => ({ items })));
export const postContact = h((req) => me.addContact(req.member, v(req).body, actor(req)), 201);
export const patchContact = h((req) => me.updateContact(req.member, v(req).params.id, v(req).body, actor(req)));
export const deleteContact = h((req) => me.removeContact(req.member, v(req).params.id, actor(req)));
export const getCheckoutProviders = h((req) => co.checkoutProviders(req.member, v(req).query));
export const postCheckout = h((req) => co.checkout(req.member, v(req).body, actor(req)), 201);
export const postOfflineProof = h((req) => co.submitOfflineProof(req.member, v(req).params.id, v(req).body, actor(req)));
export const postConfirm = h((req) => co.confirmGatewayPayment(req.member, v(req).params.id, v(req).body, actor(req)));
export const getMyPayments = h((req) => me.myPayments(req.member, req.query));
export const getMyInvoices = h((req) => me.myInvoices(req.member, req.query));
export const getMyInvoice = h((req) => me.myInvoice(req.member, v(req).params.id));
export const postRenew = h((req) => co.renew(req.member, actor(req)));
export const postChangePlan = h((req) => co.changePlan(req.member, v(req).body, actor(req)));
export const postCancel = h((req) => co.cancel(req.member, v(req).body, actor(req)));
export const getAccess = h((req) => me.accessFor(req.member, v(req).query.path));
export const getLibrary = h((req) => me.library(req.member));

// ----- admin -----
export const adminOverview = h((req) => billing.overview(req.query));
export const adminApprovalsCount = h(() => billing.approvalsCount());
export const adminPlanOrder = h((req) => plans.orderPlans(v(req).body.ids, actor(req)));
export const adminSegments = h(() => members.listSegments());
export const adminSegmentCreate = h((req) => members.createSegment(v(req).body, actor(req)), 201);
export const adminSegmentDelete = h((req) => members.deleteSegment(v(req).params.id, actor(req)));
export const adminGstin = h((req) => members.lookupGstin(req.query.gstin));
export const adminChangePlanQuote = h((req) => members.changePlanQuote(req.params.id, req.query));
export const adminSendReset = h((req) => members.sendPasswordReset(v(req).params.id, actor(req)));
export const adminResendWelcome = h((req) => members.resendWelcome(v(req).params.id, actor(req)));
export const postResume = h((req) => co.resume(req.member, actor(req)));
export const postAutoRenew = h((req) => co.setAutoRenew(req.member, v(req).body.enabled, actor(req)).then((subscription) => ({ subscription })));

export const adminPlans = h((req) => plans.listPlans(v(req).query));
export const adminPlanCreate = h((req) => plans.createPlan(v(req).body, actor(req)), 201);
export const adminPlanGet = h((req) => plans.getPlan(v(req).params.id));
export const adminPlanUpdate = h((req) => plans.updatePlan(v(req).params.id, v(req).body, actor(req)));
export const adminPlanDelete = h((req) => plans.deletePlan(v(req).params.id, actor(req)));
export const adminPlanArchive = h((req) => plans.archivePlan(v(req).params.id, actor(req), v(req).body));
export const adminPriceCreate = h((req) => plans.addPrice(v(req).params.id, v(req).body, actor(req)), 201);
export const adminPriceUpdate = h((req) => plans.updatePrice(v(req).params.id, v(req).body, actor(req)));
export const adminPriceDelete = h((req) => plans.removePrice(v(req).params.id, actor(req)));
export const adminBenefits = h((req) => plans.setBenefits(v(req).params.id, v(req).body, actor(req)));
export const adminPlanFieldGroups = h((req) => plans.setFieldGroups(v(req).params.id, v(req).body, actor(req)));
export const adminPlanAccessRules = h((req) => plans.setAccessRules(v(req).params.id, v(req).body, actor(req)));

export const adminMembers = h((req) => members.listMembers(v(req).query));
export const adminMemberCreate = h((req) => members.createMember(v(req).body, actor(req)), 201);
export const adminMemberGet = h((req) => members.getMember(v(req).params.id));
export const adminMemberUpdate = h((req) => members.updateMember(v(req).params.id, v(req).body, actor(req)));
export const adminMemberExtend = h((req) => members.extend(v(req).params.id, v(req).body, actor(req)));
export const adminMemberChangePlan = h((req) => members.changePlan(v(req).params.id, v(req).body, actor(req)));
export const adminMemberSuspend = h((req) => members.suspend(v(req).params.id, v(req).body.reason, actor(req)));
export const adminMemberReactivate = h((req) => members.reactivate(v(req).params.id, actor(req)));
export const adminMemberCancel = h((req) => members.cancelMember(v(req).params.id, v(req).body, actor(req)));
export const adminMemberRecordPayment = h((req) => members.recordPayment(v(req).params.id, v(req).body, actor(req)), 201);
export const adminMemberNotes = h((req) => members.setNotes(v(req).params.id, v(req).body.notes, actor(req)));
export const adminContactList = h((req) => members.adminContacts(v(req).params.id).then((items) => ({ items })));
export const adminContactCreate = h((req) => members.adminAddContact(v(req).params.id, v(req).body, actor(req)), 201);
export const adminContactUpdate = h((req) => members.adminUpdateContact(v(req).params.id, v(req).params.cid, v(req).body, actor(req)));
export const adminContactDelete = h((req) => members.adminRemoveContact(v(req).params.id, v(req).params.cid, actor(req)));
export const adminMemberActivity = h((req) => members.activity(v(req).params.id, v(req).query));
export const adminMemberBulk = h((req) => members.bulk(v(req).body, actor(req)));
export const adminImportPreview = h((req) => members.importPreview(v(req).body));
export const adminImportCommit = h((req) => members.importCommit(v(req).body, actor(req)), 201);
export const adminMemberExport = async (req, res, next) => {
  try {
    const csv = await members.exportMembers(v(req).query, actor(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="members.${v(req).query.format === 'xlsx' ? 'xlsx.csv' : 'csv'}"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

export const adminApprovals = h((req) => billing.listApprovals(v(req).query));
export const adminApprovalGet = h((req) => billing.getApproval(v(req).params.subscriptionId));
export const adminApprove = h((req) => billing.approve(v(req).params.subscriptionId, actor(req)));
export const adminReject = h((req) => billing.reject(v(req).params.subscriptionId, v(req).body, actor(req)));

export const adminPayments = h((req) => billing.listPayments(v(req).query));
export const adminPaymentGet = h((req) => billing.getPayment(v(req).params.id));
export const adminPaymentVerify = h((req) => billing.verifyPayment(v(req).params.id, actor(req)));
export const adminPaymentReject = h((req) => billing.rejectPayment(v(req).params.id, v(req).body.reason, actor(req)));
export const adminPaymentRefund = h((req) => billing.refundPayment(v(req).params.id, v(req).body.amount, actor(req)));

export const adminInvoices = h((req) => billing.listInvoices(v(req).query));
export const adminInvoiceGet = h((req) => billing.getInvoice(v(req).params.id));
export const adminInvoiceVoid = h((req) => billing.voidOne(v(req).params.id, v(req).body.reason, actor(req)));

export const adminProviders = h((req) => providers.listProviders(v(req).query));
export const adminProviderCreate = h((req) => providers.createProvider(v(req).body, actor(req)), 201);
export const adminProviderGet = h((req) => providers.getProvider(v(req).params.id));
export const adminProviderUpdate = h((req) => providers.updateProvider(v(req).params.id, v(req).body, actor(req)));
export const adminProviderDelete = h((req) => providers.removeProvider(v(req).params.id, actor(req)));
export const adminProviderTest = h((req) => providers.testProvider(v(req).params.id, actor(req)));
export const adminProviderAction = (action) => h((req) => providers.setProviderStatus(v(req).params.id, action, actor(req)));
export const adminProviderOrder = h((req) => providers.reorderProviders(v(req).body.ids, actor(req)));

export const adminGroups = h(() => fields.listGroups().then((items) => ({ items, presets: PRESET_KEYS })));
export const adminPresets = h(() => fields.listPresets().then((items) => ({ items })));
export const adminGroupCreate = h((req) => fields.createGroup(v(req).body, actor(req)), 201);
export const adminGroupUpdate = h((req) => fields.updateGroup(v(req).params.id, v(req).body, actor(req)));
export const adminGroupDelete = h((req) => fields.removeGroup(v(req).params.id, actor(req)));
export const adminFieldCreate = h((req) => fields.addField(v(req).params.id, v(req).body, actor(req)), 201);
export const adminFieldUpdate = h((req) => fields.updateField(v(req).params.id, v(req).body, actor(req)));
export const adminFieldDelete = h((req) => fields.removeField(v(req).params.id, actor(req)));
export const adminPresetApply = h((req) => fields.applyPreset(v(req).body.preset, actor(req)), 201);

export const adminSettingsGet = h(() => getSettings());
export const adminSettingsPut = h((req) => putSettings(v(req).body));

// ----- admin: coupons -----
export const adminCoupons = h((req) => coupons.listCoupons(v(req).query));
export const adminCouponCreate = h((req) => coupons.createCoupon(v(req).body, actor(req)), 201);
export const adminCouponUpdate = h((req) => coupons.updateCoupon(v(req).params.id, v(req).body, actor(req)));
export const adminCouponDelete = h((req) => coupons.deleteCoupon(v(req).params.id, actor(req)));
