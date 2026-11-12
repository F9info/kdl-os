// Starting points for "New Landing Page". Each builds the page body (Puck content) for a slug.
// A landing page is one focused page: no site menu, one clear call to action. Every template is made
// of the Landing block pack (frontend/src/frontend/blocks/packs/landing): gradient heroes, round photo
// frames, rich display fonts. Every text, picture, palette and font stays editable in the editor.
// Pictures are bundled with the app (frontend/public/landing-templates/photos), not hot-linked.

// The enquiry form a template's LandingForm block reads; created together with the page.
export const formSlugFor = (slug) => `${slug}-enquiry`;

const photo = (name) => `/landing-templates/photos/${name}.jpg`;
const faces = (...names) => names.map(photo).join('\n');

const block = (slug, type, name, props) => ({ type, props: { id: `${slug}-${name}`, ...props } });

// Shared look of one template: a palette and a font pair, applied to every block.
const looks = (palette, font) => ({ palette, font });

const hero = (s, look, props) => block(s, 'LandingHero', 'hero', { ...look, ...props });
const stats = (s, look, rows) => block(s, 'LandingStats', 'stats', { ...look, stats: rows.join('\n') });
const benefits = (s, look, props) =>
  block(s, 'LandingBenefits', 'benefits', {
    ...look,
    columns: '3',
    tone: 'light',
    ...props,
    items: props.items.join('\n'),
  });
const showcase = (s, look, props) =>
  block(s, 'LandingShowcase', 'showcase', {
    ...look,
    reverse: false,
    ctaLabel: '',
    ctaHref: '',
    ...props,
    bullets: props.bullets.join('\n'),
  });
const steps = (s, look, props) =>
  block(s, 'LandingSteps', 'steps', { ...look, layout: 'cards', ...props, items: props.items.join('\n') });
const people = (s, look, props) =>
  block(s, 'LandingPeople', 'people', {
    ...look,
    columns: '3',
    subtitle: '',
    ...props,
    items: props.items.join('\n'),
  });
const quotes = (s, look, props) =>
  block(s, 'LandingTestimonials', 'quotes', { ...look, ...props, items: props.items.join('\n') });
const faq = (s, look, props) =>
  block(s, 'LandingFaq', 'faq', { ...look, ...props, items: props.items.join('\n') });
const pricing = (s, look, props) => block(s, 'LandingPricing', 'pricing', { ...look, ...props });
const portfolio = (s, look, props) => block(s, 'LandingPortfolio', 'portfolio', { ...look, ...props });
const clients = (s, look, props) => block(s, 'LandingClients', 'clients', { ...look, eyebrow: '', ...props });
const contact = (s, look, props) =>
  block(s, 'LandingContact', 'contact', { ...look, formSlug: formSlugFor(s), anchor: 'contact', ...props });
const cta = (s, look, props) => block(s, 'LandingCta', 'cta', { ...look, image: '', ...props });
// The footer holds no company details of its own: name, logo, description, contact and social links
// are read from Application Identity (Settings > Identity) when the page is shown.
const footer = (s, look, links) =>
  block(s, 'LandingFooter', 'footer', { ...brandOf(look), links: links.join('\n'), note: '' });
// Header and footer carry the company's own details (logo, name, phone, address, brand colours), all read from
// Application Identity at render time, so they use the "brand" colour set whatever look the sections have.
const brandOf = (look) => ({ palette: 'brand', font: look.font });
const header = (s, look, props = {}) =>
  block(s, 'LandingHeader', 'header', { ...brandOf(look), links: '', ctaHref: '#contact', ...props });
const form = (s, look, props) =>
  block(s, 'LandingForm', 'form', { ...look, formSlug: formSlugFor(s), anchor: 'contact', ...props });

export const LANDING_TEMPLATES = {
  blank: {
    name: 'Blank',
    description: 'Header and footer only. Add your own sections between them.',
    body: (s) => {
      const base = looks('brand', 'bricolage');
      return [header(s, base, { ctaLabel: '' }), footer(s, base, [])];
    },
  },

  // 1. Warm sunset gradient, round photo with rings, script headline (Lobster).
  'lead-gen': {
    name: 'Lead generation',
    description:
      'Sunset gradient, round photo with floating cards, script headline, quotes and an enquiry form.',
    hasForm: true,
    body: (s) => {
      const warm = looks('sunset', 'fraunces');
      return [
        header(s, warm, { ctaLabel: 'Get a free quote' }),
        hero(s, looks('sunset', 'lobster'), {
          variant: '1',
          eyebrow: 'Free quote in 24 hours',
          headline: 'We help small businesses win more customers, online',
          highlight: 'win more customers',
          subtitle:
            'One clear plan, a friendly expert beside you and results you can see. Tell us what you need and we will do the rest.',
          ctaLabel: 'Get my free quote',
          ctaHref: '#contact',
          secondaryLabel: 'See how it works',
          secondaryHref: '#contact',
          image: photo('hero-laptop'),
          avatars: faces('p1', 'p2', 'p3', 'p4'),
          proofText: '2,500+ happy customers',
          badgeValue: '4.9 / 5',
          badgeLabel: 'Average customer rating',
          noteTitle: 'Priya booked her call',
          noteText: 'Just now',
          chartTitle: '',
        }),
        stats(s, warm, [
          '2,500+|Happy customers',
          '98%|Would recommend us',
          '24h|Average reply time',
          '12 yrs|Of experience',
        ]),
        benefits(s, warm, {
          eyebrow: 'Why customers choose us',
          title: 'Three reasons people get in touch today',
          subtitle: 'Simple, honest and built around you.',
          items: [
            '⚡ | Fast to start | Tell us what you need and get a clear answer within a day.',
            '💎 | Simple pricing | Fixed, honest prices. No hidden fees and no surprises.',
            '🤝 | Real support | A real person looks after you, before and after you buy.',
          ],
        }),
        showcase(s, warm, {
          eyebrow: 'How we work',
          title: 'A clear plan before we start, honest updates all the way',
          text: 'You always know what is happening, what it costs and what comes next.',
          bullets: [
            'A free call to understand your goals',
            'A written plan with a fixed price',
            'Weekly updates, in plain words',
            'Support whenever you need it',
          ],
          image: photo('team-desk'),
          ctaLabel: 'Book a free call',
          ctaHref: '#contact',
        }),
        quotes(s, warm, {
          eyebrow: 'Loved by customers',
          title: 'What our customers say',
          items: [
            `Setup took one afternoon and the results showed up in the first week. Easily the best decision we made this year.|Priya S.|Operations lead|${photo('p3')}`,
            `Clear pricing and quick answers. It is the easiest supplier we have ever worked with.|Daniel M.|Founder|${photo('p2')}`,
            `They listened first, then delivered exactly what we asked for. I would recommend them to anyone.|Asha R.|Marketing manager|${photo('p5')}`,
          ],
        }),
        form(s, warm, {
          eyebrow: 'Get your free quote',
          title: 'Tell us what you need',
          subtitle: 'Leave your details and we will reply within a day.',
        }),
        footer(s, warm, ['Get a free quote|#contact', 'Back to top|#']),
      ];
    },
  },

  // 2. Midnight violet, glowing photo card, bold modern headline.
  'product-launch': {
    name: 'Product launch',
    description:
      'Dark violet hero with a glowing picture, feature cards, how it works, numbers, questions and a sign-up form.',
    hasForm: true,
    body: (s) => {
      const night = looks('violet', 'bricolage');
      return [
        header(s, night, { ctaLabel: 'Join the early list' }),
        hero(s, night, {
          variant: '4',
          eyebrow: 'Launching this spring',
          headline: 'The smarter way to run your work, all in one place',
          highlight: 'smarter way',
          subtitle:
            'Be one of the first to try it and help shape what we build next. Early members get lifetime perks.',
          ctaLabel: 'Join the early list',
          ctaHref: '#contact',
          secondaryLabel: 'Watch the demo',
          secondaryHref: '#',
          image: photo('launch-glow'),
          avatars: faces('p1', 'p6', 'p4', 'p3'),
          proofText: '10,000+ on the waiting list',
          badgeValue: '10K+',
          badgeLabel: 'On the waiting list',
          noteTitle: 'Beta rating',
          noteText: '4.9 out of 5',
          chartTitle: '',
        }),
        benefits(s, night, {
          tone: 'dark',
          eyebrow: 'Everything in one place',
          title: 'Built for people who want results',
          subtitle: 'Not another thing to manage. Just the features you actually use.',
          items: [
            '🚀 | Launch in minutes | Go from idea to live without waiting on anyone.',
            '🎯 | Made for focus | Only the tools you use, nothing in the way.',
            '📈 | See what works | Clear numbers that show what to do next.',
            '🔗 | Works with your tools | Connect the apps you already use.',
            '🛡️ | Secure by default | Your data stays yours, always encrypted.',
            '💬 | Real human help | Chat with the team that built it.',
          ],
        }),
        showcase(s, night, {
          eyebrow: 'Made for teams',
          title: 'Everyone on the same page, from day one',
          text: 'Share progress, hand over work and stay in sync without a single extra meeting.',
          bullets: [
            'Invite your team in seconds',
            'See who is working on what',
            'Never lose track of a task again',
          ],
          image: photo('team-work'),
          reverse: true,
        }),
        steps(s, night, {
          eyebrow: 'Simple process',
          title: 'Up and running in three steps',
          subtitle: 'No setup calls. No training needed.',
          items: [
            '📝 | Sign up | Create your account in under a minute.',
            '⚙️ | Set it up | Answer a few questions and we do the rest.',
            '🚀 | Go live | Share it with the world and watch it grow.',
          ],
        }),
        stats(s, night, [
          '10K+|On the waiting list',
          '4.9/5|Beta rating',
          '30 days|Money-back promise',
          '24/7|Support',
        ]),
        faq(s, night, {
          eyebrow: 'Good to know',
          title: 'Questions, answered',
          items: [
            'When does it launch?|We are opening in waves. Join the list and you will get an invite first.',
            'How much will it cost?|There will be a free plan. Paid plans start with a 30-day money-back promise.',
            'Can I try it before I pay?|Yes. Everyone on the early list gets a free trial.',
          ],
        }),
        cta(s, night, {
          title: 'Be first in line',
          text: 'Join the early list and get your invite before everyone else.',
          buttonLabel: 'Join the early list',
          buttonHref: '#contact',
        }),
        form(s, night, {
          eyebrow: 'Early access',
          title: 'Join the early list',
          subtitle: 'Leave your details and we will send your invite first.',
        }),
        footer(s, night, ['Join the early list|#contact', 'Back to top|#']),
      ];
    },
  },

  // 3. Fresh aurora gradient, centered headline over a wide photo, elegant serif (Playfair).
  event: {
    name: 'Event or webinar',
    description:
      'Aurora gradient, centered headline over a wide photo, agenda, speakers and a seat-booking form.',
    hasForm: true,
    body: (s) => {
      const fresh = looks('aurora', 'playfair');
      return [
        header(s, fresh, { ctaLabel: 'Reserve your seat' }),
        hero(s, fresh, {
          variant: '2',
          eyebrow: 'Saturday 14 March · Hyderabad and online',
          headline: 'Grow Together Summit 2027: one day to meet, learn and build',
          highlight: 'Grow Together',
          subtitle:
            'Twelve speakers, hands-on workshops and a room full of people building things. Free to attend, seats are limited.',
          ctaLabel: 'Reserve your seat',
          ctaHref: '#contact',
          secondaryLabel: '',
          secondaryHref: '#',
          image: photo('event-speaker'),
          avatars: faces('p3', 'p2', 'p5', 'p4'),
          proofText: '300 seats · 214 already booked',
          badgeValue: '12',
          badgeLabel: 'Expert speakers',
          noteTitle: 'Free entry',
          noteText: 'Limited seats',
          chartTitle: '',
        }),
        stats(s, fresh, [
          '1 day|Of talks and workshops',
          '12|Expert speakers',
          '300|Seats available',
          'Free|To attend',
        ]),
        steps(s, fresh, {
          layout: 'list',
          eyebrow: 'The day',
          title: "What's on the agenda",
          subtitle: 'A full day, in four parts.',
          items: [
            '10:00 | Welcome and keynote | Where the industry is going next, and what it means for you.',
            '11:30 | Hands-on workshops | Pick a track and build something you can use on Monday.',
            '13:00 | Lunch and networking | Meet speakers and other attendees over lunch.',
            '14:30 | Panel and Q&A | Ask the speakers anything. We close by 17:00.',
          ],
        }),
        people(s, fresh, {
          eyebrow: 'On stage',
          title: 'Meet the speakers',
          items: [
            `Dr. Meera Rao|Keynote · Head of Research|Twenty years turning research into products people use.|${photo('p3')}`,
            `Karan Mehta|Workshop lead · Engineering|Builds tools that teams enjoy using every day.|${photo('p2')}`,
            `Sana Iqbal|Panel host · Community|Connects founders, makers and the people who back them.|${photo('p5')}`,
          ],
        }),
        showcase(s, fresh, {
          eyebrow: 'Hands-on',
          title: 'Workshops you can use on Monday',
          text: 'Small groups, real problems and a speaker at your table.',
          bullets: [
            'Pick one of three tracks',
            'Bring your laptop and your questions',
            'Leave with something working',
          ],
          image: photo('event-workshop'),
          reverse: true,
        }),
        form(s, fresh, {
          eyebrow: 'Join us',
          title: 'Reserve your seat',
          subtitle: 'It takes a minute. We will email your ticket.',
        }),
        footer(s, fresh, ['Reserve your seat|#contact', 'Back to top|#']),
      ];
    },
  },

  // 4. Hot blaze gradient, dashboard card, playful script headline.
  offer: {
    name: 'Special offer',
    description: 'Hot orange-to-magenta hero with a savings card, steps, quotes, questions and a claim form.',
    hasForm: true,
    body: (s) => {
      const hot = looks('blaze', 'bricolage');
      return [
        header(s, hot, { ctaLabel: 'Claim your offer' }),
        hero(s, looks('blaze', 'lobster'), {
          variant: '3',
          eyebrow: 'Limited time · 14 days left',
          headline: 'Spring sale: 20% off everything we offer',
          highlight: '20% off',
          subtitle:
            'Claim your discount now. No setup fees, cancel any time and a 30-day money-back promise.',
          ctaLabel: 'Claim my offer',
          ctaHref: '#contact',
          secondaryLabel: '',
          secondaryHref: '#',
          image: '',
          avatars: faces('p5', 'p2', 'p3', 'p1'),
          proofText: '1,200 people claimed it',
          badgeValue: '-20%',
          badgeLabel: 'Off every plan',
          noteTitle: 'Offer ends soon',
          noteText: '14 days left',
          chartTitle: 'Your savings',
        }),
        stats(s, hot, [
          '20%|Off every plan',
          '14 days|Until the offer ends',
          '0|Setup fees',
          '30 days|Money back',
        ]),
        steps(s, hot, {
          eyebrow: 'Claim it in a minute',
          title: 'Three steps to your discount',
          subtitle: 'No code to copy. We take the 20% off for you.',
          items: [
            '📝 | Tell us about you | Fill in the short form below.',
            '📞 | We call you back | A friendly person confirms what you need.',
            '🎁 | Enjoy your discount | The 20% is taken off automatically.',
          ],
        }),
        benefits(s, hot, {
          eyebrow: 'What you get',
          title: 'Everything is included',
          subtitle: 'The offer applies to every plan.',
          items: [
            '⭐ | Full access | Every feature, no limits during the offer.',
            '🤝 | Priority support | Skip the queue with a direct line to the team.',
            '🔁 | Cancel any time | No contracts. Leave whenever you like.',
          ],
        }),
        quotes(s, hot, {
          eyebrow: 'Happy customers',
          title: 'People who already claimed it',
          items: [
            `Best value I have found. Two minutes to claim and the team called me back the same day.|Neha K.|Studio owner|${photo('p5')}`,
            `I was not sure at first, but the money-back promise made it easy to try. Glad I did.|Rahul T.|Shop owner|${photo('p2')}`,
            `Honest offer, no tricks. The discount was exactly what they said it would be.|Anita D.|Consultant|${photo('p3')}`,
          ],
        }),
        faq(s, hot, {
          eyebrow: 'Good to know',
          title: 'Before you claim',
          items: [
            'Who can claim the offer?|Anyone who requests it before the offer ends.',
            'Can I use it with other discounts?|The offer cannot be combined with other discounts.',
            'What happens when the offer ends?|Prices return to normal. Claim now to lock in 20% off.',
          ],
        }),
        form(s, hot, {
          eyebrow: 'Last step',
          title: 'Claim your 20% off',
          subtitle: 'Fill in the form and we will call you back.',
        }),
        footer(s, hot, ['Claim your offer|#contact', 'Back to top|#']),
      ];
    },
  },

  // ---- Demo pages seeded when the Frontend module is enabled (Business, SaaS, Agency, Startup). ----
  // Each uses a different palette, font and a different design (variant) of every section.
  business: {
    name: 'Business / Corporate',
    description: 'Corporate site: hero, about, services, why choose us, statistics, testimonials, FAQ and contact.',
    hasForm: true,
    body: (s) => {
      const l = looks('ocean', 'fraunces');
      return [
        header(s, l, { ctaLabel: 'Contact us' }),
        hero(s, l, {
          variant: '1', eyebrow: 'Trusted by 500+ companies', headline: 'Solutions that move your business forward',
          highlight: 'move your business forward',
          subtitle: 'Strategy, delivery and support from one experienced team, so you can focus on running the business.',
          ctaLabel: 'Talk to an expert', ctaHref: '#contact', secondaryLabel: 'Our services', secondaryHref: '#contact',
          image: photo('team-work'), avatars: faces('p1', 'p2', 'p3'), proofText: '500+ clients served',
          badgeValue: '18 yrs', badgeLabel: 'Of experience', noteTitle: '', noteText: '', chartTitle: '',
        }),
        showcase(s, l, {
          variant: '1', eyebrow: 'About us', title: 'A partner you can rely on',
          text: 'We have helped companies of every size plan, build and grow for almost two decades.',
          bullets: ['Dedicated account manager', 'Transparent reporting every month', 'Local team, global standards'],
          image: photo('team-desk'), ctaLabel: 'Meet the team', ctaHref: '#contact',
        }),
        benefits(s, l, {
          variant: '1', eyebrow: 'Services', title: 'What we do for you', subtitle: 'Everything you need, under one roof.',
          items: ['📊 | Consulting | Clear advice on strategy, operations and growth.', '🛠️ | Implementation | We build and roll out the solution with your team.', '🎧 | Support | Fast, friendly help whenever you need it.'],
        }),
        benefits(s, l, {
          variant: '2', tone: 'dark', columns: '4', eyebrow: 'Why choose us', title: 'Four reasons clients stay',
          subtitle: '', items: ['🏆 | Proven results | Measurable outcomes on every project.', '🔒 | Secure | Your data is protected end to end.', '⏱️ | On time | We keep the dates we promise.', '💬 | Open | Plain-language updates, no jargon.'],
        }),
        stats(s, l, ['500+|Clients served', '18|Years in business', '97%|Client retention', '40|Team members']),
        clients(s, l, { variant: '4', title: 'Trusted by teams at', items: 'Acme\nGlobex\nInitech\nUmbrella\nHooli' }),
        quotes(s, l, {
          variant: '1', eyebrow: 'Testimonials', title: 'What our clients say',
          items: [`They understood our business quickly and delivered on every promise.|Rahul K.|Managing director|${photo('p2')}`, `Professional, responsive and genuinely helpful from day one.|Neha T.|Operations head|${photo('p3')}`, `Our best supplier relationship in ten years.|Vikram S.|CEO|${photo('p6')}`],
        }),
        faq(s, l, {
          variant: '1', eyebrow: 'FAQ', title: 'Questions we hear often',
          items: ['How do we get started?|Send us a message and we will book a free discovery call.', 'How long does a project take?|Most projects run four to twelve weeks, depending on scope.', 'Do you offer support after launch?|Yes. Every project includes 90 days of free support.'],
        }),
        contact(s, l, { variant: '1', eyebrow: 'Contact', title: 'Let us talk about your project', subtitle: 'Leave your details and we will reply within a day.', address: '12 Park Avenue, Your City', phone: '+91 98765 43210', email: 'hello@yourcompany.com', hours: 'Mon to Fri, 9am to 6pm' }),
        footer(s, l, ['About|#', 'Services|#', 'Contact|#contact']),
      ];
    },
  },

  saas: {
    name: 'SaaS / Technology',
    description: 'Software product: hero, features, how it works, screenshots, pricing, testimonials, FAQ and call to action.',
    hasForm: true,
    body: (s) => {
      const l = looks('violet', 'bricolage');
      return [
        header(s, l, { ctaLabel: 'Start free trial' }),
        hero(s, l, {
          variant: '2', eyebrow: 'New: AI reports', headline: 'The easiest way to run your team’s work', highlight: 'run your team’s work',
          subtitle: 'Plan, track and ship in one place. Set up in minutes, loved by teams of every size.',
          ctaLabel: 'Start free trial', ctaHref: '#contact', secondaryLabel: 'See how it works', secondaryHref: '#contact',
          image: photo('launch-glow'), avatars: faces('p1', 'p4', 'p5'), proofText: '12,000 teams', badgeValue: '4.9 / 5',
          badgeLabel: 'On review sites', noteTitle: '', noteText: '', chartTitle: 'Weekly progress',
        }),
        benefits(s, l, {
          variant: '3', tone: 'light', eyebrow: 'Features', title: 'Everything your team needs', subtitle: 'Powerful, yet simple.',
          items: ['✅ | Tasks and boards | Organise work your way.', '📈 | Live reports | See progress at a glance.', '🔗 | Integrations | Connect the tools you already use.'],
        }),
        steps(s, l, {
          eyebrow: 'How it works', title: 'Up and running in three steps', subtitle: '',
          items: ['📝 | Sign up | Create your workspace in a minute.', '👥 | Invite your team | Add people with one link.', '🚀 | Start shipping | Track everything in one place.'],
        }),
        showcase(s, l, {
          variant: '2', reverse: true, eyebrow: 'Product tour', title: 'A dashboard you will actually enjoy',
          text: 'Every project, deadline and update on one clean screen.',
          bullets: ['Drag-and-drop boards', 'Automatic weekly summaries', 'Works on web and mobile'], image: photo('hero-laptop'), ctaLabel: '', ctaHref: '',
        }),
        pricing(s, l, {
          variant: '3', eyebrow: 'Pricing', title: 'Simple plans for every team', subtitle: 'Cancel any time.',
          items: [
            'Starter|Free|forever|Up to 5 people; 3 projects; Community support|Get started|#contact',
            'Team|₹799|per user / month|Unlimited projects; Live reports; Integrations|Start free trial|#contact|popular',
            'Business|Custom|per year|Single sign-on; Audit logs; Priority support|Talk to sales|#contact',
          ].join('\n'),
        }),
        quotes(s, l, {
          variant: '2', eyebrow: 'Loved by teams', title: 'Hear from our customers',
          items: [`We cut our status meetings in half in the first month.|Anita D.|Product manager|${photo('p5')}`, `Set up in an afternoon. The whole team adopted it.|Imran Q.|CTO|${photo('p2')}`],
        }),
        faq(s, l, {
          variant: '3', eyebrow: 'FAQ', title: 'Your questions, answered',
          items: ['Is there a free plan?|Yes. Starter is free for up to five people.', 'Can I import my data?|Yes. Upload a CSV or connect your old tool.', 'Is my data safe?|Data is encrypted in transit and at rest.'],
        }),
        cta(s, l, { variant: '1', title: 'Ready to get organised?', text: 'Start your 14-day free trial. No card needed.', buttonLabel: 'Start free trial', buttonHref: '#contact' }),
        form(s, l, { eyebrow: 'Free trial', title: 'Create your workspace', subtitle: 'Leave your email and we will send your trial link.' }),
        footer(s, l, ['Features|#', 'Pricing|#', 'Start free trial|#contact']),
      ];
    },
  },

  agency: {
    name: 'Agency / Portfolio',
    description: 'Creative agency: hero, about, portfolio, services, process, team, testimonials and contact.',
    hasForm: true,
    body: (s) => {
      const l = looks('blaze', 'playfair');
      return [
        header(s, l, { ctaLabel: 'Start a project' }),
        hero(s, l, {
          variant: '3', eyebrow: 'Design and development studio', headline: 'We craft brands people remember', highlight: 'brands people remember',
          subtitle: 'Strategy, design and websites for ambitious companies.', ctaLabel: 'See our work', ctaHref: '#contact',
          secondaryLabel: 'Start a project', secondaryHref: '#contact', image: photo('high-five'), avatars: faces('p3', 'p6'),
          proofText: '120+ projects', badgeValue: '9 awards', badgeLabel: 'Design awards', noteTitle: '', noteText: '', chartTitle: '',
        }),
        showcase(s, l, {
          variant: '3', eyebrow: 'About', title: 'Small team, big ideas', text: 'We are a studio of designers, developers and strategists who love good work.',
          bullets: ['Senior people on every project', 'Fixed-price proposals', 'Launch-ready in weeks'], image: photo('community'), ctaLabel: '', ctaHref: '',
        }),
        portfolio(s, l, {
          variant: '2', eyebrow: 'Portfolio', title: 'Selected work', subtitle: 'A few projects we are proud of.',
          items: [
            `Bloom Café|Brand and website|${photo('team-desk')}|#`,
            `Nova Fintech|App design|${photo('hero-laptop')}|#`,
            `Greenleaf|E-commerce|${photo('launch-glow')}|#`,
            `Harbor Hotels|Campaign|${photo('community')}|#`,
          ].join('\n'),
        }),
        benefits(s, l, {
          variant: '2', tone: 'light', columns: '3', eyebrow: 'Services', title: 'What we do', subtitle: '',
          items: ['🎨 | Branding | Logos, identity and guidelines.', '💻 | Web design | Fast, beautiful, easy to edit.', '📣 | Marketing | Campaigns that bring customers.'],
        }),
        steps(s, l, {
          layout: 'list', eyebrow: 'Our process', title: 'From hello to launch', subtitle: '',
          items: ['1 | Discover | We learn about your goals and audience.', '2 | Design | You review concepts and pick a direction.', '3 | Build | We develop, test and polish.', '4 | Launch | We go live and stay on hand.'],
        }),
        people(s, l, {
          eyebrow: 'Team', title: 'The people behind the work',
          items: [`Aarav Nair|Creative director|Leads brand and design.|${photo('p2')}`, `Diya Menon|Lead developer|Builds fast, accessible sites.|${photo('p3')}`, `Kabir Shah|Strategist|Turns goals into a plan.|${photo('p6')}`],
        }),
        quotes(s, l, {
          variant: '3', eyebrow: 'Kind words', title: 'Clients on working with us',
          items: [`They made our brand feel like us, only sharper.|Meera P.|Founder, Bloom Café|${photo('p5')}`],
        }),
        form(s, l, { eyebrow: 'Contact', title: 'Have a project in mind?', subtitle: 'Tell us about it and we will reply within two working days.' }),
        footer(s, l, ['Work|#', 'Services|#', 'Contact|#contact']),
      ];
    },
  },

  startup: {
    name: 'Startup / Product launch',
    description: 'Launch page: hero, product intro, features, benefits, how it works, plans, testimonials, FAQ and registration.',
    hasForm: true,
    body: (s) => {
      const l = looks('aurora', 'bricolage');
      return [
        header(s, l, { ctaLabel: 'Join the waitlist' }),
        hero(s, l, {
          variant: '4', eyebrow: 'Launching soon', headline: 'Meet the app that does the busywork for you', highlight: 'does the busywork',
          subtitle: 'Join the early list and be first to try it.', ctaLabel: 'Join the waitlist', ctaHref: '#contact',
          secondaryLabel: '', secondaryHref: '', image: photo('hero-laptop'), avatars: faces('p1', 'p2', 'p4'), proofText: '8,000 on the list',
          badgeValue: 'Q1', badgeLabel: 'Public launch', noteTitle: '', noteText: '', chartTitle: '',
        }),
        showcase(s, l, {
          variant: '1', eyebrow: 'The product', title: 'One app, one tap, done', text: 'We took the most tedious part of your week and made it automatic.',
          bullets: ['Connects in two minutes', 'No training needed', 'Works on any device'], image: photo('launch-glow'), ctaLabel: '', ctaHref: '',
        }),
        benefits(s, l, {
          variant: '4', tone: 'light', columns: '3', eyebrow: 'Features', title: 'Built to save you time', subtitle: '',
          items: ['⚡ | Instant | Results in seconds, not hours.', '🤖 | Smart | Learns how you work.', '🔔 | Reminders | Never miss a deadline.'],
        }),
        stats(s, l, ['8K+|On the waiting list', '4.9/5|Beta rating', '3 hrs|Saved each week', '0|Setup fees']),
        steps(s, l, {
          eyebrow: 'How it works', title: 'Three taps to done', subtitle: '',
          items: ['🔌 | Connect | Link your accounts.', '🎛️ | Choose | Pick what to automate.', '🎉 | Relax | We handle the rest.'],
        }),
        pricing(s, l, {
          variant: '2', eyebrow: 'Plans', title: 'Early-bird pricing', subtitle: 'Lock it in for life.',
          items: [
            'Early bird|₹299|per month|Everything included; Price locked forever|Join the waitlist|#contact|popular',
            'Pro|₹599|per month|Team sharing; Priority support|Join the waitlist|#contact',
          ].join('\n'),
        }),
        quotes(s, l, {
          variant: '4', eyebrow: 'Beta testers', title: 'What early users say',
          items: [`I got my Sunday evenings back.|Sara L.|Beta tester|${photo('p5')}`, `Does in a minute what took me an hour.|Dev P.|Beta tester|${photo('p2')}`],
        }),
        faq(s, l, {
          variant: '4', eyebrow: 'FAQ', title: 'Before you join',
          items: ['When does it launch?|Public launch is planned for next quarter.', 'Is it free?|Joining the list is free. Early-bird pricing applies at launch.'],
        }),
        form(s, l, { eyebrow: 'Registration', title: 'Reserve your spot', subtitle: 'We will email your invite as soon as your turn comes.' }),
        footer(s, l, ['Join the waitlist|#contact', 'Back to top|#']),
      ];
    },
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
