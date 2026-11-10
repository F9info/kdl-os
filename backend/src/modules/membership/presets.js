// The seven sector packs an admin can apply with one click. Fields are plain TEXT-ish defaults the
// admin can then edit; keys are stable so imports and filters keep working.
const t = (key, label, extra = {}) => ({ key, label, type: 'TEXT', ...extra });

export const PRESETS = {
  Business: {
    name: 'Business', icon: 'Briefcase', applies_to: 'ORGANISATION',
    fields: [t('industry', 'Industry'), t('employees', 'Number of employees', { type: 'NUMBER' }), t('website', 'Website', { type: 'URL' }), t('annual_turnover', 'Annual turnover'), t('year_established', 'Year established', { type: 'NUMBER' })],
  },
  Professional: {
    name: 'Professional', icon: 'UserCog', applies_to: 'INDIVIDUAL',
    fields: [t('profession', 'Profession', { required: true }), t('registration_no', 'Registration number', { is_unique: true }), t('experience_years', 'Years of experience', { type: 'NUMBER' }), t('qualification', 'Qualification'), t('linkedin', 'LinkedIn', { type: 'URL' })],
  },
  Education: {
    name: 'Education / Alumni', icon: 'Users', applies_to: 'INDIVIDUAL',
    fields: [t('institution', 'Institution'), t('course', 'Course'), t('batch_year', 'Batch / year of passing', { type: 'NUMBER' }), t('roll_no', 'Roll number')],
  },
  Community: {
    name: 'Community / NGO', icon: 'Users', applies_to: 'BOTH',
    fields: [t('occupation', 'Occupation'), t('volunteer_interest', 'Volunteer interests', { type: 'MULTISELECT', options: ['Events', 'Teaching', 'Fundraising', 'Outreach'] }), t('referred_by', 'Referred by')],
  },
  Residential: {
    name: 'Residential / RWA', icon: 'Building2', applies_to: 'INDIVIDUAL',
    fields: [t('flat_no', 'Flat / house number', { required: true }), t('block', 'Block / tower'), t('ownership', 'Ownership', { type: 'SELECT', options: ['Owner', 'Tenant'] }), t('vehicles', 'Vehicle numbers'), t('family_members', 'Family members', { type: 'NUMBER' })],
  },
  Club: {
    name: 'Club / Fitness', icon: 'Activity', applies_to: 'INDIVIDUAL',
    fields: [t('emergency_contact', 'Emergency contact', { type: 'PHONE' }), t('blood_group', 'Blood group', { type: 'SELECT', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] }), t('health_notes', 'Health notes', { type: 'TEXTAREA' }), t('fitness_goal', 'Goal')],
  },
  Documents: {
    name: 'Documents', icon: 'FileText', applies_to: 'BOTH',
    fields: [t('id_proof', 'ID proof', { type: 'FILE' }), t('address_proof', 'Address proof', { type: 'FILE' }), t('registration_certificate', 'Registration certificate', { type: 'FILE' })],
  },
};

export const PRESET_KEYS = Object.keys(PRESETS);
