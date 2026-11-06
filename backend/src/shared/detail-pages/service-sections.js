// Section Builder blocks for a service detail page, shared by every service entry through its one
// template: key numbers, what is included, how we work, FAQ and a closing call to action. Wording is
// generic on purpose (it is the shared layout, not one service's own copy); each block stays editable
// in the Section Builder.
const block = (typeKey, type, props) => ({ type, props: { id: `${typeKey}-${type}`, visible: true, ...props } });

export const SERVICE_SECTION_TYPES = [
  'ConstructionStatsStrip',
  'ConstructionWhyChooseUs',
  'ConstructionProcessTimeline',
  'ConstructionFAQ',
  'ConstructionQuoteCTA',
];

export function serviceSections(typeKey = 'service', contactHref = '/') {
  return [
    block(typeKey, 'ConstructionStatsStrip', {
      stat1Value: '10+',
      stat1Label: 'Years of Experience',
      stat2Value: '200+',
      stat2Label: 'Projects Delivered',
      stat3Value: '50+',
      stat3Label: 'Happy Clients',
      stat4Value: '98%',
      stat4Label: 'Client Satisfaction',
      background: 'dark',
      padding: 'md',
    }),
    block(typeKey, 'ConstructionWhyChooseUs', {
      sectionTitle: "What's Included",
      sectionSubtitle: 'Everything you need from the first call to a smooth handover.',
      point1Title: 'Dedicated Team',
      point1Description: 'A named lead and specialists who stay with your project from start to finish.',
      point2Title: 'Clear Pricing',
      point2Description: 'A written scope and a fixed quote, so there are no surprises on the invoice.',
      point3Title: 'On-Time Delivery',
      point3Description: 'Agreed milestones with regular progress updates and demos along the way.',
      point4Title: 'Ongoing Support',
      point4Description: 'Maintenance and quick help after launch, so you are never left on your own.',
      ctaLabel: 'Talk to Us',
      ctaHref: contactHref,
      padding: 'md',
      background: 'white',
    }),
    block(typeKey, 'ConstructionProcessTimeline', {
      sectionTitle: 'How We Work',
      sectionSubtitle: 'A simple, transparent process from first conversation to launch.',
      step1Title: 'Discovery',
      step1Description: 'We learn your goals, users and constraints before suggesting anything.',
      step2Title: 'Proposal',
      step2Description: 'You get a clear scope, timeline and price to approve.',
      step3Title: 'Design & Build',
      step3Description: 'We design, build and show progress in short, reviewable steps.',
      step4Title: 'Testing',
      step4Description: 'Every release is tested before it reaches your customers.',
      step5Title: 'Launch & Support',
      step5Description: 'We go live together and stay on hand for improvements and fixes.',
      padding: 'md',
      background: 'muted',
    }),
    block(typeKey, 'ConstructionFAQ', {
      sectionTitle: 'Frequently Asked Questions',
      faq1Question: 'How long does a typical project take?',
      faq1Answer: 'Most projects take between 4 and 12 weeks, depending on scope. We confirm a timeline in the proposal.',
      faq2Question: 'How is pricing decided?',
      faq2Answer: 'We quote against a written scope, either fixed price or by milestone, so you know the cost up front.',
      faq3Question: 'Can you work with our existing systems?',
      faq3Answer: 'Yes. We review what you have first and integrate with it wherever that makes sense.',
      faq4Question: 'Do you offer support after launch?',
      faq4Answer: 'Yes. We offer maintenance plans and respond quickly to issues after go-live.',
      padding: 'md',
    }),
    block(typeKey, 'ConstructionQuoteCTA', {
      headline: 'Ready to Get Started?',
      subtext: 'Tell us what you need and we will come back with a clear plan and quote within two working days.',
      ctaLabel: 'Request a Quote',
      ctaHref: contactHref,
      secondaryCtaLabel: '',
      secondaryCtaHref: '',
      phoneNumber: '',
      phoneLabel: '',
      background: 'dark',
    }),
  ];
}

// Puts the sections between the page body and the footer. Idempotent (a page that has them is left
// alone) and never touches the other blocks.
export function withServiceSections(data, typeKey, contactHref) {
  const content = data?.content;
  if (!Array.isArray(content) || content.some((b) => SERVICE_SECTION_TYPES.includes(b.type))) return data;
  const at = content.findIndex((b) => b.type === 'ConstructionFooter');
  const i = at < 0 ? content.length : at;
  return { ...data, content: [...content.slice(0, i), ...serviceSections(typeKey, contactHref), ...content.slice(i)] };
}
