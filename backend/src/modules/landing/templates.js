import { blocks } from '../projects/starter-site.js';

// Starting points for "New Landing Page". Each builds the page body (Puck content) for a slug.
// A landing page is one focused page: no site menu, one clear call to action.
const { block, hero, heading, text, cards, spacer } = blocks;

const cta = (s, label, href = '#contact') => block(s, 'Button', { label, href, variant: 'primary' });

// The enquiry form a template's ContactForm block reads; created together with the page.
export const formSlugFor = (slug) => `${slug}-enquiry`;

export const LANDING_TEMPLATES = {
  blank: {
    name: 'Blank',
    description: 'Start from an empty page.',
    body: () => [],
  },
  'lead-gen': {
    name: 'Lead generation',
    description: 'Headline, three benefits and an enquiry form.',
    hasForm: true,
    body: (s) => [
      hero(
        s,
        'Your headline here',
        'One sentence on what you offer and who it is for.',
        'Get started',
        '#contact'
      ),
      cards(s, 'Why choose us', 'Three reasons visitors should act now.', [
        '⚡ | Fast | Describe your first benefit.',
        '✅ | Simple | Describe your second benefit.',
        '🔒 | Trusted | Describe your third benefit.',
      ]),
      spacer(s),
      // The hero button points at #contact, the anchor of this form block.
      block(s, 'ContactForm', {
        formSlug: formSlugFor(s),
        anchor: 'contact',
        title: 'Ready to talk?',
      }),
    ],
  },
  'product-launch': {
    name: 'Product launch',
    description: 'Announce a product with features, details and a buy or sign-up button.',
    body: (s) => [
      hero(s, 'Introducing your product', 'The short story of why it exists.', 'Buy now', 'mailto:hello@example.com'),
      cards(s, 'Features', 'What makes it different.', [
        '🚀 | Feature one | Describe it here.',
        '🎯 | Feature two | Describe it here.',
        '💡 | Feature three | Describe it here.',
      ]),
      spacer(s),
      heading(s, 'How it works'),
      text(s, 'Explain the steps in two or three sentences.'),
      cta(s, 'Sign up', 'mailto:hello@example.com'),
    ],
  },
};

export const TEMPLATE_KEYS = Object.keys(LANDING_TEMPLATES);

export const listTemplates = () =>
  TEMPLATE_KEYS.map((key) => ({
    key,
    name: LANDING_TEMPLATES[key].name,
    description: LANDING_TEMPLATES[key].description,
  }));

// Puck needs a unique id on every block.
export const buildLandingData = (templateKey, slug, title) => ({
  root: { props: { title } },
  content: LANDING_TEMPLATES[templateKey].body(slug).map((b, i) => ({
    ...b,
    props: { ...b.props, id: `${slug}-${b.type}-${i}` },
  })),
  zones: {},
});
