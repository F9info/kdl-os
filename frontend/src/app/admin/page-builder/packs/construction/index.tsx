import type { Config } from '@puckeditor/core'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ComponentPack } from '../types'

// ── shared helpers ────────────────────────────────────────────────────────────

const padY = { sm: 'py-8', md: 'py-14', lg: 'py-24' } as const
const wrap = 'mx-auto max-w-6xl px-4 md:px-8'

// ── per-component prop shapes ─────────────────────────────────────────────────

type ConstructionProps = {
  ConstructionHeader: {
    variant: '1' | '2' | '3' | '4'
    visible: boolean
    brand: string
    logoUrl: string
    links: string
    loginLabel: string
    loginHref: string
    ctaLabel: string
    ctaHref: string
    phoneNumber: string
    primaryColor: string
  }
  ConstructionTopBar: {
    variant: '1' | '2' | '3' | '4'
    visible: boolean
    d1Address: string
    d1Phone: string
    d1Email: string
    d1Link1Label: string
    d1Link1Href: string
    d1Link2Label: string
    d1Link2Href: string
    d1Link3Label: string
    d1Link3Href: string
    d1Social1Href: string
    d1Social2Href: string
    d1Social3Href: string
    d1Social4Href: string
    d2Item1Text: string
    d2Item2Text: string
    d2Item3Text: string
    d2TrackLabel: string
    d2TrackHref: string
    d2Language: string
    d3Tagline: string
    d3Phone: string
    d3Email: string
    d3CtaLabel: string
    d3CtaHref: string
    d4Tagline: string
    d4Social1Href: string
    d4Social2Href: string
    d4Social3Href: string
    d4Social4Href: string
    d4HelpLabel: string
    d4HelpHref: string
    d4FaqLabel: string
    d4FaqHref: string
    d4Language: string
  }
  ConstructionHero: {
    variant: '1' | '2' | '3' | '4'
    visible: boolean
    d1Slide1Image: string
    d1Slide1Badge: string
    d1Slide1Headline: string
    d1Slide1Subheadline: string
    d1Slide1CtaLabel: string
    d1Slide1CtaHref: string
    d1Slide2Image: string
    d1Slide2Badge: string
    d1Slide2Headline: string
    d1Slide2Subheadline: string
    d1Slide2CtaLabel: string
    d1Slide2CtaHref: string
    d1Slide3Image: string
    d1Slide3Badge: string
    d1Slide3Headline: string
    d1Slide3Subheadline: string
    d1Slide3CtaLabel: string
    d1Slide3CtaHref: string
    d2BadgeText: string
    d2Headline: string
    d2HighlightWord: string
    d2Subheadline: string
    d2CtaLabel: string
    d2CtaHref: string
    d2SecondaryLabel: string
    d2SecondaryHref: string
    d2Avatar1: string
    d2Avatar2: string
    d2Avatar3: string
    d2TrustText: string
    d2Slide1Image: string
    d2Slide1Tag: string
    d2Slide1Title: string
    d2Slide1Subtitle: string
    d2Slide2Image: string
    d2Slide2Tag: string
    d2Slide2Title: string
    d2Slide2Subtitle: string
    d2Slide3Image: string
    d2Slide3Tag: string
    d2Slide3Title: string
    d2Slide3Subtitle: string
    d3Eyebrow: string
    d3Headline: string
    d3Subheadline: string
    d3CtaLabel: string
    d3CtaHref: string
    d3Slide1Image: string
    d3Slide1Quote: string
    d3Slide1Author: string
    d3Slide1Role: string
    d3Slide2Image: string
    d3Slide2Quote: string
    d3Slide2Author: string
    d3Slide2Role: string
    d3Slide3Image: string
    d3Slide3Quote: string
    d3Slide3Author: string
    d3Slide3Role: string
    d4Headline: string
    d4Subheadline: string
    d4CtaLabel: string
    d4CtaHref: string
    d4Slide1Icon: IconKey
    d4Slide1Title: string
    d4Slide1Description: string
    d4Slide2Icon: IconKey
    d4Slide2Title: string
    d4Slide2Description: string
    d4Slide3Icon: IconKey
    d4Slide3Title: string
    d4Slide3Description: string
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
    project1NumberTag: string
    project1Description: string
    project1Href: string
    project2Title: string
    project2Category: string
    project2Image: string
    project2NumberTag: string
    project2Description: string
    project2Href: string
    project3Title: string
    project3Category: string
    project3Image: string
    project3NumberTag: string
    project3Description: string
    project3Href: string
    project4Title: string
    project4Category: string
    project4Image: string
    project4NumberTag: string
    project4Description: string
    project4Href: string
    project5Title: string
    project5Category: string
    project5Image: string
    project5NumberTag: string
    project5Description: string
    project5Href: string
    project6Title: string
    project6Category: string
    project6Image: string
    project6NumberTag: string
    project6Description: string
    project6Href: string
    project7Title: string
    project7Category: string
    project7Image: string
    project7NumberTag: string
    project7Description: string
    project7Href: string
    project8Title: string
    project8Category: string
    project8Image: string
    project8NumberTag: string
    project8Description: string
    project8Href: string
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
  ConstructionUrgencyBanner: {
    padding: 'sm' | 'md' | 'lg'
    background: 'accent' | 'dark'
    headline: string
    ctaLabel: string
    ctaHref: string
    phoneNumber: string
    phoneLabel: string
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
    quote1Initials: string
    quote2Text: string
    quote2Author: string
    quote2Company: string
    quote2Initials: string
    quote3Text: string
    quote3Author: string
    quote3Company: string
    quote3Initials: string
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
  ConstructionMilestoneTimeline: {
    eyebrow: string
    heading: string
    milestone1Year: string
    milestone1Label: string
    milestone2Year: string
    milestone2Label: string
    milestone3Year: string
    milestone3Label: string
    milestone4Year: string
    milestone4Label: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionOfferingsRows: {
    sectionTitle: string
    sectionSubtitle: string
    offering1NumberTag: string
    offering1Image: string
    offering1Heading: string
    offering1Description: string
    offering1BrandNames: string
    offering1Href: string
    offering2NumberTag: string
    offering2Image: string
    offering2Heading: string
    offering2Description: string
    offering2BrandNames: string
    offering2Href: string
    offering3NumberTag: string
    offering3Image: string
    offering3Heading: string
    offering3Description: string
    offering3BrandNames: string
    offering3Href: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionAboutSplit: {
    eyebrow: string
    heading: string
    paragraph: string
    photo: string
    badgeNumber: string
    badgeLabel: string
    check1Text: string
    check2Text: string
    check3Text: string
    brochureLabel: string
    brochureHref: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionFeaturedProject: {
    sectionTitle: string
    image: string
    paragraph: string
    scope1Icon: IconKey
    scope1Label: string
    scope2Icon: IconKey
    scope2Label: string
    scope3Icon: IconKey
    scope3Label: string
    scope4Icon: IconKey
    scope4Label: string
    linkLabel: string
    linkHref: string
    ctaLabel: string
    ctaHref: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionProductsShowcase: {
    sectionTitle: string
    sectionSubtitle: string
    category1Label: string
    category2Label: string
    category3Label: string
    category4Label: string
    product1Category: string
    product1Icon: IconKey
    product1Title: string
    product1Description: string
    product2Category: string
    product2Icon: IconKey
    product2Title: string
    product2Description: string
    product3Category: string
    product3Icon: IconKey
    product3Title: string
    product3Description: string
    product4Category: string
    product4Icon: IconKey
    product4Title: string
    product4Description: string
    product5Category: string
    product5Icon: IconKey
    product5Title: string
    product5Description: string
    product6Category: string
    product6Icon: IconKey
    product6Title: string
    product6Description: string
    product7Category: string
    product7Icon: IconKey
    product7Title: string
    product7Description: string
    product8Category: string
    product8Icon: IconKey
    product8Title: string
    product8Description: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionClientsGrid: {
    sectionTitle: string
    sectionSubtitle: string
    client1Logo: string
    client1Name: string
    client2Logo: string
    client2Name: string
    client3Logo: string
    client3Name: string
    client4Logo: string
    client4Name: string
    client5Logo: string
    client5Name: string
    client6Logo: string
    client6Name: string
    client7Logo: string
    client7Name: string
    client8Logo: string
    client8Name: string
    client9Logo: string
    client9Name: string
    client10Logo: string
    client10Name: string
    client11Logo: string
    client11Name: string
    client12Logo: string
    client12Name: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionLeadFormFAQ: {
    sectionTitle: string
    faq1Question: string
    faq1Answer: string
    faq2Question: string
    faq2Answer: string
    faq3Question: string
    faq3Answer: string
    faq4Question: string
    faq4Answer: string
    faq5Question: string
    faq5Answer: string
    faq6Question: string
    faq6Answer: string
    formHeading: string
    formSubtext: string
    padding: 'sm' | 'md' | 'lg'
    background: 'white' | 'muted'
  }
  ConstructionTaglineStrip: {
    logoUrl: string
    brand: string
    tagline: string
  }
  ConstructionFloatingActions: {
    whatsappHref: string
  }
  ConstructionFooter: {
    logoUrl: string
    brand: string
    tagline: string
    social1Label: string
    social1Href: string
    social2Label: string
    social2Href: string
    social3Label: string
    social3Href: string
    social4Label: string
    social4Href: string
    newsletterPlaceholder: string
    newsletterButtonLabel: string
    companyLinksTitle: string
    links: string
    contactTitle: string
    contactPhone: string
    contactEmail: string
    contactAddress: string
    showroomTitle: string
    showroomAddress: string
    qrImage: string
    qrCaption: string
    copyright: string
  }
  ConstructionFounder: {
    sectionTitle: string
    photo: string
    quoteText: string
    founderName: string
    founderTitle: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionVideo: {
    sectionTitle: string
    sectionSubtitle: string
    thumbnail: string
    videoUrl: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionBlogPosts: {
    sectionTitle: string
    post1Image: string
    post1Category: string
    post1Title: string
    post1Date: string
    post2Image: string
    post2Category: string
    post2Title: string
    post2Date: string
    post3Image: string
    post3Category: string
    post3Title: string
    post3Date: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionSocialMedia: {
    sectionTitle: string
    sectionSubtitle: string
    facebookHandle: string
    instagramHandle: string
    linkedinHandle: string
    twitterHandle: string
    padding: 'sm' | 'md' | 'lg'
  }
  ConstructionFAQ: {
    sectionTitle: string
    faq1Question: string
    faq1Answer: string
    faq2Question: string
    faq2Answer: string
    faq3Question: string
    faq3Answer: string
    faq4Question: string
    faq4Answer: string
    padding: 'sm' | 'md' | 'lg'
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

function PinIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"
      />
      <circle cx="12" cy="9.5" r="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 5c0-.6.4-1 1-1h2.6c.5 0 .9.3 1 .8l.9 3.5c.1.4 0 .9-.3 1.2L7.8 10.9a12 12 0 0 0 5.3 5.3l1.4-1.4c.3-.3.8-.4 1.2-.3l3.5.9c.5.1.8.5.8 1V19c0 .6-.4 1-1 1h-1C10.6 20 4 13.4 4 6V5z"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
    </svg>
  )
}

function GiftIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect x="3" y="9" width="18" height="4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13h14v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7zM12 9v12"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9c-2 0-3.5-1.2-3.5-3S10 3 12 5c2-2 3.5-.8 3.5 1S14 9 12 9z"
      />
    </svg>
  )
}

function HeadsetIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect
        x="3"
        y="13"
        width="4"
        height="6"
        rx="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="17"
        y="13"
        width="4"
        height="6"
        rx="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 19v1a2 2 0 0 1-2 2h-3" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12h18M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9c-2.5-2.5-4-6-4-9s1.5-6.5 4-9z"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.5 22v-8.4h2.8l.4-3.3h-3.2V8.1c0-1 .3-1.6 1.7-1.6h1.6V3.5c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.5H7.3v3.3h2.8V22h3.4z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3.5 9.5h3V20h-3V9.5zM9.5 9.5h2.9v1.4h.04c.4-.75 1.4-1.55 2.9-1.55 3.1 0 3.66 2 3.66 4.7V20h-3v-4.9c0-1.17-.02-2.68-1.63-2.68-1.64 0-1.9 1.28-1.9 2.6V20h-3V9.5z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.9 3H22l-7.6 8.7L23 21h-6.9l-5.4-6.6L4.5 21H1.4l8.1-9.3L1 3h7l4.9 6.1L18.9 3zm-1.2 16.1h1.7L7.4 4.8H5.6l12.1 14.3z" />
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12s0-3.2-.4-4.7c-.2-.9-.9-1.6-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.5c-.9.2-1.6.9-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.7c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.5c.9-.2 1.6-.9 1.8-1.8.4-1.5.4-4.7.4-4.7zM10 15V9l5.2 3-5.2 3z" />
    </svg>
  )
}

type IconKey = 'hardhat' | 'shield' | 'star'

const ICON_BY_KEY: Record<IconKey, () => JSX.Element> = {
  hardhat: HardHatIcon,
  shield: CheckShieldIcon,
  star: StarIcon,
}

const REVEAL_BASE = 'transition-all duration-700 ease-out'

function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return {
    ref,
    revealCls: `${REVEAL_BASE} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`,
  }
}

// ── components ────────────────────────────────────────────────────────────────

const typedComponents: Config<ConstructionProps>['components'] = {
  // Top bar — 4 selectable designs (Insert-a-block picker shows one card per
  // design, same "Design 1-4" convention as e.g. general pack's Hero).
  ConstructionTopBar: {
    label: 'Top Bar',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Contact + links + socials', value: '1' },
          { label: 'Design 2 — Promo strip', value: '2' },
          { label: 'Design 3 — Tagline + CTA button', value: '3' },
          { label: 'Design 4 — Follow us + tagline + help', value: '4' },
        ],
      },
      visible: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      d1Address: { type: 'text' },
      d1Phone: { type: 'text' },
      d1Email: { type: 'text' },
      d1Link1Label: { type: 'text' },
      d1Link1Href: { type: 'text' },
      d1Link2Label: { type: 'text' },
      d1Link2Href: { type: 'text' },
      d1Link3Label: { type: 'text' },
      d1Link3Href: { type: 'text' },
      d1Social1Href: { type: 'text' },
      d1Social2Href: { type: 'text' },
      d1Social3Href: { type: 'text' },
      d1Social4Href: { type: 'text' },
      d2Item1Text: { type: 'text' },
      d2Item2Text: { type: 'text' },
      d2Item3Text: { type: 'text' },
      d2TrackLabel: { type: 'text' },
      d2TrackHref: { type: 'text' },
      d2Language: { type: 'text' },
      d3Tagline: { type: 'text' },
      d3Phone: { type: 'text' },
      d3Email: { type: 'text' },
      d3CtaLabel: { type: 'text' },
      d3CtaHref: { type: 'text' },
      d4Tagline: { type: 'text' },
      d4Social1Href: { type: 'text' },
      d4Social2Href: { type: 'text' },
      d4Social3Href: { type: 'text' },
      d4Social4Href: { type: 'text' },
      d4HelpLabel: { type: 'text' },
      d4HelpHref: { type: 'text' },
      d4FaqLabel: { type: 'text' },
      d4FaqHref: { type: 'text' },
      d4Language: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      visible: true,
      d1Address: '123 Business Street, Mumbai, India',
      d1Phone: '+91 98765 43210',
      d1Email: 'hello@yourdomain.com',
      d1Link1Label: 'About Us',
      d1Link1Href: '#about',
      d1Link2Label: 'Careers',
      d1Link2Href: '#careers',
      d1Link3Label: 'Support',
      d1Link3Href: '#support',
      d1Social1Href: '#',
      d1Social2Href: '#',
      d1Social3Href: '#',
      d1Social4Href: '#',
      d2Item1Text: 'Free Shipping on Orders Over ₹999',
      d2Item2Text: 'Secure Payments Guaranteed',
      d2Item3Text: '24/7 Customer Support',
      d2TrackLabel: 'Track Order',
      d2TrackHref: '#track',
      d2Language: 'EN',
      d3Tagline: 'We help businesses grow digitally.',
      d3Phone: '+91 98765 43210',
      d3Email: 'hello@yourdomain.com',
      d3CtaLabel: 'Book a Free Consultation',
      d3CtaHref: '#consultation',
      d4Tagline: 'Building ideas. Delivering results.',
      d4Social1Href: '#',
      d4Social2Href: '#',
      d4Social3Href: '#',
      d4Social4Href: '#',
      d4HelpLabel: 'Help Center',
      d4HelpHref: '#help',
      d4FaqLabel: 'FAQs',
      d4FaqHref: '#faqs',
      d4Language: 'English (IN)',
    },
    render: function ConstructionTopBarRender({
      variant,
      visible,
      d1Address,
      d1Phone,
      d1Email,
      d1Link1Label,
      d1Link1Href,
      d1Link2Label,
      d1Link2Href,
      d1Link3Label,
      d1Link3Href,
      d1Social1Href,
      d1Social2Href,
      d1Social3Href,
      d1Social4Href,
      d2Item1Text,
      d2Item2Text,
      d2Item3Text,
      d2TrackLabel,
      d2TrackHref,
      d2Language,
      d3Tagline,
      d3Phone,
      d3Email,
      d3CtaLabel,
      d3CtaHref,
      d4Tagline,
      d4Social1Href,
      d4Social2Href,
      d4Social3Href,
      d4Social4Href,
      d4HelpLabel,
      d4HelpHref,
      d4FaqLabel,
      d4FaqHref,
      d4Language,
    }) {
      if (!visible) return <></>

      if (variant === '2') {
        // Plain border-l per item (not the divide-x utility) — divide-x's
        // sibling selector looks fine in one row, but stretches/misaligns
        // once flex-wrap actually wraps a narrow topbar onto a second line.
        const itemBorder = 'border-l border-slate-200 pl-6 first:border-l-0 first:pl-0'
        return (
          <div className="bg-white border-b border-slate-100">
            <div
              className={`${wrap} flex flex-wrap items-center justify-center gap-x-0 gap-y-2 py-2.5 text-sm text-slate-600`}
            >
              <span className={`flex items-center gap-2 pr-6 ${itemBorder}`}>
                <GiftIcon />
                {d2Item1Text}
              </span>
              <span className={`flex items-center gap-2 pr-6 ${itemBorder}`}>
                <CheckShieldIcon />
                {d2Item2Text}
              </span>
              <span className={`flex items-center gap-2 pr-6 ${itemBorder}`}>
                <HeadsetIcon />
                {d2Item3Text}
              </span>
              {d2TrackLabel && (
                <a
                  href={d2TrackHref}
                  className={`pr-6 hover:text-orange-600 transition ${itemBorder}`}
                >
                  {d2TrackLabel}
                </a>
              )}
              {d2Language && (
                <span className={`flex items-center gap-1 ${itemBorder}`}>
                  {d2Language}
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              )}
            </div>
          </div>
        )
      }

      if (variant === '3') {
        return (
          <div className="bg-white border-b border-slate-100">
            <div
              className={`${wrap} flex flex-wrap items-center justify-between gap-4 py-3 text-sm text-slate-600`}
            >
              {d3Tagline && <p className="font-medium text-slate-900">{d3Tagline}</p>}
              <div className="flex items-center gap-4 divide-x divide-slate-200">
                {d3Phone && (
                  <span className="flex items-center gap-2 pr-4">
                    <PhoneIcon />
                    {d3Phone}
                  </span>
                )}
                {d3Email && (
                  <span className="flex items-center gap-2 pl-4">
                    <MailIcon />
                    {d3Email}
                  </span>
                )}
              </div>
              {d3CtaLabel && (
                <a
                  href={d3CtaHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
                >
                  {d3CtaLabel}
                  <span aria-hidden="true">→</span>
                </a>
              )}
            </div>
          </div>
        )
      }

      if (variant === '4') {
        return (
          <div className="bg-white border-b border-slate-100">
            <div
              className={`${wrap} flex flex-wrap items-center justify-between gap-4 py-3 text-sm text-slate-600`}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-900">Follow Us:</span>
                <div className="flex items-center gap-3">
                  {d4Social1Href && (
                    <a
                      href={d4Social1Href}
                      aria-label="Facebook"
                      className="hover:text-orange-600 transition"
                    >
                      <FacebookIcon />
                    </a>
                  )}
                  {d4Social2Href && (
                    <a
                      href={d4Social2Href}
                      aria-label="LinkedIn"
                      className="hover:text-orange-600 transition"
                    >
                      <LinkedInIcon />
                    </a>
                  )}
                  {d4Social3Href && (
                    <a
                      href={d4Social3Href}
                      aria-label="Instagram"
                      className="hover:text-orange-600 transition"
                    >
                      <InstagramIcon />
                    </a>
                  )}
                  {d4Social4Href && (
                    <a
                      href={d4Social4Href}
                      aria-label="YouTube"
                      className="hover:text-orange-600 transition"
                    >
                      <YoutubeIcon />
                    </a>
                  )}
                </div>
              </div>
              {d4Tagline && <p>{d4Tagline}</p>}
              <div className="flex items-center gap-4">
                {d4HelpLabel && (
                  <a href={d4HelpHref} className="hover:text-orange-600 transition">
                    {d4HelpLabel}
                  </a>
                )}
                {d4FaqLabel && (
                  <a
                    href={d4FaqHref}
                    className="border-l border-slate-200 pl-4 hover:text-orange-600 transition"
                  >
                    {d4FaqLabel}
                  </a>
                )}
                {d4Language && (
                  <span className="flex items-center gap-1">
                    <GlobeIcon />
                    {d4Language}
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      }

      // Design 1 (default)
      return (
        <div className="bg-white border-b border-slate-100">
          <div
            className={`${wrap} flex flex-wrap items-center justify-between gap-4 py-3 text-sm text-slate-600`}
          >
            <div className="flex items-center gap-4 divide-x divide-slate-200">
              {d1Address && (
                <span className="flex items-center gap-2 pr-4 first:pl-0">
                  <PinIcon />
                  {d1Address}
                </span>
              )}
              {d1Phone && (
                <span className="flex items-center gap-2 px-4">
                  <PhoneIcon />
                  {d1Phone}
                </span>
              )}
              {d1Email && (
                <span className="flex items-center gap-2 pl-4">
                  <MailIcon />
                  {d1Email}
                </span>
              )}
            </div>
            <div className="flex items-center gap-5">
              {[
                { label: d1Link1Label, href: d1Link1Href },
                { label: d1Link2Label, href: d1Link2Href },
                { label: d1Link3Label, href: d1Link3Href },
              ]
                .filter((l) => l.label)
                .map((l, i) => (
                  <a key={i} href={l.href} className="hover:text-orange-600 transition">
                    {l.label}
                  </a>
                ))}
              <div className="flex items-center gap-3 border-l border-slate-200 pl-5">
                {d1Social1Href && (
                  <a
                    href={d1Social1Href}
                    aria-label="Facebook"
                    className="hover:text-orange-600 transition"
                  >
                    <FacebookIcon />
                  </a>
                )}
                {d1Social2Href && (
                  <a
                    href={d1Social2Href}
                    aria-label="LinkedIn"
                    className="hover:text-orange-600 transition"
                  >
                    <LinkedInIcon />
                  </a>
                )}
                {d1Social3Href && (
                  <a
                    href={d1Social3Href}
                    aria-label="Instagram"
                    className="hover:text-orange-600 transition"
                  >
                    <InstagramIcon />
                  </a>
                )}
                {d1Social4Href && (
                  <a
                    href={d1Social4Href}
                    aria-label="X"
                    className="hover:text-orange-600 transition"
                  >
                    <XIcon />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    },
  },

  // 0. Sticky header
  ConstructionHeader: {
    label: 'Construction Header',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Classic (logo, centered nav, Login + CTA)', value: '1' },
          { label: 'Design 2 — Centered logo, split nav', value: '2' },
          { label: 'Design 3 — Phone + CTA emphasis', value: '3' },
          { label: 'Design 4 — Dark premium', value: '4' },
        ],
      },
      visible: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      brand: { type: 'text' },
      logoUrl: { type: 'text' },
      links: { type: 'textarea' },
      loginLabel: { type: 'text' },
      loginHref: { type: 'text' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      phoneNumber: { type: 'text' },
      primaryColor: { type: 'text' },
    },
    defaultProps: {
      variant: '1',
      visible: true,
      brand: 'Your Brand',
      logoUrl: '',
      links: 'Home|#\nAbout|#\nProducts|#\nServices|#\nSectors|#\nContact|#',
      loginLabel: 'Login',
      loginHref: '#login',
      ctaLabel: 'Get a Quote',
      ctaHref: '#quote',
      phoneNumber: '+91 98765 43210',
      primaryColor: '',
    },
    render: function ConstructionHeaderRender({
      variant,
      visible,
      brand,
      logoUrl,
      links,
      loginLabel,
      loginHref,
      ctaLabel,
      ctaHref,
      phoneNumber,
      primaryColor,
    }) {
      const [mobileOpen, setMobileOpen] = useState(false)
      const navItems = (links || '')
        .split('\n')
        .map((line) => line.split('|'))
        .filter(([label]) => label)
      const ctaStyle = primaryColor ? { backgroundColor: primaryColor } : undefined

      const mobilePanel = mobileOpen && typeof document !== 'undefined' && (
        <>
          {createPortal(
            <div className="fixed inset-0 z-50 bg-white flex flex-col p-6 md:hidden">
              <div className="flex items-center justify-between mb-8">
                <span className="font-bold text-slate-900">{brand}</span>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 -mr-2 text-slate-700"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col gap-5 mb-8">
                {navItems.map(([label, href], i) => (
                  <a
                    key={i}
                    href={href || '#'}
                    onClick={() => setMobileOpen(false)}
                    className="text-lg font-medium text-slate-900"
                  >
                    {label}
                  </a>
                ))}
              </nav>
              <div className="flex flex-col gap-3 mt-auto">
                {loginLabel && (
                  <a
                    href={loginHref}
                    className="inline-flex items-center justify-center rounded-lg border-2 border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900"
                  >
                    {loginLabel}
                  </a>
                )}
                {ctaLabel && (
                  <a
                    href={ctaHref}
                    style={ctaStyle}
                    className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
                  >
                    {ctaLabel}
                  </a>
                )}
              </div>
            </div>,
            document.body
          )}
        </>
      )

      const hamburgerBtn = (colorClass: string) => (
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen(true)}
          className={`md:hidden p-2 -mr-2 ${colorClass}`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )

      if (!visible) return <></>

      if (variant === '2') {
        const half = Math.ceil(navItems.length / 2)
        const leftLinks = navItems.slice(0, half)
        const rightLinks = navItems.slice(half)
        return (
          <>
            <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100 text-slate-900">
              <div className={`${wrap} flex items-center justify-between h-16`}>
                <a href="#" className="flex items-center gap-2 font-bold md:hidden">
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-8 w-auto" />
                  )}
                  <span>{brand}</span>
                </a>
                <div className="hidden md:grid md:flex-1 md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-6">
                  <nav className="flex items-center justify-end gap-6">
                    {leftLinks.map(([label, href], i) => (
                      <a
                        key={i}
                        href={href || '#'}
                        className="text-sm font-medium text-slate-700 hover:text-orange-500 transition"
                      >
                        {label}
                      </a>
                    ))}
                  </nav>
                  <a href="#" className="flex items-center gap-2 font-bold justify-self-center">
                    {logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt={brand} className="h-8 w-auto" />
                    )}
                    <span>{brand}</span>
                  </a>
                  <div className="flex items-center justify-end gap-6">
                    {rightLinks.map(([label, href], i) => (
                      <a
                        key={i}
                        href={href || '#'}
                        className="text-sm font-medium text-slate-700 hover:text-orange-500 transition"
                      >
                        {label}
                      </a>
                    ))}
                    {ctaLabel && (
                      <a
                        href={ctaHref}
                        style={ctaStyle}
                        className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
                      >
                        {ctaLabel}
                      </a>
                    )}
                  </div>
                </div>
                {hamburgerBtn('text-slate-700')}
              </div>
            </header>
            {mobilePanel}
          </>
        )
      }

      if (variant === '3') {
        return (
          <>
            <header className="sticky top-0 z-40 bg-white border-b-2 border-orange-500">
              <div className={`${wrap} flex items-center justify-between h-16`}>
                <div className="flex items-center gap-10">
                  <a href="#" className="flex items-center gap-2 font-bold text-slate-900">
                    {logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt={brand} className="h-8 w-auto" />
                    )}
                    <span>{brand}</span>
                  </a>
                  <nav className="hidden md:flex items-center gap-6">
                    {navItems.map(([label, href], i) => (
                      <a
                        key={i}
                        href={href || '#'}
                        className="text-sm font-medium text-slate-700 hover:text-orange-500 transition"
                      >
                        {label}
                      </a>
                    ))}
                  </nav>
                </div>
                <div className="hidden md:flex items-center gap-5">
                  {phoneNumber && (
                    <a
                      href={`tel:${phoneNumber}`}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-orange-600 transition"
                    >
                      <PhoneIcon />
                      {phoneNumber}
                    </a>
                  )}
                  {ctaLabel && (
                    <a
                      href={ctaHref}
                      style={ctaStyle}
                      className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
                    >
                      {ctaLabel}
                    </a>
                  )}
                </div>
                {hamburgerBtn('text-slate-700')}
              </div>
            </header>
            {mobilePanel}
          </>
        )
      }

      if (variant === '4') {
        return (
          <>
            <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white">
              <div className={`${wrap} flex items-center justify-between h-16`}>
                <a href="#" className="flex items-center gap-2 font-bold">
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-8 w-auto" />
                  )}
                  <span>{brand}</span>
                </a>
                <nav className="hidden md:flex items-center gap-7">
                  {navItems.map(([label, href], i) => (
                    <a
                      key={i}
                      href={href || '#'}
                      className="text-xs font-semibold uppercase tracking-wide text-slate-300 hover:text-orange-400 transition"
                    >
                      {label}
                    </a>
                  ))}
                </nav>
                <div className="hidden md:flex items-center">
                  {ctaLabel && (
                    <a
                      href={ctaHref}
                      style={ctaStyle}
                      className="inline-flex items-center rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-400 transition"
                    >
                      {ctaLabel}
                    </a>
                  )}
                </div>
                {hamburgerBtn('text-white')}
              </div>
            </header>
            {mobilePanel}
          </>
        )
      }

      // Design 1 (default) — classic
      return (
        <>
          <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100">
            <div className={`${wrap} flex items-center justify-between h-16`}>
              <a href="#" className="flex items-center gap-2 font-bold text-slate-900">
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt={brand} className="h-8 w-auto" />
                )}
                <span>{brand}</span>
              </a>
              <nav className="hidden md:flex items-center gap-7">
                {navItems.map(([label, href], i) => (
                  <a
                    key={i}
                    href={href || '#'}
                    className="text-sm font-medium text-slate-700 hover:text-orange-500 transition"
                  >
                    {label}
                  </a>
                ))}
              </nav>
              <div className="hidden md:flex items-center gap-3">
                {loginLabel && (
                  <a
                    href={loginHref}
                    className="inline-flex items-center rounded-lg border-2 border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
                  >
                    {loginLabel}
                  </a>
                )}
                {ctaLabel && (
                  <a
                    href={ctaHref}
                    style={ctaStyle}
                    className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
                  >
                    {ctaLabel}
                  </a>
                )}
              </div>
              {hamburgerBtn('text-slate-700')}
            </div>
          </header>
          {mobilePanel}
        </>
      )
    },
  },

  // 1. Hero section — 4 selectable designs, each a real 3-slide slider
  ConstructionHero: {
    label: 'Construction Hero',
    fields: {
      variant: {
        type: 'select',
        options: [
          { label: 'Design 1 — Full-bleed photo slider', value: '1' },
          { label: 'Design 2 — Split with slider card', value: '2' },
          { label: 'Design 3 — Centered rotating quote', value: '3' },
          { label: 'Design 4 — Fixed headline + feature slider', value: '4' },
        ],
      },
      visible: {
        type: 'radio',
        options: [
          { label: 'Show', value: true },
          { label: 'Hide', value: false },
        ],
      },
      d1Slide1Image: { type: 'text' },
      d1Slide1Badge: { type: 'text' },
      d1Slide1Headline: { type: 'text' },
      d1Slide1Subheadline: { type: 'textarea' },
      d1Slide1CtaLabel: { type: 'text' },
      d1Slide1CtaHref: { type: 'text' },
      d1Slide2Image: { type: 'text' },
      d1Slide2Badge: { type: 'text' },
      d1Slide2Headline: { type: 'text' },
      d1Slide2Subheadline: { type: 'textarea' },
      d1Slide2CtaLabel: { type: 'text' },
      d1Slide2CtaHref: { type: 'text' },
      d1Slide3Image: { type: 'text' },
      d1Slide3Badge: { type: 'text' },
      d1Slide3Headline: { type: 'text' },
      d1Slide3Subheadline: { type: 'textarea' },
      d1Slide3CtaLabel: { type: 'text' },
      d1Slide3CtaHref: { type: 'text' },
      d2BadgeText: { type: 'text' },
      d2Headline: { type: 'text' },
      d2HighlightWord: { type: 'text' },
      d2Subheadline: { type: 'textarea' },
      d2CtaLabel: { type: 'text' },
      d2CtaHref: { type: 'text' },
      d2SecondaryLabel: { type: 'text' },
      d2SecondaryHref: { type: 'text' },
      d2Avatar1: { type: 'text' },
      d2Avatar2: { type: 'text' },
      d2Avatar3: { type: 'text' },
      d2TrustText: { type: 'text' },
      d2Slide1Image: { type: 'text' },
      d2Slide1Tag: { type: 'text' },
      d2Slide1Title: { type: 'text' },
      d2Slide1Subtitle: { type: 'textarea' },
      d2Slide2Image: { type: 'text' },
      d2Slide2Tag: { type: 'text' },
      d2Slide2Title: { type: 'text' },
      d2Slide2Subtitle: { type: 'textarea' },
      d2Slide3Image: { type: 'text' },
      d2Slide3Tag: { type: 'text' },
      d2Slide3Title: { type: 'text' },
      d2Slide3Subtitle: { type: 'textarea' },
      d3Eyebrow: { type: 'text' },
      d3Headline: { type: 'text' },
      d3Subheadline: { type: 'textarea' },
      d3CtaLabel: { type: 'text' },
      d3CtaHref: { type: 'text' },
      d3Slide1Image: { type: 'text' },
      d3Slide1Quote: { type: 'textarea' },
      d3Slide1Author: { type: 'text' },
      d3Slide1Role: { type: 'text' },
      d3Slide2Image: { type: 'text' },
      d3Slide2Quote: { type: 'textarea' },
      d3Slide2Author: { type: 'text' },
      d3Slide2Role: { type: 'text' },
      d3Slide3Image: { type: 'text' },
      d3Slide3Quote: { type: 'textarea' },
      d3Slide3Author: { type: 'text' },
      d3Slide3Role: { type: 'text' },
      d4Headline: { type: 'text' },
      d4Subheadline: { type: 'textarea' },
      d4CtaLabel: { type: 'text' },
      d4CtaHref: { type: 'text' },
      d4Slide1Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      d4Slide1Title: { type: 'text' },
      d4Slide1Description: { type: 'textarea' },
      d4Slide2Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      d4Slide2Title: { type: 'text' },
      d4Slide2Description: { type: 'textarea' },
      d4Slide3Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      d4Slide3Title: { type: 'text' },
      d4Slide3Description: { type: 'textarea' },
    },
    defaultProps: {
      variant: '1',
      visible: true,
      d1Slide1Image: 'https://placehold.co/1600x900/1e293b/ffffff?text=Project+One',
      d1Slide1Badge: 'Residential',
      d1Slide1Headline: 'Building Homes That Last Generations',
      d1Slide1Subheadline:
        'Premium residential construction backed by two decades of craftsmanship.',
      d1Slide1CtaLabel: 'Get a Free Quote',
      d1Slide1CtaHref: '#quote',
      d1Slide2Image: 'https://placehold.co/1600x900/334155/ffffff?text=Project+Two',
      d1Slide2Badge: 'Commercial',
      d1Slide2Headline: 'Commercial Spaces Built On Schedule',
      d1Slide2Subheadline:
        'From office parks to retail complexes, delivered on time and on budget.',
      d1Slide2CtaLabel: 'See Our Work',
      d1Slide2CtaHref: '#projects',
      d1Slide3Image: 'https://placehold.co/1600x900/0f172a/ffffff?text=Project+Three',
      d1Slide3Badge: 'Infrastructure',
      d1Slide3Headline: 'Infrastructure That Moves Communities Forward',
      d1Slide3Subheadline:
        'Roads, bridges, and public works engineered to the highest safety standard.',
      d1Slide3CtaLabel: 'Start Your Project',
      d1Slide3CtaHref: '#quote',
      d2BadgeText: 'Trusted General Contractor',
      d2Headline: 'Building Your Vision, On Time & On Budget',
      d2HighlightWord: 'Vision',
      d2Subheadline:
        'Award-winning general contractor serving residential and commercial clients across the region. Licensed, insured, and safety-certified.',
      d2CtaLabel: 'Get a Free Quote',
      d2CtaHref: '#quote',
      d2SecondaryLabel: 'See Our Work',
      d2SecondaryHref: '#projects',
      d2Avatar1: 'https://placehold.co/80x80/475569/ffffff?text=C1',
      d2Avatar2: 'https://placehold.co/80x80/334155/ffffff?text=C2',
      d2Avatar3: 'https://placehold.co/80x80/1e293b/ffffff?text=C3',
      d2TrustText: '500+ clients trust us',
      d2Slide1Image: 'https://placehold.co/900x700/475569/ffffff?text=Project+One',
      d2Slide1Tag: 'Residential',
      d2Slide1Title: 'Riverside Villas',
      d2Slide1Subtitle: 'A 24-unit residential development delivered ahead of schedule.',
      d2Slide2Image: 'https://placehold.co/900x700/334155/ffffff?text=Project+Two',
      d2Slide2Tag: 'Commercial',
      d2Slide2Title: 'Tech Park Phase 2',
      d2Slide2Subtitle: 'A 6-storey commercial office park with LEED-aligned design.',
      d2Slide3Image: 'https://placehold.co/900x700/1e293b/ffffff?text=Project+Three',
      d2Slide3Tag: 'Infrastructure',
      d2Slide3Title: 'Highway Bridge Rehab',
      d2Slide3Subtitle: 'Structural rehabilitation completed with zero traffic disruption.',
      d3Eyebrow: 'Why Contractors Choose Us',
      d3Headline: 'Precision-Built. Delivered On Time.',
      d3Subheadline: 'A track record our clients are proud to put their name behind.',
      d3CtaLabel: 'Request a Consultation',
      d3CtaHref: '#quote',
      d3Slide1Image: 'https://placehold.co/200x200/475569/ffffff?text=RK',
      d3Slide1Quote:
        'They delivered our headquarters three weeks ahead of schedule without a single defect.',
      d3Slide1Author: 'Ramesh Kapoor',
      d3Slide1Role: 'Director, Kapoor Industries',
      d3Slide2Image: 'https://placehold.co/200x200/334155/ffffff?text=AS',
      d3Slide2Quote:
        'Transparent budgeting and weekly reporting made this the easiest build we have managed.',
      d3Slide2Author: 'Anita Sharma',
      d3Slide2Role: 'COO, Sharma Retail Group',
      d3Slide3Image: 'https://placehold.co/200x200/1e293b/ffffff?text=MD',
      d3Slide3Quote:
        'Safety-first culture and zero incidents across an 18-month infrastructure project.',
      d3Slide3Author: 'Mohan Das',
      d3Slide3Role: 'Project Sponsor, NHA',
      d4Headline: 'One Contractor. Every Capability.',
      d4Subheadline: 'A single accountable team across design, build, and handover.',
      d4CtaLabel: 'Start Your Project',
      d4CtaHref: '#quote',
      d4Slide1Icon: 'hardhat',
      d4Slide1Title: 'Structural Construction',
      d4Slide1Description:
        'End-to-end structural builds engineered to code, from footings to rooftop.',
      d4Slide2Icon: 'shield',
      d4Slide2Title: 'Safety & Compliance',
      d4Slide2Description: 'Zero-harm culture with third-party audits on every active site.',
      d4Slide3Icon: 'star',
      d4Slide3Title: 'Quality Assurance',
      d4Slide3Description:
        'Rigorous quality checks at every milestone, backed by a defect-free warranty.',
    },
    render: function ConstructionHeroRender({
      variant,
      visible,
      d1Slide1Image,
      d1Slide1Badge,
      d1Slide1Headline,
      d1Slide1Subheadline,
      d1Slide1CtaLabel,
      d1Slide1CtaHref,
      d1Slide2Image,
      d1Slide2Badge,
      d1Slide2Headline,
      d1Slide2Subheadline,
      d1Slide2CtaLabel,
      d1Slide2CtaHref,
      d1Slide3Image,
      d1Slide3Badge,
      d1Slide3Headline,
      d1Slide3Subheadline,
      d1Slide3CtaLabel,
      d1Slide3CtaHref,
      d2BadgeText,
      d2Headline,
      d2HighlightWord,
      d2Subheadline,
      d2CtaLabel,
      d2CtaHref,
      d2SecondaryLabel,
      d2SecondaryHref,
      d2Avatar1,
      d2Avatar2,
      d2Avatar3,
      d2TrustText,
      d2Slide1Image,
      d2Slide1Tag,
      d2Slide1Title,
      d2Slide1Subtitle,
      d2Slide2Image,
      d2Slide2Tag,
      d2Slide2Title,
      d2Slide2Subtitle,
      d2Slide3Image,
      d2Slide3Tag,
      d2Slide3Title,
      d2Slide3Subtitle,
      d3Eyebrow,
      d3Headline,
      d3Subheadline,
      d3CtaLabel,
      d3CtaHref,
      d3Slide1Image,
      d3Slide1Quote,
      d3Slide1Author,
      d3Slide1Role,
      d3Slide2Image,
      d3Slide2Quote,
      d3Slide2Author,
      d3Slide2Role,
      d3Slide3Image,
      d3Slide3Quote,
      d3Slide3Author,
      d3Slide3Role,
      d4Headline,
      d4Subheadline,
      d4CtaLabel,
      d4CtaHref,
      d4Slide1Icon,
      d4Slide1Title,
      d4Slide1Description,
      d4Slide2Icon,
      d4Slide2Title,
      d4Slide2Description,
      d4Slide3Icon,
      d4Slide3Title,
      d4Slide3Description,
    }) {
      const [activeSlide, setActiveSlide] = useState(0)
      if (!visible) return <></>

      if (variant === '1') {
        const slides = [
          {
            image: d1Slide1Image,
            badge: d1Slide1Badge,
            headline: d1Slide1Headline,
            subheadline: d1Slide1Subheadline,
            ctaLabel: d1Slide1CtaLabel,
            ctaHref: d1Slide1CtaHref,
          },
          {
            image: d1Slide2Image,
            badge: d1Slide2Badge,
            headline: d1Slide2Headline,
            subheadline: d1Slide2Subheadline,
            ctaLabel: d1Slide2CtaLabel,
            ctaHref: d1Slide2CtaHref,
          },
          {
            image: d1Slide3Image,
            badge: d1Slide3Badge,
            headline: d1Slide3Headline,
            subheadline: d1Slide3Subheadline,
            ctaLabel: d1Slide3CtaLabel,
            ctaHref: d1Slide3CtaHref,
          },
        ].filter((s) => s.image)
        const total = slides.length
        const idx = Math.min(activeSlide, Math.max(total - 1, 0))
        return (
          <section className="relative h-[560px] md:h-[640px] overflow-hidden bg-slate-900">
            {slides.map((s, i) => (
              <div
                key={i}
                className="absolute inset-0 transition-opacity duration-700 ease-in-out"
                style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? 'auto' : 'none' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image}
                  alt={s.headline}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-slate-900/10" />
                <div
                  className={`${wrap} relative z-10 h-full flex flex-col justify-center max-w-2xl`}
                >
                  {s.badge && (
                    <span className="inline-flex w-fit items-center rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white mb-5">
                      {s.badge}
                    </span>
                  )}
                  <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
                    {s.headline}
                  </h1>
                  <p className="text-slate-200 text-base md:text-lg mb-7 max-w-lg">
                    {s.subheadline}
                  </p>
                  {s.ctaLabel && (
                    <a
                      href={s.ctaHref}
                      className="inline-flex w-fit items-center rounded-lg bg-orange-500 px-7 py-3.5 text-white font-semibold hover:bg-orange-600 transition text-base"
                    >
                      {s.ctaLabel}
                    </a>
                  )}
                </div>
              </div>
            ))}
            {total > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous slide"
                  onClick={() => setActiveSlide((i) => (i - 1 + total) % total)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition backdrop-blur"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Next slide"
                  onClick={() => setActiveSlide((i) => (i + 1) % total)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition backdrop-blur"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                <div className="absolute bottom-6 left-0 right-0 z-20 flex justify-center gap-2">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setActiveSlide(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === idx ? 'w-7 bg-orange-500' : 'w-2 bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )
      }

      if (variant === '3') {
        const slides = [
          {
            image: d3Slide1Image,
            quote: d3Slide1Quote,
            author: d3Slide1Author,
            role: d3Slide1Role,
          },
          {
            image: d3Slide2Image,
            quote: d3Slide2Quote,
            author: d3Slide2Author,
            role: d3Slide2Role,
          },
          {
            image: d3Slide3Image,
            quote: d3Slide3Quote,
            author: d3Slide3Author,
            role: d3Slide3Role,
          },
        ].filter((s) => s.quote)
        const total = slides.length
        const idx = Math.min(activeSlide, Math.max(total - 1, 0))
        const slide = slides[idx]
        return (
          <section className="bg-slate-50 py-16 md:py-24">
            <div className={`${wrap} text-center`}>
              {d3Eyebrow && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-3">
                  {d3Eyebrow}
                </p>
              )}
              <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4 max-w-3xl mx-auto">
                {d3Headline}
              </h1>
              <p className="text-slate-600 text-base md:text-lg mb-10 max-w-xl mx-auto">
                {d3Subheadline}
              </p>
              {d3CtaLabel && (
                <a
                  href={d3CtaHref}
                  className="inline-flex items-center rounded-lg bg-orange-500 px-7 py-3.5 text-white font-semibold hover:bg-orange-600 transition text-base mb-12"
                >
                  {d3CtaLabel}
                </a>
              )}
              {slide && (
                <div className="relative max-w-2xl mx-auto rounded-2xl bg-white border border-slate-200 shadow-sm p-8 md:p-10">
                  <div className="flex flex-col items-center gap-4">
                    {slide.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slide.image}
                        alt={slide.author}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                    )}
                    <p className="text-slate-700 text-lg leading-relaxed">
                      &#8220;{slide.quote}&#8221;
                    </p>
                    <div>
                      <p className="font-semibold text-slate-900">{slide.author}</p>
                      <p className="text-sm text-slate-500">{slide.role}</p>
                    </div>
                  </div>
                  {total > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous"
                        onClick={() => setActiveSlide((i) => (i - 1 + total) % total)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-50 text-slate-700 flex items-center justify-center hover:bg-slate-100 transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Next"
                        onClick={() => setActiveSlide((i) => (i + 1) % total)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-50 text-slate-700 flex items-center justify-center hover:bg-slate-100 transition"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
              {total > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setActiveSlide(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === idx ? 'w-6 bg-orange-500' : 'w-2 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      }

      if (variant === '4') {
        const slides = [
          { icon: d4Slide1Icon, title: d4Slide1Title, description: d4Slide1Description },
          { icon: d4Slide2Icon, title: d4Slide2Title, description: d4Slide2Description },
          { icon: d4Slide3Icon, title: d4Slide3Title, description: d4Slide3Description },
        ].filter((s) => s.title)
        const total = slides.length
        const idx = Math.min(activeSlide, Math.max(total - 1, 0))
        const slide = slides[idx]
        const Icon = slide ? (ICON_BY_KEY[slide.icon] ?? HardHatIcon) : HardHatIcon
        return (
          <section className="bg-white py-16 md:py-24 border-b border-slate-100">
            <div className={`${wrap} text-center`}>
              <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4 max-w-3xl mx-auto">
                {d4Headline}
              </h1>
              <p className="text-slate-600 text-base md:text-lg mb-4 max-w-xl mx-auto">
                {d4Subheadline}
              </p>
              {d4CtaLabel && (
                <a
                  href={d4CtaHref}
                  className="inline-flex items-center rounded-lg bg-orange-500 px-7 py-3.5 text-white font-semibold hover:bg-orange-600 transition text-base mb-12"
                >
                  {d4CtaLabel}
                </a>
              )}
              {slide && (
                <div className="relative max-w-md mx-auto">
                  <div className="rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition">
                    <div className="text-orange-500 mb-4 flex justify-center [&>svg]:w-9 [&>svg]:h-9">
                      <Icon />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{slide.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{slide.description}</p>
                  </div>
                  {total > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous"
                        onClick={() => setActiveSlide((i) => (i - 1 + total) % total)}
                        className="absolute -left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition shadow-sm"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="Next"
                        onClick={() => setActiveSlide((i) => (i + 1) % total)}
                        className="absolute -right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-50 transition shadow-sm"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              )}
              {total > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setActiveSlide(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === idx ? 'w-6 bg-orange-500' : 'w-2 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )
      }

      // Design 2 (default) — split with slider card
      const d2Slides = [
        {
          image: d2Slide1Image,
          tag: d2Slide1Tag,
          title: d2Slide1Title,
          subtitle: d2Slide1Subtitle,
        },
        {
          image: d2Slide2Image,
          tag: d2Slide2Tag,
          title: d2Slide2Title,
          subtitle: d2Slide2Subtitle,
        },
        {
          image: d2Slide3Image,
          tag: d2Slide3Tag,
          title: d2Slide3Title,
          subtitle: d2Slide3Subtitle,
        },
      ].filter((s) => s.image)
      const d2Total = d2Slides.length
      const d2Idx = Math.min(activeSlide, Math.max(d2Total - 1, 0))
      const d2Slide = d2Slides[d2Idx]
      const headlineParts =
        d2HighlightWord && d2Headline.includes(d2HighlightWord)
          ? d2Headline.split(d2HighlightWord)
          : [d2Headline, '']
      const avatars = [d2Avatar1, d2Avatar2, d2Avatar3].filter(Boolean)
      return (
        <section className="bg-white py-14 md:py-20">
          <div className={`${wrap} grid grid-cols-1 md:grid-cols-2 gap-10 items-center`}>
            <div>
              {d2BadgeText && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs font-semibold px-3 py-1 mb-5">
                  {d2BadgeText}
                </span>
              )}
              <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-5">
                {headlineParts[0]}
                {d2HighlightWord && <span className="text-orange-500">{d2HighlightWord}</span>}
                {headlineParts[1]}
              </h1>
              <p className="text-slate-600 text-base md:text-lg mb-8 max-w-lg">{d2Subheadline}</p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                {d2CtaLabel && (
                  <a
                    href={d2CtaHref}
                    className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-7 py-3.5 text-white font-semibold hover:bg-orange-600 transition text-base"
                  >
                    {d2CtaLabel}
                  </a>
                )}
                {d2SecondaryLabel && (
                  <a
                    href={d2SecondaryHref}
                    className="inline-flex items-center justify-center rounded-lg border-2 border-slate-300 px-7 py-3.5 text-slate-900 font-semibold hover:bg-slate-50 transition text-base"
                  >
                    {d2SecondaryLabel}
                  </a>
                )}
              </div>
              {avatars.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {avatars.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="w-9 h-9 rounded-full border-2 border-white object-cover"
                      />
                    ))}
                  </div>
                  {d2TrustText && <p className="text-sm text-slate-600">{d2TrustText}</p>}
                </div>
              )}
            </div>
            <div>
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-slate-100">
                {d2Slide?.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d2Slide.image}
                    alt={d2Slide.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}
                {d2Slide && (d2Slide.title || d2Slide.subtitle) && (
                  <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/90 backdrop-blur p-4">
                    {d2Slide.tag && (
                      <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">
                        {d2Slide.tag}
                      </span>
                    )}
                    <p className="font-semibold text-slate-900">{d2Slide.title}</p>
                    {d2Slide.subtitle && (
                      <p className="text-xs text-slate-600 mt-0.5">{d2Slide.subtitle}</p>
                    )}
                  </div>
                )}
                {d2Total > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous slide"
                      onClick={() => setActiveSlide((i) => (i - 1 + d2Total) % d2Total)}
                      className="absolute left-3 top-3 w-8 h-8 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow hover:bg-white transition"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Next slide"
                      onClick={() => setActiveSlide((i) => (i + 1) % d2Total)}
                      className="absolute right-3 top-3 w-8 h-8 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow hover:bg-white transition"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              {d2Total > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  {d2Slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setActiveSlide(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === d2Idx ? 'w-6 bg-orange-500' : 'w-2 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )
    },
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

  // Core offerings — alternating rows
  ConstructionOfferingsRows: {
    label: 'Core Offerings (Alternating Rows)',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      offering1NumberTag: { type: 'text' },
      offering1Image: { type: 'text' },
      offering1Heading: { type: 'text' },
      offering1Description: { type: 'textarea' },
      offering1BrandNames: { type: 'text' },
      offering1Href: { type: 'text' },
      offering2NumberTag: { type: 'text' },
      offering2Image: { type: 'text' },
      offering2Heading: { type: 'text' },
      offering2Description: { type: 'textarea' },
      offering2BrandNames: { type: 'text' },
      offering2Href: { type: 'text' },
      offering3NumberTag: { type: 'text' },
      offering3Image: { type: 'text' },
      offering3Heading: { type: 'text' },
      offering3Description: { type: 'textarea' },
      offering3BrandNames: { type: 'text' },
      offering3Href: { type: 'text' },
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
      sectionTitle: 'Our Core Offerings',
      sectionSubtitle: 'Everything you need from a single, accountable contractor.',
      offering1NumberTag: '01',
      offering1Image: 'https://placehold.co/700x500/475569/ffffff?text=Offering+One',
      offering1Heading: 'Structural Construction',
      offering1Description:
        'End-to-end structural builds engineered to code, from footings to rooftop.',
      offering1BrandNames: 'Brand One · Brand Two',
      offering1Href: '#',
      offering2NumberTag: '02',
      offering2Image: 'https://placehold.co/700x500/334155/ffffff?text=Offering+Two',
      offering2Heading: 'MEP & Systems Integration',
      offering2Description:
        'Mechanical, electrical, and plumbing systems coordinated under one schedule.',
      offering2BrandNames: 'Brand Three · Brand Four',
      offering2Href: '#',
      offering3NumberTag: '03',
      offering3Image: 'https://placehold.co/700x500/1e293b/ffffff?text=Offering+Three',
      offering3Heading: 'Finishing & Interiors',
      offering3Description:
        'Precision finishing work that turns a shell into a move-in-ready space.',
      offering3BrandNames: 'Brand Five · Brand Six',
      offering3Href: '#',
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionOfferingsRowsRender({
      sectionTitle,
      sectionSubtitle,
      offering1NumberTag,
      offering1Image,
      offering1Heading,
      offering1Description,
      offering1BrandNames,
      offering1Href,
      offering2NumberTag,
      offering2Image,
      offering2Heading,
      offering2Description,
      offering2BrandNames,
      offering2Href,
      offering3NumberTag,
      offering3Image,
      offering3Heading,
      offering3Description,
      offering3BrandNames,
      offering3Href,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const offerings = [
        {
          numberTag: offering1NumberTag,
          image: offering1Image,
          heading: offering1Heading,
          description: offering1Description,
          brandNames: offering1BrandNames,
          href: offering1Href,
        },
        {
          numberTag: offering2NumberTag,
          image: offering2Image,
          heading: offering2Heading,
          description: offering2Description,
          brandNames: offering2BrandNames,
          href: offering2Href,
        },
        {
          numberTag: offering3NumberTag,
          image: offering3Image,
          heading: offering3Heading,
          description: offering3Description,
          brandNames: offering3BrandNames,
          href: offering3Href,
        },
      ].filter((o) => o.heading)
      const icons: (() => JSX.Element)[] = [HardHatIcon, CheckShieldIcon]
      const iconFor = (i: number) => icons[i % icons.length] ?? HardHatIcon
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="flex flex-col gap-16">
              {offerings.map((o, i) => {
                const Icon = iconFor(i)
                return (
                  <div
                    key={i}
                    className={`md:flex gap-10 items-center ${i % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
                  >
                    <div className="md:w-1/2 relative mb-6 md:mb-0">
                      <span className="absolute -top-6 -left-2 text-7xl font-extrabold text-slate-100 select-none">
                        {o.numberTag}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={o.image}
                        alt={o.heading}
                        className="relative rounded-xl w-full h-64 object-cover"
                      />
                    </div>
                    <div className="md:w-1/2">
                      <div className="text-orange-500 mb-3">
                        <Icon />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{o.heading}</h3>
                      <p className="text-slate-600 leading-relaxed mb-3">{o.description}</p>
                      {o.brandNames && (
                        <p className="text-xs text-slate-400 mb-4">{o.brandNames}</p>
                      )}
                      <a
                        href={o.href}
                        className="inline-flex items-center gap-1 text-orange-600 font-semibold text-sm hover:gap-2 transition-all"
                      >
                        Explore <span aria-hidden="true">→</span>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )
    },
  },

  // About — split with badge overlay
  ConstructionAboutSplit: {
    label: 'About (Split with Badge)',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      paragraph: { type: 'textarea' },
      photo: { type: 'text' },
      badgeNumber: { type: 'text' },
      badgeLabel: { type: 'text' },
      check1Text: { type: 'text' },
      check2Text: { type: 'text' },
      check3Text: { type: 'text' },
      brochureLabel: { type: 'text' },
      brochureHref: { type: 'text' },
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
      eyebrow: 'About Us',
      heading: 'Two Decades of Building With Integrity',
      paragraph:
        'We are a full-service general contractor delivering residential, commercial, and infrastructure projects. Our in-house engineering and project management teams keep every job transparent, on schedule, and within budget.',
      photo: 'https://placehold.co/700x800/475569/ffffff?text=Our+Team',
      badgeNumber: '15+',
      badgeLabel: 'Years Experience',
      check1Text: 'Licensed & fully insured',
      check2Text: 'In-house engineering team',
      check3Text: 'Transparent weekly reporting',
      brochureLabel: 'Download Brochure',
      brochureHref: '#',
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionAboutSplitRender({
      eyebrow,
      heading,
      paragraph,
      photo,
      badgeNumber,
      badgeLabel,
      check1Text,
      check2Text,
      check3Text,
      brochureLabel,
      brochureHref,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const checks = [check1Text, check2Text, check3Text].filter(Boolean)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={`${wrap} md:flex gap-14 items-center`}>
            <div className="md:w-2/5 relative mb-10 md:mb-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={heading} className="rounded-2xl w-full h-96 object-cover" />
              {(badgeNumber || badgeLabel) && (
                <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-orange-500 text-white flex flex-col items-center justify-center text-center shadow-lg">
                  <span className="text-2xl font-extrabold leading-none">{badgeNumber}</span>
                  <span className="text-[11px] font-medium mt-1 px-2">{badgeLabel}</span>
                </div>
              )}
            </div>
            <div className="md:w-3/5">
              {eyebrow && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4">{heading}</h2>
              {paragraph && <p className="text-slate-600 leading-relaxed mb-6">{paragraph}</p>}
              {checks.length > 0 && (
                <ul className="flex flex-col gap-3 mb-8">
                  {checks.map((c, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700">
                      <span className="text-green-600 flex-shrink-0">
                        <CheckShieldIcon />
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
              )}
              {brochureLabel && (
                <a
                  href={brochureHref}
                  className="inline-flex items-center rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                >
                  {brochureLabel}
                </a>
              )}
            </div>
          </div>
        </section>
      )
    },
  },

  // 3. Project / Portfolio gallery → repurposed as Sectors grid
  ConstructionProjectGallery: {
    label: 'Project Gallery (Sectors Grid)',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      project1Title: { type: 'text' },
      project1Category: { type: 'text' },
      project1Image: { type: 'text' },
      project1NumberTag: { type: 'text' },
      project1Description: { type: 'textarea' },
      project1Href: { type: 'text' },
      project2Title: { type: 'text' },
      project2Category: { type: 'text' },
      project2Image: { type: 'text' },
      project2NumberTag: { type: 'text' },
      project2Description: { type: 'textarea' },
      project2Href: { type: 'text' },
      project3Title: { type: 'text' },
      project3Category: { type: 'text' },
      project3Image: { type: 'text' },
      project3NumberTag: { type: 'text' },
      project3Description: { type: 'textarea' },
      project3Href: { type: 'text' },
      project4Title: { type: 'text' },
      project4Category: { type: 'text' },
      project4Image: { type: 'text' },
      project4NumberTag: { type: 'text' },
      project4Description: { type: 'textarea' },
      project4Href: { type: 'text' },
      project5Title: { type: 'text' },
      project5Category: { type: 'text' },
      project5Image: { type: 'text' },
      project5NumberTag: { type: 'text' },
      project5Description: { type: 'textarea' },
      project5Href: { type: 'text' },
      project6Title: { type: 'text' },
      project6Category: { type: 'text' },
      project6Image: { type: 'text' },
      project6NumberTag: { type: 'text' },
      project6Description: { type: 'textarea' },
      project6Href: { type: 'text' },
      project7Title: { type: 'text' },
      project7Category: { type: 'text' },
      project7Image: { type: 'text' },
      project7NumberTag: { type: 'text' },
      project7Description: { type: 'textarea' },
      project7Href: { type: 'text' },
      project8Title: { type: 'text' },
      project8Category: { type: 'text' },
      project8Image: { type: 'text' },
      project8NumberTag: { type: 'text' },
      project8Description: { type: 'textarea' },
      project8Href: { type: 'text' },
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
      sectionTitle: 'Sectors We Serve',
      sectionSubtitle: 'Specialised delivery across every major construction vertical.',
      project1Title: 'Sector One',
      project1Category: 'Residential',
      project1Image: 'https://placehold.co/600x450/475569/ffffff?text=Sector+One',
      project1NumberTag: '01',
      project1Description: 'Placeholder description for this sector.',
      project1Href: '#sector-1',
      project2Title: 'Sector Two',
      project2Category: 'Commercial',
      project2Image: 'https://placehold.co/600x450/334155/ffffff?text=Sector+Two',
      project2NumberTag: '02',
      project2Description: 'Placeholder description for this sector.',
      project2Href: '#sector-2',
      project3Title: 'Sector Three',
      project3Category: 'Infrastructure',
      project3Image: 'https://placehold.co/600x450/1e293b/ffffff?text=Sector+Three',
      project3NumberTag: '03',
      project3Description: 'Placeholder description for this sector.',
      project3Href: '#sector-3',
      project4Title: 'Sector Four',
      project4Category: 'Institutional',
      project4Image: 'https://placehold.co/600x450/0f172a/ffffff?text=Sector+Four',
      project4NumberTag: '04',
      project4Description: 'Placeholder description for this sector.',
      project4Href: '#sector-4',
      project5Title: 'Sector Five',
      project5Category: 'Industrial',
      project5Image: 'https://placehold.co/600x450/1e3a5f/ffffff?text=Sector+Five',
      project5NumberTag: '05',
      project5Description: 'Placeholder description for this sector.',
      project5Href: '#sector-5',
      project6Title: 'Sector Six',
      project6Category: 'Specialist',
      project6Image: 'https://placehold.co/600x450/14532d/ffffff?text=Sector+Six',
      project6NumberTag: '06',
      project6Description: 'Placeholder description for this sector.',
      project6Href: '#sector-6',
      project7Title: 'Sector Seven',
      project7Category: 'Hospitality',
      project7Image: 'https://placehold.co/600x450/78350f/ffffff?text=Sector+Seven',
      project7NumberTag: '07',
      project7Description: 'Placeholder description for this sector.',
      project7Href: '#sector-7',
      project8Title: 'Sector Eight',
      project8Category: 'Retail',
      project8Image: 'https://placehold.co/600x450/581c87/ffffff?text=Sector+Eight',
      project8NumberTag: '08',
      project8Description: 'Placeholder description for this sector.',
      project8Href: '#sector-8',
      padding: 'md',
    },
    render: function ConstructionProjectGalleryRender({
      sectionTitle,
      sectionSubtitle,
      project1Title,
      project1Category,
      project1Image,
      project1NumberTag,
      project1Description,
      project1Href,
      project2Title,
      project2Category,
      project2Image,
      project2NumberTag,
      project2Description,
      project2Href,
      project3Title,
      project3Category,
      project3Image,
      project3NumberTag,
      project3Description,
      project3Href,
      project4Title,
      project4Category,
      project4Image,
      project4NumberTag,
      project4Description,
      project4Href,
      project5Title,
      project5Category,
      project5Image,
      project5NumberTag,
      project5Description,
      project5Href,
      project6Title,
      project6Category,
      project6Image,
      project6NumberTag,
      project6Description,
      project6Href,
      project7Title,
      project7Category,
      project7Image,
      project7NumberTag,
      project7Description,
      project7Href,
      project8Title,
      project8Category,
      project8Image,
      project8NumberTag,
      project8Description,
      project8Href,
      padding,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const projects = [
        {
          title: project1Title,
          category: project1Category,
          image: project1Image,
          numberTag: project1NumberTag,
          description: project1Description,
          href: project1Href,
        },
        {
          title: project2Title,
          category: project2Category,
          image: project2Image,
          numberTag: project2NumberTag,
          description: project2Description,
          href: project2Href,
        },
        {
          title: project3Title,
          category: project3Category,
          image: project3Image,
          numberTag: project3NumberTag,
          description: project3Description,
          href: project3Href,
        },
        {
          title: project4Title,
          category: project4Category,
          image: project4Image,
          numberTag: project4NumberTag,
          description: project4Description,
          href: project4Href,
        },
        {
          title: project5Title,
          category: project5Category,
          image: project5Image,
          numberTag: project5NumberTag,
          description: project5Description,
          href: project5Href,
        },
        {
          title: project6Title,
          category: project6Category,
          image: project6Image,
          numberTag: project6NumberTag,
          description: project6Description,
          href: project6Href,
        },
        {
          title: project7Title,
          category: project7Category,
          image: project7Image,
          numberTag: project7NumberTag,
          description: project7Description,
          href: project7Href,
        },
        {
          title: project8Title,
          category: project8Category,
          image: project8Image,
          numberTag: project8NumberTag,
          description: project8Description,
          href: project8Href,
        },
      ].filter((p) => p.title)
      return (
        <section ref={ref} className={`${revealCls} ${padY[padding]} bg-white`}>
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {projects.map((p, i) => (
                <a
                  key={i}
                  href={p.href || '#'}
                  className="group relative rounded-xl overflow-hidden aspect-[4/3] block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={p.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/20 to-transparent" />
                  {p.numberTag && (
                    <span className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white/90 text-slate-900 text-xs font-bold flex items-center justify-center">
                      {p.numberTag}
                    </span>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    {p.category && (
                      <span className="text-xs font-medium text-orange-300 uppercase tracking-wide">
                        {p.category}
                      </span>
                    )}
                    <p className="font-semibold">{p.title}</p>
                    {p.description && (
                      <p className="text-xs text-white/80 mt-0.5">{p.description}</p>
                    )}
                  </div>
                </a>
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

  // Thin single-row urgency banner CTA
  ConstructionUrgencyBanner: {
    label: 'Urgency Banner',
    fields: {
      headline: { type: 'text' },
      ctaLabel: { type: 'text' },
      ctaHref: { type: 'text' },
      phoneNumber: { type: 'text' },
      phoneLabel: { type: 'text' },
      background: {
        type: 'select',
        options: [
          { label: 'Accent (Orange)', value: 'accent' },
          { label: 'Dark', value: 'dark' },
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
      headline: 'Only 3 install slots left this month — book your site survey today',
      ctaLabel: 'Book a Survey',
      ctaHref: '#quote',
      phoneNumber: '+91-98765-43210',
      phoneLabel: 'Call now',
      background: 'accent',
      padding: 'sm',
    },
    render: ({ headline, ctaLabel, ctaHref, phoneNumber, phoneLabel, background, padding }) => {
      const bgCls = background === 'dark' ? 'bg-slate-900 text-white' : 'bg-orange-500 text-white'
      const btnCls =
        background === 'dark'
          ? 'bg-orange-500 text-white hover:bg-orange-600'
          : 'bg-white text-slate-900 hover:bg-slate-100'
      return (
        <section className={`${bgCls} ${padY[padding]}`}>
          <div className={wrap}>
            <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
              {headline && (
                <p className="text-base md:text-lg font-bold text-center sm:text-left">
                  {headline}
                </p>
              )}
              <div className="flex items-center gap-4 shrink-0">
                {ctaLabel && (
                  <a
                    href={ctaHref}
                    className={`inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold transition whitespace-nowrap ${btnCls}`}
                  >
                    {ctaLabel}
                  </a>
                )}
                {phoneNumber && (
                  <a
                    href={`tel:${phoneNumber}`}
                    className="text-sm font-semibold hover:underline whitespace-nowrap"
                  >
                    {phoneLabel ? `${phoneLabel}: ` : ''}
                    {phoneNumber}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Featured project / case study
  ConstructionFeaturedProject: {
    label: 'Featured Project',
    fields: {
      sectionTitle: { type: 'text' },
      image: { type: 'text' },
      paragraph: { type: 'textarea' },
      scope1Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      scope1Label: { type: 'text' },
      scope2Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      scope2Label: { type: 'text' },
      scope3Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      scope3Label: { type: 'text' },
      scope4Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      scope4Label: { type: 'text' },
      linkLabel: { type: 'text' },
      linkHref: { type: 'text' },
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
      sectionTitle: 'Featured Project',
      image: 'https://placehold.co/900x650/475569/ffffff?text=Featured+Project',
      paragraph:
        'A ground-up commercial build delivered across 14 months — from site mobilisation to final handover — with zero schedule slippage.',
      scope1Icon: 'hardhat',
      scope1Label: 'Site Development',
      scope2Icon: 'shield',
      scope2Label: 'Safety Compliance',
      scope3Icon: 'star',
      scope3Label: 'Quality Assurance',
      scope4Icon: 'hardhat',
      scope4Label: 'MEP Coordination',
      linkLabel: 'View Case Study',
      linkHref: '#',
      ctaLabel: 'Start Your Project',
      ctaHref: '#quote',
      padding: 'md',
      background: 'muted',
    },
    render: function ConstructionFeaturedProjectRender({
      sectionTitle,
      image,
      paragraph,
      scope1Icon,
      scope1Label,
      scope2Icon,
      scope2Label,
      scope3Icon,
      scope3Label,
      scope4Icon,
      scope4Label,
      linkLabel,
      linkHref,
      ctaLabel,
      ctaHref,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const scopes = [
        { icon: scope1Icon, label: scope1Label },
        { icon: scope2Icon, label: scope2Label },
        { icon: scope3Icon, label: scope3Label },
        { icon: scope4Icon, label: scope4Label },
      ].filter((s) => s.label)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="md:flex gap-12 items-center">
              <div className="md:w-1/2 mb-8 md:mb-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={sectionTitle}
                  className="rounded-2xl w-full h-80 object-cover"
                />
              </div>
              <div className="md:w-1/2">
                {paragraph && <p className="text-slate-600 leading-relaxed mb-6">{paragraph}</p>}
                {scopes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-8">
                    {scopes.map((s, i) => {
                      const Icon = ICON_BY_KEY[s.icon] ?? HardHatIcon
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          <span className="text-orange-500 [&>svg]:w-4 [&>svg]:h-4">
                            <Icon />
                          </span>
                          {s.label}
                        </span>
                      )
                    })}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-6">
                  {ctaLabel && (
                    <a
                      href={ctaHref}
                      className="inline-flex items-center rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                    >
                      {ctaLabel}
                    </a>
                  )}
                  {linkLabel && (
                    <a
                      href={linkHref}
                      className="text-orange-600 font-semibold text-sm hover:underline"
                    >
                      {linkLabel}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Products showcase — tab filtered
  ConstructionProductsShowcase: {
    label: 'Products Showcase (Tabbed)',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      category1Label: { type: 'text' },
      category2Label: { type: 'text' },
      category3Label: { type: 'text' },
      category4Label: { type: 'text' },
      product1Category: { type: 'text' },
      product1Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product1Title: { type: 'text' },
      product1Description: { type: 'textarea' },
      product2Category: { type: 'text' },
      product2Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product2Title: { type: 'text' },
      product2Description: { type: 'textarea' },
      product3Category: { type: 'text' },
      product3Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product3Title: { type: 'text' },
      product3Description: { type: 'textarea' },
      product4Category: { type: 'text' },
      product4Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product4Title: { type: 'text' },
      product4Description: { type: 'textarea' },
      product5Category: { type: 'text' },
      product5Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product5Title: { type: 'text' },
      product5Description: { type: 'textarea' },
      product6Category: { type: 'text' },
      product6Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product6Title: { type: 'text' },
      product6Description: { type: 'textarea' },
      product7Category: { type: 'text' },
      product7Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product7Title: { type: 'text' },
      product7Description: { type: 'textarea' },
      product8Category: { type: 'text' },
      product8Icon: {
        type: 'select',
        options: [
          { label: 'Hard Hat', value: 'hardhat' },
          { label: 'Shield', value: 'shield' },
          { label: 'Star', value: 'star' },
        ],
      },
      product8Title: { type: 'text' },
      product8Description: { type: 'textarea' },
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
      sectionTitle: 'Our Products',
      sectionSubtitle: 'Sourced and supplied through our vetted vendor network.',
      category1Label: 'Category One',
      category2Label: 'Category Two',
      category3Label: 'Category Three',
      category4Label: 'Category Four',
      product1Category: 'Category One',
      product1Icon: 'hardhat',
      product1Title: 'Product One',
      product1Description: 'Placeholder product description for this listing.',
      product2Category: 'Category One',
      product2Icon: 'shield',
      product2Title: 'Product Two',
      product2Description: 'Placeholder product description for this listing.',
      product3Category: 'Category Two',
      product3Icon: 'star',
      product3Title: 'Product Three',
      product3Description: 'Placeholder product description for this listing.',
      product4Category: 'Category Two',
      product4Icon: 'hardhat',
      product4Title: 'Product Four',
      product4Description: 'Placeholder product description for this listing.',
      product5Category: 'Category Three',
      product5Icon: 'shield',
      product5Title: 'Product Five',
      product5Description: 'Placeholder product description for this listing.',
      product6Category: 'Category Three',
      product6Icon: 'star',
      product6Title: 'Product Six',
      product6Description: 'Placeholder product description for this listing.',
      product7Category: 'Category Four',
      product7Icon: 'hardhat',
      product7Title: 'Product Seven',
      product7Description: 'Placeholder product description for this listing.',
      product8Category: 'Category Four',
      product8Icon: 'shield',
      product8Title: 'Product Eight',
      product8Description: 'Placeholder product description for this listing.',
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionProductsShowcaseRender({
      sectionTitle,
      sectionSubtitle,
      category1Label,
      category2Label,
      category3Label,
      category4Label,
      product1Category,
      product1Icon,
      product1Title,
      product1Description,
      product2Category,
      product2Icon,
      product2Title,
      product2Description,
      product3Category,
      product3Icon,
      product3Title,
      product3Description,
      product4Category,
      product4Icon,
      product4Title,
      product4Description,
      product5Category,
      product5Icon,
      product5Title,
      product5Description,
      product6Category,
      product6Icon,
      product6Title,
      product6Description,
      product7Category,
      product7Icon,
      product7Title,
      product7Description,
      product8Category,
      product8Icon,
      product8Title,
      product8Description,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const categories = [category1Label, category2Label, category3Label, category4Label].filter(
        Boolean
      )
      const products = [
        {
          category: product1Category,
          icon: product1Icon,
          title: product1Title,
          description: product1Description,
        },
        {
          category: product2Category,
          icon: product2Icon,
          title: product2Title,
          description: product2Description,
        },
        {
          category: product3Category,
          icon: product3Icon,
          title: product3Title,
          description: product3Description,
        },
        {
          category: product4Category,
          icon: product4Icon,
          title: product4Title,
          description: product4Description,
        },
        {
          category: product5Category,
          icon: product5Icon,
          title: product5Title,
          description: product5Description,
        },
        {
          category: product6Category,
          icon: product6Icon,
          title: product6Title,
          description: product6Description,
        },
        {
          category: product7Category,
          icon: product7Icon,
          title: product7Title,
          description: product7Description,
        },
        {
          category: product8Category,
          icon: product8Icon,
          title: product8Title,
          description: product8Description,
        },
      ].filter((p) => p.title)
      const [activeTab, setActiveTab] = useState(categories[0] ?? '')
      const visible = products.filter((p) => p.category === activeTab)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap justify-center gap-3 mb-10">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveTab(c)}
                    className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                      c === activeTab
                        ? 'bg-orange-500 text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-orange-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {visible.map((p, i) => {
                const Icon = ICON_BY_KEY[p.icon] ?? HardHatIcon
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md transition"
                  >
                    <div className="text-orange-500 mb-3">
                      <Icon />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">{p.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{p.description}</p>
                  </div>
                )
              })}
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

  // Clients — paginated logo grid
  ConstructionClientsGrid: {
    label: 'Clients (Paginated Grid)',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      client1Logo: { type: 'text' },
      client1Name: { type: 'text' },
      client2Logo: { type: 'text' },
      client2Name: { type: 'text' },
      client3Logo: { type: 'text' },
      client3Name: { type: 'text' },
      client4Logo: { type: 'text' },
      client4Name: { type: 'text' },
      client5Logo: { type: 'text' },
      client5Name: { type: 'text' },
      client6Logo: { type: 'text' },
      client6Name: { type: 'text' },
      client7Logo: { type: 'text' },
      client7Name: { type: 'text' },
      client8Logo: { type: 'text' },
      client8Name: { type: 'text' },
      client9Logo: { type: 'text' },
      client9Name: { type: 'text' },
      client10Logo: { type: 'text' },
      client10Name: { type: 'text' },
      client11Logo: { type: 'text' },
      client11Name: { type: 'text' },
      client12Logo: { type: 'text' },
      client12Name: { type: 'text' },
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
      sectionTitle: 'Trusted By',
      sectionSubtitle: 'A selection of clients we have partnered with.',
      client1Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+1',
      client1Name: 'Client 1',
      client2Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+2',
      client2Name: 'Client 2',
      client3Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+3',
      client3Name: 'Client 3',
      client4Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+4',
      client4Name: 'Client 4',
      client5Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+5',
      client5Name: 'Client 5',
      client6Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+6',
      client6Name: 'Client 6',
      client7Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+7',
      client7Name: 'Client 7',
      client8Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+8',
      client8Name: 'Client 8',
      client9Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+9',
      client9Name: 'Client 9',
      client10Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+10',
      client10Name: 'Client 10',
      client11Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+11',
      client11Name: 'Client 11',
      client12Logo: 'https://placehold.co/200x100/e2e8f0/64748b?text=Client+12',
      client12Name: 'Client 12',
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionClientsGridRender({
      sectionTitle,
      sectionSubtitle,
      client1Logo,
      client1Name,
      client2Logo,
      client2Name,
      client3Logo,
      client3Name,
      client4Logo,
      client4Name,
      client5Logo,
      client5Name,
      client6Logo,
      client6Name,
      client7Logo,
      client7Name,
      client8Logo,
      client8Name,
      client9Logo,
      client9Name,
      client10Logo,
      client10Name,
      client11Logo,
      client11Name,
      client12Logo,
      client12Name,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const clients = [
        { logo: client1Logo, name: client1Name },
        { logo: client2Logo, name: client2Name },
        { logo: client3Logo, name: client3Name },
        { logo: client4Logo, name: client4Name },
        { logo: client5Logo, name: client5Name },
        { logo: client6Logo, name: client6Name },
        { logo: client7Logo, name: client7Name },
        { logo: client8Logo, name: client8Name },
        { logo: client9Logo, name: client9Name },
        { logo: client10Logo, name: client10Name },
        { logo: client11Logo, name: client11Name },
        { logo: client12Logo, name: client12Name },
      ].filter((c) => c.logo)
      const pageSize = 6
      const pageCount = Math.max(1, Math.ceil(clients.length / pageSize))
      const [page, setPage] = useState(0)
      const visible = clients.slice(page * pageSize, page * pageSize + pageSize)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={wrap}>
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
              {sectionSubtitle && (
                <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5 mb-8">
              {visible.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 h-24"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.logo}
                    alt={c.name}
                    className="max-h-10 max-w-full object-contain grayscale hover:grayscale-0 transition"
                  />
                </div>
              ))}
            </div>
            {pageCount > 1 && (
              <div className="flex justify-center gap-2">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Show clients page ${i + 1}`}
                    onClick={() => setPage(i)}
                    className={`w-2.5 h-2.5 rounded-full transition ${
                      i === page ? 'bg-orange-500' : 'bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
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
      quote1Initials: { type: 'text' },
      quote2Text: { type: 'textarea' },
      quote2Author: { type: 'text' },
      quote2Company: { type: 'text' },
      quote2Initials: { type: 'text' },
      quote3Text: { type: 'textarea' },
      quote3Author: { type: 'text' },
      quote3Company: { type: 'text' },
      quote3Initials: { type: 'text' },
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
      quote1Initials: 'VR',
      quote2Text:
        'Their safety record across our 18-month infrastructure project was impeccable. Zero LTIs. We will work with them again.',
      quote2Author: 'Anita Sharma',
      quote2Company: 'National Highways Authority (Vendor)',
      quote2Initials: 'AS',
      quote3Text:
        'Transparent budgeting and weekly reporting made it easy to track progress. No surprises. Highly recommended.',
      quote3Author: 'Mohan Das',
      quote3Company: 'Das Commercial Properties',
      quote3Initials: 'MD',
      padding: 'md',
      background: 'white',
    },
    render: ({
      sectionTitle,
      quote1Text,
      quote1Author,
      quote1Company,
      quote1Initials,
      quote2Text,
      quote2Author,
      quote2Company,
      quote2Initials,
      quote3Text,
      quote3Author,
      quote3Company,
      quote3Initials,
      padding,
      background,
    }) => {
      const quotes = [
        {
          text: quote1Text,
          author: quote1Author,
          company: quote1Company,
          initials: quote1Initials,
        },
        {
          text: quote2Text,
          author: quote2Author,
          company: quote2Company,
          initials: quote2Initials,
        },
        {
          text: quote3Text,
          author: quote3Author,
          company: quote3Company,
          initials: quote3Initials,
        },
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {q.initials}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{q.author}</p>
                      <p className="text-xs text-slate-500">{q.company}</p>
                    </div>
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

  // Milestone timeline — horizontal "our journey" strip
  ConstructionMilestoneTimeline: {
    label: 'Milestone Timeline',
    fields: {
      eyebrow: { type: 'text' },
      heading: { type: 'text' },
      milestone1Year: { type: 'text' },
      milestone1Label: { type: 'text' },
      milestone2Year: { type: 'text' },
      milestone2Label: { type: 'text' },
      milestone3Year: { type: 'text' },
      milestone3Label: { type: 'text' },
      milestone4Year: { type: 'text' },
      milestone4Label: { type: 'text' },
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
          { label: 'White', value: 'white' },
          { label: 'Muted', value: 'muted' },
        ],
      },
    },
    defaultProps: {
      eyebrow: 'Our Journey',
      heading: 'Two Decades of Growth',
      milestone1Year: '1996',
      milestone1Label: 'Founded in Vijayawada',
      milestone2Year: '2008',
      milestone2Label: 'First commercial VRF installation',
      milestone3Year: '2015',
      milestone3Label: '500+ projects delivered',
      milestone4Year: '2024',
      milestone4Label: "Andhra Pradesh's trusted engineering partner",
      padding: 'md',
      background: 'white',
    },
    render: ({
      eyebrow,
      heading,
      milestone1Year,
      milestone1Label,
      milestone2Year,
      milestone2Label,
      milestone3Year,
      milestone3Label,
      milestone4Year,
      milestone4Label,
      padding,
      background,
    }) => {
      const milestones = [
        { year: milestone1Year, label: milestone1Label },
        { year: milestone2Year, label: milestone2Label },
        { year: milestone3Year, label: milestone3Label },
        { year: milestone4Year, label: milestone4Label },
      ].filter((m) => m.year || m.label)
      return (
        <section
          className={`${background === 'muted' ? 'bg-slate-50' : 'bg-white'} ${padY[padding]}`}
        >
          <div className={wrap}>
            <div className="text-center mb-12">
              {eyebrow && (
                <p className="text-orange-600 text-sm font-semibold uppercase tracking-wide mb-2">
                  {eyebrow}
                </p>
              )}
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">{heading}</h2>
            </div>
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-y-10">
              <div className="hidden md:block absolute top-1.5 left-0 right-0 h-px bg-slate-200" />
              {milestones.map((m, i) => (
                <div key={i} className="relative flex flex-col items-center text-center px-2">
                  <span className="w-3 h-3 rounded-full bg-orange-500 mb-4" />
                  <p className="text-lg font-bold text-slate-900">{m.year}</p>
                  <p className="text-sm text-slate-600 mt-1">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // Lead form + FAQ
  ConstructionLeadFormFAQ: {
    label: 'Lead Form + FAQ',
    fields: {
      sectionTitle: { type: 'text' },
      faq1Question: { type: 'text' },
      faq1Answer: { type: 'textarea' },
      faq2Question: { type: 'text' },
      faq2Answer: { type: 'textarea' },
      faq3Question: { type: 'text' },
      faq3Answer: { type: 'textarea' },
      faq4Question: { type: 'text' },
      faq4Answer: { type: 'textarea' },
      faq5Question: { type: 'text' },
      faq5Answer: { type: 'textarea' },
      faq6Question: { type: 'text' },
      faq6Answer: { type: 'textarea' },
      formHeading: { type: 'text' },
      formSubtext: { type: 'textarea' },
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
      sectionTitle: 'Frequently Asked Questions',
      faq1Question: 'How long does a typical project take?',
      faq1Answer:
        'Timelines vary by scope — a detailed schedule is provided after site assessment.',
      faq2Question: 'Do you provide fixed-price contracts?',
      faq2Answer: 'Yes, most projects are quoted and contracted on a fixed-price basis.',
      faq3Question: 'Are you licensed and insured?',
      faq3Answer: 'Yes, we are fully licensed and carry comprehensive insurance cover.',
      faq4Question: 'Can I see your past work?',
      faq4Answer:
        'Yes — see the Sectors and Featured Project sections above, or request our portfolio.',
      faq5Question: 'Do you handle permits and approvals?',
      faq5Answer: 'Yes, permit acquisition is coordinated as part of our project management scope.',
      faq6Question: 'What areas do you serve?',
      faq6Answer: 'We currently serve residential and commercial clients across the region.',
      formHeading: 'Get a Free Quote',
      formSubtext: 'Tell us about your project and our team will get back to you within 48 hours.',
      padding: 'md',
      background: 'white',
    },
    render: function ConstructionLeadFormFAQRender({
      sectionTitle,
      faq1Question,
      faq1Answer,
      faq2Question,
      faq2Answer,
      faq3Question,
      faq3Answer,
      faq4Question,
      faq4Answer,
      faq5Question,
      faq5Answer,
      faq6Question,
      faq6Answer,
      formHeading,
      formSubtext,
      padding,
      background,
    }) {
      const { ref, revealCls } = useScrollReveal<HTMLDivElement>()
      const [openIndex, setOpenIndex] = useState<number | null>(0)
      const faqs = [
        { question: faq1Question, answer: faq1Answer },
        { question: faq2Question, answer: faq2Answer },
        { question: faq3Question, answer: faq3Answer },
        { question: faq4Question, answer: faq4Answer },
        { question: faq5Question, answer: faq5Answer },
        { question: faq6Question, answer: faq6Answer },
      ].filter((f) => f.question)
      return (
        <section
          ref={ref}
          className={`${revealCls} ${padY[padding]} ${background === 'muted' ? 'bg-slate-50' : 'bg-white'}`}
        >
          <div className={`${wrap} md:flex gap-12`}>
            <div className="md:w-1/2 mb-10 md:mb-0">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">{sectionTitle}</h2>
              <div className="flex flex-col gap-3">
                {faqs.map((f, i) => {
                  const isOpen = openIndex === i
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenIndex(isOpen ? null : i)}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-medium text-slate-900"
                      >
                        {f.question}
                        <svg
                          className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen && (
                        <p className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">
                          {f.answer}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{formHeading}</h3>
                {formSubtext && <p className="text-sm text-slate-600 mb-6">{formSubtext}</p>}
                {/*
                  Display-only: no lead-capture endpoint exists in this app
                  yet. Plain div (not <form>) + type="button" submit so
                  nothing navigates or posts on click — deliberate, not an
                  oversight.
                */}
                <div className="flex flex-col gap-4">
                  <input
                    type="text"
                    placeholder="Name"
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                  <select className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700">
                    <option>General Inquiry</option>
                    <option>Residential Project</option>
                    <option>Commercial Project</option>
                    <option>Infrastructure Project</option>
                  </select>
                  <div className="flex gap-5 text-sm text-slate-700">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="lead-form-fake-contact-pref" defaultChecked /> Phone
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="lead-form-fake-contact-pref" /> Email
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="lead-form-fake-contact-pref" /> WhatsApp
                    </label>
                  </div>
                  <textarea
                    placeholder="Message (optional)"
                    rows={3}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm"
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-orange-500 px-6 py-3 text-white font-semibold hover:bg-orange-600 transition text-sm"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )
    },
  },

  // Tagline strip
  ConstructionTaglineStrip: {
    label: 'Tagline Strip',
    fields: {
      logoUrl: { type: 'text' },
      brand: { type: 'text' },
      tagline: { type: 'text' },
    },
    defaultProps: {
      logoUrl: '',
      brand: 'Your Brand',
      tagline: 'Building with integrity, delivering with precision.',
    },
    render: ({ logoUrl, brand, tagline }) => (
      <div className="bg-slate-900 text-white py-6">
        <div className={`${wrap} flex items-center justify-center gap-3 text-center`}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brand} className="h-7 w-auto" />
          )}
          <p className="text-sm font-medium opacity-90">{tagline}</p>
        </div>
      </div>
    ),
  },

  // Floating WhatsApp + back-to-top
  ConstructionFloatingActions: {
    label: 'Floating Actions (WhatsApp + Back to Top)',
    fields: {
      whatsappHref: { type: 'text' },
    },
    defaultProps: {
      whatsappHref: 'https://wa.me/919876543210',
    },
    render: ({ whatsappHref }) => {
      const scrollTop = () => {
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat on WhatsApp"
              className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg hover:bg-green-600 transition"
            >
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.3 14.8l-.3-.2-3 .8.8-3-.2-.3A8 8 0 0 1 12 4zm-2.2 3.6c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.1 1.7 2.7 4.3 3.7 2.1.8 2.5.7 3 .6.4-.1 1.3-.5 1.5-1 .2-.5.2-.9.1-1-.1-.1-.2-.2-.5-.3l-1.9-.9c-.3-.1-.4-.1-.6.1l-.7 1c-.1.2-.3.2-.5.1-.7-.3-1.6-.8-2.3-1.6-.6-.6-1-1.3-1.2-1.7-.1-.2 0-.4.1-.5l.5-.6c.1-.2.1-.3 0-.5l-.9-2.1c-.1-.3-.3-.3-.5-.3h-.3z" />
              </svg>
            </a>
          )}
          <button
            type="button"
            aria-label="Back to top"
            onClick={scrollTop}
            className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-lg hover:bg-slate-800 transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      )
    },
  },

  // 4-column footer
  ConstructionFooter: {
    label: 'Construction Footer (4 Column)',
    fields: {
      logoUrl: { type: 'text' },
      brand: { type: 'text' },
      tagline: { type: 'textarea' },
      social1Label: { type: 'text' },
      social1Href: { type: 'text' },
      social2Label: { type: 'text' },
      social2Href: { type: 'text' },
      social3Label: { type: 'text' },
      social3Href: { type: 'text' },
      social4Label: { type: 'text' },
      social4Href: { type: 'text' },
      newsletterPlaceholder: { type: 'text' },
      newsletterButtonLabel: { type: 'text' },
      companyLinksTitle: { type: 'text' },
      links: { type: 'textarea' },
      contactTitle: { type: 'text' },
      contactPhone: { type: 'text' },
      contactEmail: { type: 'text' },
      contactAddress: { type: 'textarea' },
      showroomTitle: { type: 'text' },
      showroomAddress: { type: 'textarea' },
      qrImage: { type: 'text' },
      qrCaption: { type: 'text' },
      copyright: { type: 'text' },
    },
    defaultProps: {
      logoUrl: '',
      brand: 'Your Brand',
      tagline: 'Building with integrity, delivering with precision.',
      social1Label: 'f',
      social1Href: '#',
      social2Label: 'in',
      social2Href: '#',
      social3Label: 'ig',
      social3Href: '#',
      social4Label: 'x',
      social4Href: '#',
      newsletterPlaceholder: 'Your email address',
      newsletterButtonLabel: 'Subscribe',
      companyLinksTitle: 'Company',
      links: 'Home|#\nAbout|#\nContact|#',
      contactTitle: 'Contact',
      contactPhone: '+91-98765-43210',
      contactEmail: 'info@yourbrand.com',
      contactAddress: '123 Business Avenue\nCity, State 000000',
      showroomTitle: 'Showroom',
      showroomAddress: '456 Showroom Road\nCity, State 000000',
      qrImage: 'https://placehold.co/160x160/ffffff/1e293b?text=QR+Code',
      qrCaption: 'Scan for directions',
      copyright: '© Your Brand. All rights reserved.',
    },
    render: ({
      logoUrl,
      brand,
      tagline,
      social1Label,
      social1Href,
      social2Label,
      social2Href,
      social3Label,
      social3Href,
      social4Label,
      social4Href,
      newsletterPlaceholder,
      newsletterButtonLabel,
      companyLinksTitle,
      links,
      contactTitle,
      contactPhone,
      contactEmail,
      contactAddress,
      showroomTitle,
      showroomAddress,
      qrImage,
      qrCaption,
      copyright,
    }) => {
      const companyLinks = (links || '')
        .split('\n')
        .map((line) => line.split('|'))
        .filter(([label]) => label)
      const socials = [
        { label: social1Label, href: social1Href },
        { label: social2Label, href: social2Href },
        { label: social3Label, href: social3Href },
        { label: social4Label, href: social4Href },
      ].filter((s) => s.label)
      return (
        <footer className="bg-slate-900 text-white pt-16 pb-8">
          <div className={wrap}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
              <div>
                <div className="flex items-center gap-2 font-bold text-lg mb-3">
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={brand} className="h-8 w-auto" />
                  )}
                  <span>{brand}</span>
                </div>
                {tagline && (
                  <p className="text-sm text-white/70 mb-5 whitespace-pre-line">{tagline}</p>
                )}
                {socials.length > 0 && (
                  <div className="flex gap-2 mb-6">
                    {socials.map((s, i) => (
                      <a
                        key={i}
                        href={s.href}
                        aria-label={s.label}
                        className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold hover:bg-white/20 transition"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                )}
                <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
                  <input
                    type="email"
                    placeholder={newsletterPlaceholder}
                    className="min-w-0 flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm placeholder:text-white/50"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold hover:bg-orange-600 transition flex-shrink-0"
                  >
                    {newsletterButtonLabel}
                  </button>
                </form>
              </div>
              <div>
                <h4 className="font-semibold mb-4">{companyLinksTitle}</h4>
                <ul className="flex flex-col gap-2.5 text-sm text-white/70">
                  {companyLinks.map(([label, href], i) => (
                    <li key={i}>
                      <a href={href || '#'} className="hover:text-white transition">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">{contactTitle}</h4>
                <ul className="flex flex-col gap-2.5 text-sm text-white/70">
                  {contactPhone && <li>{contactPhone}</li>}
                  {contactEmail && <li>{contactEmail}</li>}
                  {contactAddress && <li className="whitespace-pre-line">{contactAddress}</li>}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">{showroomTitle}</h4>
                {showroomAddress && (
                  <p className="text-sm text-white/70 whitespace-pre-line mb-4">
                    {showroomAddress}
                  </p>
                )}
                {qrImage && (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImage}
                      alt={qrCaption}
                      className="w-20 h-20 rounded-lg bg-white p-1"
                    />
                    {qrCaption && <p className="text-xs text-white/50 mt-1.5">{qrCaption}</p>}
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/50">
              <p>{copyright}</p>
              <p>Design by KDL</p>
            </div>
          </div>
        </footer>
      )
    },
  },

  // ── Founder / CEO spotlight ────────────────────────────────────────────────
  ConstructionFounder: {
    label: 'Founder',
    fields: {
      sectionTitle: { type: 'text' },
      photo: { type: 'text' },
      quoteText: { type: 'textarea' },
      founderName: { type: 'text' },
      founderTitle: { type: 'text' },
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
      sectionTitle: 'From Our Founder',
      photo: 'https://placehold.co/480x480',
      quoteText:
        'We started this company on one promise: build it right, on time, every time. Twenty years later, that promise still guides every project we take on.',
      founderName: 'Ramesh Kumar',
      founderTitle: 'Founder & Managing Director',
      padding: 'md',
    },
    render: ({ sectionTitle, photo, quoteText, founderName, founderTitle, padding }) => (
      <section className={`${padY[padding]} bg-white`}>
        <div className={wrap}>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
            {sectionTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8 md:gap-12 items-center max-w-4xl mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={founderName}
              className="w-full aspect-square object-cover rounded-2xl"
            />
            <div>
              <svg
                width="36"
                height="28"
                viewBox="0 0 36 28"
                fill="none"
                className="text-orange-300 mb-4"
              >
                <path
                  d="M14.5 0C6.5 3 0 9.5 0 17.5 0 23.3 4.2 28 9.8 28c4.9 0 8.7-3.7 8.7-8.4 0-4.4-3.1-7.7-7.2-7.7-.6 0-1.2.1-1.7.2C10.6 7.4 13.4 4 17.5 1.8L14.5 0zm18 0c-8 3-14.5 9.5-14.5 17.5 0 5.8 4.2 10.5 9.8 10.5 4.9 0 8.7-3.7 8.7-8.4 0-4.4-3.1-7.7-7.2-7.7-.6 0-1.2.1-1.7.2C28.6 7.4 31.4 4 35.5 1.8L32.5 0z"
                  fill="currentColor"
                />
              </svg>
              <p className="text-lg md:text-xl text-slate-800 leading-relaxed mb-6">{quoteText}</p>
              <p className="font-semibold text-slate-900">{founderName}</p>
              <p className="text-sm text-slate-500">{founderTitle}</p>
            </div>
          </div>
        </div>
      </section>
    ),
  },

  // ── Video showcase ─────────────────────────────────────────────────────────
  ConstructionVideo: {
    label: 'Video',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'textarea' },
      thumbnail: { type: 'text' },
      videoUrl: { type: 'text' },
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
      sectionTitle: 'See Us in Action',
      sectionSubtitle: 'A walkthrough of our current build sites and how we work.',
      thumbnail: 'https://placehold.co/1280x720',
      videoUrl: '',
      padding: 'md',
    },
    render: ({ sectionTitle, sectionSubtitle, thumbnail, padding }) => (
      <section className={`${padY[padding]} bg-slate-50`}>
        <div className={wrap}>
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 mb-3">{sectionTitle}</h2>
            {sectionSubtitle && (
              <p className="text-slate-600 max-w-2xl mx-auto">{sectionSubtitle}</p>
            )}
          </div>
          <div className="relative max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-lg aspect-video bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-20 h-20 rounded-full bg-white/95 flex items-center justify-center shadow-xl">
                <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
                  <path d="M0 0L26 15L0 30V0Z" fill="#ea580c" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </section>
    ),
  },

  // ── Blog / news posts ───────────────────────────────────────────────────────
  ConstructionBlogPosts: {
    label: 'Blog Posts',
    fields: {
      sectionTitle: { type: 'text' },
      post1Image: { type: 'text' },
      post1Category: { type: 'text' },
      post1Title: { type: 'text' },
      post1Date: { type: 'text' },
      post2Image: { type: 'text' },
      post2Category: { type: 'text' },
      post2Title: { type: 'text' },
      post2Date: { type: 'text' },
      post3Image: { type: 'text' },
      post3Category: { type: 'text' },
      post3Title: { type: 'text' },
      post3Date: { type: 'text' },
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
      sectionTitle: 'Latest From the Site',
      post1Image: 'https://placehold.co/480x300',
      post1Category: 'Project Update',
      post1Title: 'Riverside Villas reaches structural completion',
      post1Date: 'Mar 12, 2026',
      post2Image: 'https://placehold.co/480x300',
      post2Category: 'Safety',
      post2Title: 'How we hit 400 days without a lost-time incident',
      post2Date: 'Feb 28, 2026',
      post3Image: 'https://placehold.co/480x300',
      post3Category: 'Company News',
      post3Title: 'We are hiring: site engineers and project managers',
      post3Date: 'Feb 10, 2026',
      padding: 'md',
    },
    render: ({
      sectionTitle,
      post1Image,
      post1Category,
      post1Title,
      post1Date,
      post2Image,
      post2Category,
      post2Title,
      post2Date,
      post3Image,
      post3Category,
      post3Title,
      post3Date,
      padding,
    }) => {
      const posts = [
        { image: post1Image, category: post1Category, title: post1Title, date: post1Date },
        { image: post2Image, category: post2Category, title: post2Title, date: post2Date },
        { image: post3Image, category: post3Category, title: post3Title, date: post3Date },
      ]
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={wrap}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map((post, i) => (
                <article
                  key={i}
                  className="rounded-xl overflow-hidden border border-slate-200 group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.image}
                    alt=""
                    className="w-full aspect-[16/10] object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="p-5">
                    <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
                      {post.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1.5 mb-2 leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-xs text-slate-500">{post.date}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // ── Social media strip ──────────────────────────────────────────────────────
  ConstructionSocialMedia: {
    label: 'Social Media',
    fields: {
      sectionTitle: { type: 'text' },
      sectionSubtitle: { type: 'text' },
      facebookHandle: { type: 'text' },
      instagramHandle: { type: 'text' },
      linkedinHandle: { type: 'text' },
      twitterHandle: { type: 'text' },
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
      sectionTitle: 'Follow Our Progress',
      sectionSubtitle: '@yourcompany',
      facebookHandle: 'facebook.com/yourcompany',
      instagramHandle: 'instagram.com/yourcompany',
      linkedinHandle: 'linkedin.com/company/yourcompany',
      twitterHandle: 'x.com/yourcompany',
      padding: 'sm',
    },
    render: ({
      sectionTitle,
      sectionSubtitle,
      facebookHandle,
      instagramHandle,
      linkedinHandle,
      twitterHandle,
      padding,
    }) => {
      const links = [
        ['f', facebookHandle],
        ['ig', instagramHandle],
        ['in', linkedinHandle],
        ['X', twitterHandle],
      ].filter(([, href]) => href)
      return (
        <section className={`${padY[padding]} bg-slate-900`}>
          <div className={`${wrap} flex flex-col sm:flex-row items-center justify-between gap-6`}>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-white">{sectionTitle}</h2>
              {sectionSubtitle && <p className="text-sm text-white/50 mt-1">{sectionSubtitle}</p>}
            </div>
            <div className="flex gap-3">
              {links.map(([label, href], i) => (
                <a
                  key={i}
                  href={href ? `https://${href}` : '#'}
                  className="w-11 h-11 rounded-full bg-white/10 hover:bg-orange-600 text-white flex items-center justify-center font-semibold text-sm transition"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },

  // ── Standalone FAQ accordion ────────────────────────────────────────────────
  ConstructionFAQ: {
    label: 'FAQ',
    fields: {
      sectionTitle: { type: 'text' },
      faq1Question: { type: 'text' },
      faq1Answer: { type: 'textarea' },
      faq2Question: { type: 'text' },
      faq2Answer: { type: 'textarea' },
      faq3Question: { type: 'text' },
      faq3Answer: { type: 'textarea' },
      faq4Question: { type: 'text' },
      faq4Answer: { type: 'textarea' },
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
      sectionTitle: 'Frequently Asked Questions',
      faq1Question: 'How long does a typical project take?',
      faq1Answer:
        'Most residential projects run 4-8 months from groundbreaking to handover, depending on scope. We share a detailed schedule before work begins.',
      faq2Question: 'Do you provide fixed-price contracts?',
      faq2Answer: 'Yes, most projects are quoted and contracted on a fixed-price basis.',
      faq3Question: 'Are you licensed and insured?',
      faq3Answer: 'Yes, we are fully licensed and carry comprehensive insurance cover.',
      faq4Question: 'Can I make changes once construction starts?',
      faq4Answer:
        'Minor changes are usually possible — we log every change order with its cost and schedule impact before proceeding.',
      padding: 'md',
    },
    render: ({
      sectionTitle,
      faq1Question,
      faq1Answer,
      faq2Question,
      faq2Answer,
      faq3Question,
      faq3Answer,
      faq4Question,
      faq4Answer,
      padding,
    }) => {
      const items = [
        { q: faq1Question, a: faq1Answer },
        { q: faq2Question, a: faq2Answer },
        { q: faq3Question, a: faq3Answer },
        { q: faq4Question, a: faq4Answer },
      ].filter((f) => f.q)
      return (
        <section className={`${padY[padding]} bg-white`}>
          <div className={`${wrap} max-w-3xl`}>
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900 text-center mb-10">
              {sectionTitle}
            </h2>
            <div className="flex flex-col gap-3">
              {items.map((item, i) => (
                <details
                  key={i}
                  className="rounded-xl border border-slate-200 p-5 group"
                  {...(i === 0 ? { open: true } : {})}
                >
                  <summary className="font-semibold text-slate-900 cursor-pointer list-none flex items-center justify-between gap-4">
                    {item.q}
                    <span className="text-orange-600 group-open:rotate-45 transition shrink-0">
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-slate-600 leading-relaxed mt-3">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )
    },
  },
}

// ── categories ─────────────────────────────────────────────────────────────────

// ConstructionTopBar/Header/Hero each get their own top-level 'topbar'/'header'/
// 'heroslider' category (see puck.config.tsx) and General's Hero covers 'welcome'
// — the remaining 12 category names below complete the 16-category taxonomy from
// templateEnginesections.html. Every old 'construction-sections'/'construction-cta'/
// 'construction-homepage' grouping is gone; each component now lives under its
// section name, bundled with siblings where more than one fits so pickers have
// real design choices instead of a single card.
const typedCategories: NonNullable<Config<ConstructionProps>['categories']> = {
  counters: {
    title: 'Counters',
    components: [
      'ConstructionStatsStrip',
      'ConstructionSafetyRecord',
      'ConstructionMilestoneTimeline',
    ],
  },
  founder: {
    title: 'Founder',
    components: ['ConstructionFounder', 'ConstructionAboutSplit'],
  },
  video: {
    title: 'Video',
    components: ['ConstructionVideo'],
  },
  blogpost: {
    title: 'Blog Posts',
    components: [
      'ConstructionBlogPosts',
      'ConstructionProjectGallery',
      'ConstructionFeaturedProject',
    ],
  },
  team: {
    title: 'Team',
    components: ['ConstructionTeamCrew', 'ConstructionCertificationsBadges'],
  },
  services: {
    title: 'Services',
    components: [
      'ConstructionServicesGrid',
      'ConstructionOfferingsRows',
      'ConstructionProductsShowcase',
      'ConstructionWhyChooseUs',
      'ConstructionProcessTimeline',
    ],
  },
  faq: {
    title: 'FAQ',
    components: ['ConstructionFAQ'],
  },
  testimonials: {
    title: 'Testimonials',
    components: ['ConstructionTestimonials', 'ConstructionClientsGrid'],
  },
  contact: {
    title: 'Forms',
    components: ['ConstructionLeadFormFAQ'],
  },
  cta: {
    title: 'Call to Action',
    components: [
      'ConstructionQuoteCTA',
      'ConstructionUrgencyBanner',
      'ConstructionTaglineStrip',
      'ConstructionFloatingActions',
    ],
  },
  bottombar: {
    title: 'Footer',
    components: ['ConstructionFooter'],
  },
  socialmedia: {
    title: 'Social Media',
    components: ['ConstructionSocialMedia'],
  },
}

// ── pack export ───────────────────────────────────────────────────────────────

export const construction: ComponentPack = {
  key: 'construction',
  label: 'Construction',
  components: typedComponents as NonNullable<Config['components']>,
  categories: typedCategories,
  variants: {
    ConstructionTopBar: ['1', '2', '3', '4'],
    ConstructionHeader: ['1', '2', '3', '4'],
    ConstructionHero: ['1', '2', '3', '4'],
  },
}
