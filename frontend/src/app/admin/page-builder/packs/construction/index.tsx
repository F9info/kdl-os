import type { Config } from '@puckeditor/core'
import type { ComponentPack } from '../types'

// ── shared helpers ────────────────────────────────────────────────────────────

const padY = { sm: 'py-8', md: 'py-14', lg: 'py-24' } as const
const wrap = 'mx-auto max-w-6xl px-4 md:px-8'

// ── per-component prop shapes ─────────────────────────────────────────────────

type ConstructionProps = {
  ConstructionHero: {
    headline: string
    subheadline: string
    ctaLabel: string
    ctaHref: string
    secondaryLabel: string
    secondaryHref: string
    backgroundImage: string
    overlay: boolean
  }
  ConstructionServicesGrid: {
    sectionTitle: string
    sectionSubtitle: string
    service1Title: string
    service1Description: string
    service2Title: string
    service2Description: string
    service3Title: string
    service3Description: string
    service4Title: string
    service4Description: string
    service5Title: string
    service5Description: string
    service6Title: string
    service6Description: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionProjectGallery: {
    sectionTitle: string
    sectionSubtitle: string
    project1Title: string
    project1Category: string
    project1Image: string
    project2Title: string
    project2Category: string
    project2Image: string
    project3Title: string
    project3Category: string
    project3Image: string
    project4Title: string
    project4Category: string
    project4Image: string
    project5Title: string
    project5Category: string
    project5Image: string
    project6Title: string
    project6Category: string
    project6Image: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionQuoteCTA: {
    headline: string
    subtext: string
    ctaLabel: string
    ctaHref: string
    phoneNumber: string
    phoneLabel: string
    background: 'dark' | 'accent' | 'muted'
  }
  ConstructionStatsStrip: {
    stat1Value: string
    stat1Label: string
    stat2Value: string
    stat2Label: string
    stat3Value: string
    stat3Label: string
    stat4Value: string
    stat4Label: string
    background: 'dark' | 'accent' | 'muted'
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionTeamCrew: {
    sectionTitle: string
    sectionSubtitle: string
    member1Name: string
    member1Role: string
    member1Image: string
    member2Name: string
    member2Role: string
    member2Image: string
    member3Name: string
    member3Role: string
    member3Image: string
    member4Name: string
    member4Role: string
    member4Image: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionCertificationsBadges: {
    sectionTitle: string
    sectionSubtitle: string
    badge1Label: string
    badge1Detail: string
    badge2Label: string
    badge2Detail: string
    badge3Label: string
    badge3Detail: string
    badge4Label: string
    badge4Detail: string
    badge5Label: string
    badge5Detail: string
    badge6Label: string
    badge6Detail: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionTestimonials: {
    sectionTitle: string
    quote1Text: string
    quote1Author: string
    quote1Company: string
    quote2Text: string
    quote2Author: string
    quote2Company: string
    quote3Text: string
    quote3Author: string
    quote3Company: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionProcessTimeline: {
    sectionTitle: string
    sectionSubtitle: string
    step1Title: string
    step1Description: string
    step2Title: string
    step2Description: string
    step3Title: string
    step3Description: string
    step4Title: string
    step4Description: string
    step5Title: string
    step5Description: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionWhyChooseUs: {
    sectionTitle: string
    sectionSubtitle: string
    point1Title: string
    point1Description: string
    point2Title: string
    point2Description: string
    point3Title: string
    point3Description: string
    point4Title: string
    point4Description: string
    ctaLabel: string
    ctaHref: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionSafetyRecord: {
    sectionTitle: string
    sectionSubtitle: string
    incidentFreeDays: string
    safetyRating: string
    trainedWorkers: string
    complianceNote: string
    padding: 'sm' | 'md' | 'lg'
    background: 'dark' | 'accent' | 'muted'
  }
}

// ── shared icon SVGs (inline, no external deps) ───────────────────────────────

function HardHatIcon() {
  return (
    <svg
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 2a8 8 0 0 1 8 8v1H4V10a8 8 0 0 1 8-8zM3 13h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2z"
      />
    </svg>
  )
}

function CheckShieldIcon() {
  return (
    <svg
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l7 3v5c0 5-3.5 9.74-7 11C8.5 20.74 5 16 5 11V6l7-3z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg className="w-5 h-5 fill-yellow-400 text-yellow-400" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.955a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.447a1 1 0 00-.364 1.118l1.287 3.955c.3.921-.755 1.688-1.54 1.118l-3.368-2.447a1 1 0 00-1.175 0l-3.368 2.447c-.784.57-1.838-.197-1.539-1.118l1.286-3.955a1 1 0 00-.364-1.118L2.063 9.382c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.951-.69L9.05 2.927z" />
    </svg>
  )
}

// ── components ────────────────────────────────────────────────────────────────

const typedComponents: Config<ConstructionProps>['components'] = {
  // 1. Hero section
  ConstructionHero: {
    label: 'Construction Hero',
    fields: {
      headline: { type: 'text' },
      subheadline: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      secondaryLabel: { type: 'text' },
      secondaryHref: { type: 'text' },
      backgroundImage: { type: 'text' },
      overlay: {
        type: 'radio',
        options: [
          { label: 'With overlay', value: true },
          { label: 'No overlay', value: false },
        ],
      },
    },
    defaultProps: {
      headline: 'Building Your Vision, On Time & On Budget',
      subheadline:
        'Award-winning general contractor serving residential and commercial clients across the region. Licensed, insured, and safety-certified.',
      ctaLabel: 'Get a Free Quote',
      ctaHref: '#quote',
      secondaryLabel: 'View Our Projects',
      secondaryHref: '#projects',
      backgroundImage: 'https://placehold.co/1600x800/1e293b/ffffff?text=Construction+Site',
      overlay: true,
    },
    render: ({
      headline,
      subheadline,
      ctaLabel,
      ctaHref,
      secondaryLabel,
      secondaryHref,
      backgroundImage,
      overlay,
    }) => (
      <section className="relative min-h-[480px] md:min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={backgroundImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
        {overlay && <div className="absolute inset-0 bg-slate-900/60" />}
        <div className="relative z-10 text-center px-4 md:px-8 py-16 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-5">
            {headline}
          </h1>
          <p className="text-base md:text-xl text-slate-200 max-w-2xl mx-auto mb-8">
            {subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {ctaLabel && (
              <a
                href={ctaHref}
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-7 py-3.5 text-white font-semibold hover:bg-orange-600 transition text-base"
              >
                {ctaLabel}
              </a>
            )}
            {secondaryLabel && (
              <a
                href={secondaryHref}
                className="inline-flex items-center justify-center rounded-lg border-2 border-white px-7 py-3.5 text-white font-semibold hover:bg-white/10 transition text-base"
              >
                {secondaryLabel}
              </a>
            )}
          </div>
        </div>
      </section>
    ),
  },

  // 2. Services grid
  ConstructionServicesGrid: {
    label: 'Services Grid',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      service1Title: { type: 'text' },
      service1Description: { type: 'textarea' },
      service2Title: { type: 'text' },
      service2Description: { type: 'textarea' },
      service3Title: { type: 'text' },
      service3Description: { type: 'textarea' },
      service4Title: { type: 'text' },
      service4Description: { type: 'textarea' },
      service5Title: { type: 'text' },
      service5Description: { type: 'textarea' },
      service6Title: { type: 'text' },
      service6Description: { type: 'textarea' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Our Services',
      sectionSubtitle:
        'From foundations to finishes — we handle every phase of your construction project.',
      service1Title: 'New Construction',
      service1Description:
        'Ground-up residential and commercial builds to your specifications and local codes.',
      service2Title: 'Renovations & Remodeling',
      service2Description:
        'Transform existing spaces with structural updates, expansions, and interior upgrades.',
      service3Title: 'Roofing & Waterproofing',
      service3Description:
        'Durable roofing installations, repairs, and waterproofing systems for all climates.',
      service4Title: 'Concrete & Foundations',
      service4Description:
        'Footings, slabs, retaining walls, and structural concrete poured to spec.',
      service5Title: 'Electrical & MEP',
      service5Description:
        'Full mechanical, electrical, and plumbing coordination with licensed subcontractors.',
      service6Title: 'Project Management',
      service6Description:
        'End-to-end oversight, scheduling, procurement, and quality control on every site.',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      service1Title,
      service1Description,
      service2Title,
      service2Description,
      service3Title,
      service3Description,
      service4Title,
      service4Description,
      service5Title,
      service5Description,
      service6Title,
      service6Description,
      padding,
      background,
    }) => {
      const services = [
        { title: service1Title, description: service1Description },
        { title: service2Title, description: service2Description },
        { title: service3Title, description: service3Description },
        { title: service4Title, description: service4Description },
        { title: service5Title, description: service5Description },
        { title: service6Title, description: service6Description },
      ].filter((s) => s.title)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto text-base md:text-lg">
                  {sectionSubtitle}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((s, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 p-6 hover:shadow-md transition bg-white"
                >
                  <div className="text-orange-500 mb-3">
                    <HardHatIcon />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-lg mb-2">{s.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 3. Project / Portfolio gallery
  ConstructionProjectGallery: {
    label: 'Project Gallery',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      project1Title: { type: 'text' },
      project1Category: { type: 'text' },
      project1Image: { type: 'text' },
      project2Title: { type: 'text' },
      project2Category: { type: 'text' },
      project2Image: { type: 'text' },
      project3Title: { type: 'text' },
      project3Category: { type: 'text' },
      project3Image: { type: 'text' },
      project4Title: { type: 'text' },
      project4Category: { type: 'text' },
      project4Image: { type: 'text' },
      project5Title: { type: 'text' },
      project5Category: { type: 'text' },
      project5Image: { type: 'text' },
      project6Title: { type: 'text' },
      project6Category: { type: 'text' },
      project6Image: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Our Work',
      sectionSubtitle:
        'A selection of completed projects across residential, commercial, and infrastructure verticals.',
      project1Title: 'Riverside Villas',
      project1Category: 'Residential',
      project1Image: 'https://placehold.co/600x400/475569/ffffff?text=Riverside+Villas',
      project2Title: 'Tech Park Phase 2',
      project2Category: 'Commercial',
      project2Image: 'https://placehold.co/600x400/334155/ffffff?text=Tech+Park+Phase+2',
      project3Title: 'Highway Bridge Rehab',
      project3Category: 'Infrastructure',
      project3Image: 'https://placehold.co/600x400/1e293b/ffffff?text=Bridge+Rehab',
      project4Title: 'School Expansion Wing',
      project4Category: 'Institutional',
      project4Image: 'https://placehold.co/600x400/0f172a/ffffff?text=School+Wing',
      project5Title: 'Industrial Warehouse',
      project5Category: 'Industrial',
      project5Image: 'https://placehold.co/600x400/1e3a5f/ffffff?text=Warehouse',
      project6Title: 'Rooftop Waterproofing',
      project6Category: 'Specialist',
      project6Image: 'https://placehold.co/600x400/14532d/ffffff?text=Rooftop+Waterproofing',
      padding: 'md',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      project1Title,
      project1Category,
      project1Image,
      project2Title,
      project2Category,
      project2Image,
      project3Title,
      project3Category,
      project3Image,
      project4Title,
      project4Category,
      project4Image,
      project5Title,
      project5Category,
      project5Image,
      project6Title,
      project6Category,
      project6Image,
      padding,
    }) => {
      const projects = [
        { title: project1Title, category: project1Category, image: project1Image },
        { title: project2Title, category: project2Category, image: project2Image },
        { title: project3Title, category: project3Category, image: project3Image },
        { title: project4Title, category: project4Category, image: project4Image },
        { title: project5Title, category: project5Category, image: project5Image },
        { title: project6Title, category: project6Category, image: project6Image },
      ].filter((p) => p.title)
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((p, i) => (
                <div
                  key={i}
                  className="group rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="p-4 bg-white">
                    <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">
                      {p.category}
                    </span>
                    <h3 className="font-semibold text-slate-900 mt-0.5">{p.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 4. Quote request CTA
  ConstructionQuoteCTA: {
    label: 'Quote Request CTA',
    fields: {
      headline: { type: 'text' },
      subtext: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      phoneNumber: { type: 'text' },
      phoneLabel: { type: 'text' },
      background: {
        type: 'select',
        options: [
          { label: 'Dark', value: 'dark' },
          { label: 'Accent (Orange)', value: 'accent' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      headline: 'Ready to Start Your Project?',
      subtext:
        'Get a detailed, no-obligation quote within 48 hours. Our estimators will assess your site and deliver a comprehensive scope of work.',
      ctaLabel: 'Request a Free Quote',
      ctaHref: '#contact',
      phoneNumber: '+91-98765-43210',
      phoneLabel: 'Or call us directly',
      background: 'dark',
    },
    render: ({ headline, subtext, ctaLabel, ctaHref, phoneNumber, phoneLabel, background }) => {
      const bgCls =
        background === 'dark'
          ? 'bg-slate-900 text-white'
          : background === 'accent'
            ? 'bg-orange-500 text-white'
            : 'bg-slate-100 text-slate-900'
      const btnCls =
        background === 'muted'
          ? 'bg-orange-500 text-white hover:bg-orange-600'
          : 'bg-white text-slate-900 hover:bg-slate-100'
      return (
        <section className={`${bgCls} py-16`}>
          <div className="mx-auto max-w-3xl px-4 md:px-8 text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">{headline}</h2>
            {subtext && (
              <p
                className={`mb-8 text-base md:text-lg ${background === 'muted' ? 'text-slate-600' : 'opacity-90'}`}
              >
                {subtext}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {ctaLabel && (
                <a
                  href={ctaHref}
                  className={`inline-flex rounded-lg px-8 py-3.5 font-semibold transition ${btnCls}`}
                >
                  {ctaLabel}
                </a>
              )}
              {phoneNumber && (
                <div
                  className={`text-sm ${background === 'muted' ? 'text-slate-600' : 'opacity-80'}`}
                >
                  <span className="block text-xs mb-0.5">{phoneLabel}</span>
                  <a
                    href={`tel:${phoneNumber}`}
                    className="font-semibold text-base hover:underline"
                  >
                    {phoneNumber}
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      )
    },
  },

  // 5. Stats / experience strip
  ConstructionStatsStrip: {
    label: 'Stats & Experience Strip',
    fields: {
      stat1Value: { type: 'text' },
      stat1Label: { type: 'text' },
      stat2Value: { type: 'text' },
      stat2Label: { type: 'text' },
      stat3Value: { type: 'text' },
      stat3Label: { type: 'text' },
      stat4Value: { type: 'text' },
      stat4Label: { type: 'text' },
      background: {
        type: 'select',
        options: [
          { label: 'Dark', value: 'dark' },
          { label: 'Accent (Orange)', value: 'accent' },
          { label: 'Muted', value: 'muted' },
        ],
      },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
    },
    defaultProps: {
      stat1Value: '25+',
      stat1Label: 'Years in Business',
      stat2Value: '850+',
      stat2Label: 'Projects Completed',
      stat3Value: '₹500 Cr+',
      stat3Label: 'Work Executed',
      stat4Value: '98%',
      stat4Label: 'Client Satisfaction',
      background: 'dark',
      padding: 'md',
    },
    render: ({
      stat1Value,
      stat1Label,
      stat2Value,
      stat2Label,
      stat3Value,
      stat3Label,
      stat4Value,
      stat4Label,
      background,
      padding,
    }) => {
      const bgCls =
        background === 'dark'
          ? 'bg-slate-900 text-white'
          : background === 'accent'
            ? 'bg-orange-500 text-white'
            : 'bg-slate-100 text-slate-900'
      const stats = [
        { value: stat1Value, label: stat1Label },
        { value: stat2Value, label: stat2Label },
        { value: stat3Value, label: stat3Label },
        { value: stat4Value, label: stat4Label },
      ].filter((s) => s.value)
      return (
        <section className={`${bgCls} ${padY[padding]}`}>
          <div className={`${wrap} grid grid-cols-2 md:grid-cols-4 gap-8 text-center`}>
            {stats.map((s, i) => (
              <div key={i}>
                <p
                  className={`text-3xl md:text-4xl font-extrabold mb-1 ${background === 'muted' ? 'text-orange-500' : 'text-orange-400'}`}
                >
                  {s.value}
                </p>
                <p
                  className={`text-sm font-medium ${background === 'muted' ? 'text-slate-600' : 'opacity-80'}`}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      )
    },
  },

  // 6. Team / crew
  ConstructionTeamCrew: {
    label: 'Team & Crew',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      member1Name: { type: 'text' },
      member1Role: { type: 'text' },
      member1Image: { type: 'text' },
      member2Name: { type: 'text' },
      member2Role: { type: 'text' },
      member2Image: { type: 'text' },
      member3Name: { type: 'text' },
      member3Role: { type: 'text' },
      member3Image: { type: 'text' },
      member4Name: { type: 'text' },
      member4Role: { type: 'text' },
      member4Image: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Meet Our Team',
      sectionSubtitle:
        'Experienced professionals committed to delivering quality on every project.',
      member1Name: 'Ramesh Kapoor',
      member1Role: 'Director & Project Head',
      member1Image: 'https://placehold.co/400x400/475569/ffffff?text=RK',
      member2Name: 'Sunita Joshi',
      member2Role: 'Senior Site Engineer',
      member2Image: 'https://placehold.co/400x400/334155/ffffff?text=SJ',
      member3Name: 'Arun Mehta',
      member3Role: 'Safety & Compliance Officer',
      member3Image: 'https://placehold.co/400x400/1e293b/ffffff?text=AM',
      member4Name: 'Priya Nair',
      member4Role: 'Estimation & Contracts',
      member4Image: 'https://placehold.co/400x400/0f172a/ffffff?text=PN',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      member1Name,
      member1Role,
      member1Image,
      member2Name,
      member2Role,
      member2Image,
      member3Name,
      member3Role,
      member3Image,
      member4Name,
      member4Role,
      member4Image,
      padding,
      background,
    }) => {
      const members = [
        { name: member1Name, role: member1Role, image: member1Image },
        { name: member2Name, role: member2Role, image: member2Image },
        { name: member3Name, role: member3Role, image: member3Image },
        { name: member4Name, role: member4Role, image: member4Image },
      ].filter((m) => m.name)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {members.map((m, i) => (
                <div key={i} className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.image}
                    alt={m.name}
                    className="w-28 h-28 rounded-full object-cover mx-auto mb-4 border-4 border-orange-100"
                  />
                  <h3 className="font-semibold text-slate-900">{m.name}</h3>
                  <p className="text-sm text-slate-500 mt-0.5">{m.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 7. Certifications & safety badges
  ConstructionCertificationsBadges: {
    label: 'Certifications & Safety Badges',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      badge1Label: { type: 'text' },
      badge1Detail: { type: 'text' },
      badge2Label: { type: 'text' },
      badge2Detail: { type: 'text' },
      badge3Label: { type: 'text' },
      badge3Detail: { type: 'text' },
      badge4Label: { type: 'text' },
      badge4Detail: { type: 'text' },
      badge5Label: { type: 'text' },
      badge5Detail: { type: 'text' },
      badge6Label: { type: 'text' },
      badge6Detail: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Certified & Compliant',
      sectionSubtitle:
        'Our credentials reflect our commitment to quality, safety, and professionalism.',
      badge1Label: 'ISO 9001:2015',
      badge1Detail: 'Quality Management System',
      badge2Label: 'OHSAS 18001',
      badge2Detail: 'Occupational Health & Safety',
      badge3Label: 'ISO 14001',
      badge3Detail: 'Environmental Management',
      badge4Label: 'CPWD Empanelled',
      badge4Detail: 'Central Public Works Dept.',
      badge5Label: 'Class-A Contractor',
      badge5Detail: 'PWD Karnataka',
      badge6Label: 'NSIC Registered',
      badge6Detail: 'National Small Industries Corp.',
      padding: 'md',
      background: 'muted',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      badge1Label,
      badge1Detail,
      badge2Label,
      badge2Detail,
      badge3Label,
      badge3Detail,
      badge4Label,
      badge4Detail,
      badge5Label,
      badge5Detail,
      badge6Label,
      badge6Detail,
      padding,
      background,
    }) => {
      const badges = [
        { label: badge1Label, detail: badge1Detail },
        { label: badge2Label, detail: badge2Detail },
        { label: badge3Label, detail: badge3Detail },
        { label: badge4Label, detail: badge4Detail },
        { label: badge5Label, detail: badge5Detail },
        { label: badge6Label, detail: badge6Detail },
      ].filter((b) => b.label)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {badges.map((b, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition"
                >
                  <div className="text-green-600 mb-3">
                    <CheckShieldIcon />
                  </div>
                  <p className="font-semibold text-slate-900 text-sm leading-tight">{b.label}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">{b.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 8. Testimonials
  ConstructionTestimonials: {
    label: 'Testimonials',
    fields: {
      sectionTitle: { type: 'text' },
      quote1Text: { type: 'textarea' },
      quote1Author: { type: 'text' },
      quote1Company: { type: 'text' },
      quote2Text: { type: 'textarea' },
      quote2Author: { type: 'text' },
      quote2Company: { type: 'text' },
      quote3Text: { type: 'textarea' },
      quote3Author: { type: 'text' },
      quote3Company: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'What Our Clients Say',
      quote1Text:
        'The team delivered our 12-unit residential complex three weeks ahead of schedule, without a single quality defect. Exceptional work.',
      quote1Author: 'Venkat Reddy',
      quote1Company: 'Reddy Builders Pvt Ltd',
      quote2Text:
        'Their safety record across our 18-month infrastructure project was impeccable. Zero LTIs. We will work with them again.',
      quote2Author: 'Anita Sharma',
      quote2Company: 'National Highways Authority (Vendor)',
      quote3Text:
        'Transparent budgeting and weekly reporting made it easy to track progress. No surprises. Highly recommended.',
      quote3Author: 'Mohan Das',
      quote3Company: 'Das Commercial Properties',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      quote1Text,
      quote1Author,
      quote1Company,
      quote2Text,
      quote2Author,
      quote2Company,
      quote3Text,
      quote3Author,
      quote3Company,
      padding,
      background,
    }) => {
      const quotes = [
        { text: quote1Text, author: quote1Author, company: quote1Company },
        { text: quote2Text, author: quote2Author, company: quote2Company },
        { text: quote3Text, author: quote3Author, company: quote3Company },
      ].filter((q) => q.text)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {quotes.map((q, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col gap-4"
                >
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, si) => (
                      <StarIcon key={si} />
                    ))}
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed flex-1">
                    &#8220;{q.text}&#8221;
                  </p>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{q.author}</p>
                    <p className="text-xs text-slate-500">{q.company}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // 9. Process / timeline
  ConstructionProcessTimeline: {
    label: 'Process Timeline',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      step1Title: { type: 'text' },
      step1Description: { type: 'textarea' },
      step2Title: { type: 'text' },
      step2Description: { type: 'textarea' },
      step3Title: { type: 'text' },
      step3Description: { type: 'textarea' },
      step4Title: { type: 'text' },
      step4Description: { type: 'textarea' },
      step5Title: { type: 'text' },
      step5Description: { type: 'textarea' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'How We Work',
      sectionSubtitle: 'A structured, transparent process from consultation to project handover.',
      step1Title: 'Initial Consultation',
      step1Description:
        'We listen to your vision, review the site, and understand your budget and timeline constraints.',
      step2Title: 'Detailed Estimation',
      step2Description:
        'Our estimators produce a line-item BOQ with material specifications, labour rates, and contingencies.',
      step3Title: 'Contract & Mobilisation',
      step3Description:
        'We finalise scope, sign a fixed-price contract, obtain permits, and mobilise crew and machinery.',
      step4Title: 'Construction & Oversight',
      step4Description:
        'Daily site management, weekly client progress reports, and third-party quality audits throughout execution.',
      step5Title: 'Handover & Warranty',
      step5Description:
        'Final snag clearance, documentation handover, and a 12-month defect liability period for your peace of mind.',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      step1Title,
      step1Description,
      step2Title,
      step2Description,
      step3Title,
      step3Description,
      step4Title,
      step4Description,
      step5Title,
      step5Description,
      padding,
      background,
    }) => {
      const steps = [
        { title: step1Title, description: step1Description },
        { title: step2Title, description: step2Description },
        { title: step3Title, description: step3Description },
        { title: step4Title, description: step4Description },
        { title: step5Title, description: step5Description },
      ].filter((s) => s.title)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-orange-200 hidden md:block" />
              <div className="flex flex-col gap-8">
                {steps.map((s, i) => (
                  <div key={i} className="md:flex gap-6 items-start">
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-orange-500 text-white font-bold text-lg shadow relative z-10">
                      {i + 1}
                    </div>
                    <div className="mt-3 md:mt-0">
                      <h3 className="font-semibold text-slate-900 text-lg mb-1">{s.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // 10. Why Choose Us
  ConstructionWhyChooseUs: {
    label: 'Why Choose Us',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      point1Title: { type: 'text' },
      point1Description: { type: 'textarea' },
      point2Title: { type: 'text' },
      point2Description: { type: 'textarea' },
      point3Title: { type: 'text' },
      point3Description: { type: 'textarea' },
      point4Title: { type: 'text' },
      point4Description: { type: 'textarea' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'radio',
        options: [
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Why Choose Us',
      sectionSubtitle:
        'We combine deep technical expertise with a relentless focus on timelines, budget, and safety.',
      point1Title: 'Fixed-Price Contracts',
      point1Description:
        'No surprises. We absorb cost overruns within scope — your budget stays intact.',
      point2Title: 'Licensed & Insured',
      point2Description:
        'Fully licensed by PWD, CPWD-empanelled, and covered under comprehensive workmen compensation.',
      point3Title: 'On-Time Delivery',
      point3Description:
        '93% of our projects are delivered on or before the agreed schedule over the last 5 years.',
      point4Title: '24/7 Site Supervision',
      point4Description:
        'Dedicated engineers on-site daily. Real-time reporting via our project management portal.',
      ctaLabel: 'Start a Conversation',
      ctaHref: '#contact',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      point1Title,
      point1Description,
      point2Title,
      point2Description,
      point3Title,
      point3Description,
      point4Title,
      point4Description,
      ctaLabel,
      ctaHref,
      padding,
      background,
    }) => {
      const points = [
        { title: point1Title, description: point1Description },
        { title: point2Title, description: point2Description },
        { title: point3Title, description: point3Description },
        { title: point4Title, description: point4Description },
      ].filter((p) => p.title)
      return (
        <section
          className={`${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="md:flex gap-12 items-start">
              <div className="md:w-1/3 mb-8 md:mb-0">
                <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">
                  {sectionTitle}
                </h2>
                {sectionSubtitle && (
                  <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-6">
                    {sectionSubtitle}
                  </p>
                )}
                {ctaLabel && (
                  <a
                    href={ctaHref}
                    className="inline-flex rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                  >
                    {ctaLabel}
                  </a>
                )}
              </div>
              <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {points.map((p, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="text-orange-500 mb-3">
                      <CheckShieldIcon />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">{p.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // 11. Safety record
  ConstructionSafetyRecord: {
    label: 'Safety Record',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      incidentFreeDays: { type: 'text' },
      safetyRating: { type: 'text' },
      trainedWorkers: { type: 'text' },
      complianceNote: { type: 'textarea' },
      padding: {
        type: 'select',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      },
      background: {
        type: 'select',
        options: [
          { label: 'Dark', value: 'dark' },
          { label: 'Accent (Orange)', value: 'accent' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      sectionTitle: 'Safety is Non-Negotiable',
      sectionSubtitle:
        'Our zero-harm culture is embedded in every phase of construction — from induction to handover.',
      incidentFreeDays: '1,460+',
      safetyRating: '5 / 5',
      trainedWorkers: '320+',
      complianceNote:
        'All workers undergo OSHA-aligned safety induction before site entry. PPE strictly enforced. Monthly third-party safety audits on all active sites.',
      padding: 'md',
      background: 'dark',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      incidentFreeDays,
      safetyRating,
      trainedWorkers,
      complianceNote,
      padding,
      background,
    }) => {
      const bgCls =
        background === 'dark'
          ? 'bg-slate-900 text-white'
          : background === 'accent'
            ? 'bg-orange-600 text-white'
            : 'bg-slate-100 text-slate-900'
      const labelCls = background === 'muted' ? 'text-slate-600' : 'opacity-75'
      const valueCls = background === 'muted' ? 'text-orange-500' : 'text-orange-400'
      const noteCls = background === 'muted' ? 'text-slate-600' : 'opacity-80'
      return (
        <section className={`${bgCls} ${padY[padding]}`}>
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className={`max-w-2xl mx-auto text-base ${labelCls}`}>{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mb-8">
              <div>
                <p className={`text-4xl font-extrabold mb-1 ${valueCls}`}>{incidentFreeDays}</p>
                <p className={`text-sm ${labelCls}`}>Incident-Free Days</p>
              </div>
              <div>
                <p className={`text-4xl font-extrabold mb-1 ${valueCls}`}>{safetyRating}</p>
                <p className={`text-sm ${labelCls}`}>Safety Rating (Client Audits)</p>
              </div>
              <div>
                <p className={`text-4xl font-extrabold mb-1 ${valueCls}`}>{trainedWorkers}</p>
                <p className={`text-sm ${labelCls}`}>Safety-Trained Workers</p>
              </div>
            </div>
            {complianceNote && (
              <p className={`text-center text-sm max-w-2xl mx-auto ${noteCls}`}>{complianceNote}</p>
            )}
          </div>
        </section>
      )
    },
  },
}

// ── categories ─────────────────────────────────────────────────────────────────

const typedCategories: NonNullable<Config<ConstructionProps>['categories']> = {
  'construction-hero': {
    title: 'Construction — Hero',
    components: ['ConstructionHero'],
  },
  'construction-sections': {
    title: 'Construction — Sections',
    components: [
      'ConstructionServicesGrid',
      'ConstructionProjectGallery',
      'ConstructionProcessTimeline',
      'ConstructionWhyChooseUs',
      'ConstructionTeamCrew',
      'ConstructionCertificationsBadges',
      'ConstructionTestimonials',
    ],
  },
  'construction-cta': {
    title: 'Construction — CTA & Stats',
    components: ['ConstructionQuoteCTA', 'ConstructionStatsStrip', 'ConstructionSafetyRecord'],
  },
}

// ── pack export ───────────────────────────────────────────────────────────────

export const construction: ComponentPack = {
  key: 'construction',
  label: 'Construction',
  components: typedComponents as NonNullable<Config['components']>,
  categories: typedCategories,
}
