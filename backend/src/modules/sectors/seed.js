import { prisma } from '../../config/database.js';

// Real Subhadra Group sectors, sourced verbatim from the approved
// sectors.html reference (11 `article.sector-detail` entries). Attached to
// the specific Subhadra project already running in this environment — this
// module has no generic demo data of its own beyond this one client.
const SUBHADRA_PROJECT_ID = 'cmt15bmts000401s6fn5ydhzp';

const SECTORS = [
  {
    eyebrow: '01 · Retail',
    name: 'Showrooms',
    slug: 'showrooms',
    category: 'Retail',
    image: '/seed/subhadra/sectors/showrooms.jpg',
    description:
      "A showroom floor lives or dies on how it feels the moment someone walks in — even cooling, the right light on the merchandise, and systems that quietly protect stock and staff. We size central AC and VRF to footfall and display heat load, and fit LED lighting tuned for retail display.\n\nCCTV with number-plate and face-recognition options covers entrances, aisles and billing counters, PA handles announcements and background audio, and fire alarm and fire-fighting are built into the fit-out from day one — not added after.",
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '02 · Hospitality',
    name: 'Hotel',
    slug: 'hotel',
    category: 'Hospitality',
    image: '/seed/subhadra/case-studies/novotel.jpg',
    description:
      "Guests notice comfort only when it's missing — reliable central AC in every room and public area, dependable power, and back-of-house systems that keep running through a full house. At Novotel Visakhapatnam, we designed and installed exactly this: central AC across guest rooms and the banquet hall, electrical and switchgear, fire and life safety, guest-room automation and diesel power backup, as one coordinated scope.\n\nThe same approach carries to any hotel — cooling sized for lobbies, rooms and banquet halls, PA and professional audio for events, fire alarm and CCTV to compliance, and generators or UPS so operations never stop.",
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '03 · Healthcare',
    name: 'Hospital',
    slug: 'hospital',
    category: 'Healthcare',
    image: '/seed/subhadra/sectors/hospital.jpg',
    description:
      "Hospitals can't afford downtime or a system that fails compliance. We size air conditioning for OTs, ICUs and wards, install fire alarm and fire-fighting systems built to hospital safety codes, and back critical equipment with UPS and servo stabilizers so power quality is never a variable.\n\nCCTV and access control cover wards, entrances and restricted areas, and a public address system keeps patients and visitors informed — all maintained by a dedicated service manager who understands that hospitals can't wait for a callback.",
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '04 · Events & Venues',
    name: 'Convention Center',
    slug: 'convention-center',
    category: 'Events & Venues',
    image: '/seed/subhadra/sectors/convention-center.jpg',
    description:
      'Large halls bring large loads — hundreds of people, stage lighting and sound, and zero tolerance for a system failing mid-event. We engineer high-capacity central AC and chillers for the hall itself, and professional audio and PA for stage reinforcement and public announcements.\n\nFire alarm and fire-fighting are sized for public assembly occupancy, CCTV covers halls, parking and entry points, and diesel generators stand by so an event never loses power halfway through.',
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '05 · Industrial',
    name: 'Industry',
    slug: 'industry',
    category: 'Industrial',
    image: '/seed/subhadra/sectors/industry.jpg',
    description:
      'Plants run on power quality and uptime. We supply and install distribution and power transformers up to 220 kV class, HT/LT switchgear and load break switches, and servo voltage stabilizers that protect CNC machines, cold storage and process equipment from voltage swings.\n\nDiesel generators cover outages without interrupting production, and our service managers stay on for ongoing plant electrical maintenance and AMC support — not just the initial installation.',
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '06 · Education',
    name: 'Educational Institute',
    slug: 'educational-institute',
    category: 'Education',
    image: '/seed/subhadra/sectors/educational-institute.jpg',
    description:
      'A campus is really several buildings — classrooms, hostels, labs and admin blocks — that all need to run to the same standard. We handle campus-wide electrical distribution, DBs and switchgear, plus structured cabling and enterprise Wi-Fi so every block is networked to one standard.\n\nCCTV covers classrooms, hostels and the campus perimeter, PA carries announcements and bell schedules across blocks, and fire alarm is installed to the same code in every building — academic block or hostel.',
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '07 · Government & Public Sector',
    name: 'Government',
    slug: 'government',
    category: 'Government & Public Sector',
    // No local asset for this sector in the approved reference (it uses an
    // Unsplash stock photo directly) — kept identical to the approved
    // sectors.html rather than substituting an unrelated local image.
    image:
      'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1000&h=750&fit=crop&q=80&auto=format',
    description:
      'Public buildings run on accountability as much as uptime — every installation has to meet code, pass audit and hold up under heavy daily footfall. We supply and install electrical distribution, DBs and switchgear for secretariat buildings, municipal offices and PSU premises, sized and documented to government procurement and compliance standards.\n\nFire alarm and fire-fighting are installed to statutory safety codes, CCTV and access control secure entrances and record rooms, diesel generators and UPS keep essential services running through outages, and central or split AC keeps offices and public halls comfortable — all backed by one accountable service team for the life of the contract.',
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '08 · Construction & Development',
    name: 'Builder',
    slug: 'builder',
    category: 'Construction & Development',
    image: '/seed/subhadra/sectors/builder.jpg',
    description:
      "Builders need one MEP partner who delivers the same spec, block after block, on the programme's schedule — not five contractors to coordinate per tower. We supply and install transformers, DBs and switchgear sized to the project load, and pre-wire units for switches, video door phones and automation.\n\nCCTV and access control cover common areas and entrances, and because it's the same team on every block, snags and call-backs go to one number instead of getting lost between vendors.",
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '09 · Residential',
    name: 'Villa',
    slug: 'villa',
    category: 'Residential',
    image: '/seed/subhadra/sectors/villa.jpg',
    description:
      'Private residences deserve comfort that stays out of sight until you need it. We design and install central or split air conditioning sized to each room, wire the home for switches, DBs and lighting from day one, and layer in automation so lighting, curtains, AC and appliances all sit on one interface.\n\nFor residences that want more, we build dedicated Dolby Atmos home theaters with acoustic treatment and recliner seating, multi-room audio, video door phones, CCTV and gate motor automation — all backed by the same service team for the life of the home.',
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '10 · Residential',
    name: 'Premium Flats',
    slug: 'premium-flats',
    category: 'Residential',
    // Same rationale as Government — approved reference uses an Unsplash
    // stock photo here, no local asset exists to swap in.
    image:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000&h=750&fit=crop&q=80&auto=format',
    description:
      "A premium flat has less room for error than a standalone home — every conduit, point and unit has to be right the first time, inside a fixed floor plan and a builder's handover schedule. We plan split or ductable AC, wiring and DBs, home automation and security together, before the interior fit-out begins.\n\nLighting, home theatre and multi-room audio are sized to the space you actually have, and every trade is scheduled around your possession date so the flat is tested and snag-free the day you move in.",
    cta_label: 'Read more →',
    cta_href: '#',
  },
  {
    eyebrow: '11 · Residential Townships',
    name: 'Gated Communities',
    slug: 'gated-communities',
    category: 'Residential Townships',
    // Same rationale as Government/Premium Flats.
    image:
      'https://images.unsplash.com/photo-1580216643062-cf460548a66a?w=1000&h=750&fit=crop&q=80&auto=format',
    description:
      'A township runs on shared infrastructure — one gate, one perimeter, one power supply — so a gap in any single system affects every resident. We design gate automation, access control, perimeter CCTV and electrical distribution as one coordinated scope for the resident welfare association or builder.\n\nStreet and landscape lighting, clubhouse HVAC and PA, and gate-to-home intercom round out the scope, all backed by a single AMC covering the whole community — not one contract per block.',
    cta_label: 'Read more →',
    cta_href: '#',
  },
];

export async function seedSectors(prismaClient = prisma) {
  for (let i = 0; i < SECTORS.length; i++) {
    const sector = SECTORS[i];
    const existing = await prismaClient.sector.findFirst({
      where: { project_id: SUBHADRA_PROJECT_ID, slug: sector.slug },
      select: { id: true },
    });
    if (existing) continue;
    await prismaClient.sector.create({
      data: { ...sector, project_id: SUBHADRA_PROJECT_ID, order: i },
    });
  }
}
