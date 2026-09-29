#!/usr/bin/env python3
"""One-off: extract per-item page content from the client-approved
product-*.html mockups (after-delete-folder/) into
backend/scripts/seed-data/catalog-page-content.json, keyed by catalog slug.
Output is keyed by Puck block type — the catalog resolver overlays each
entry onto the matching block in the shared template.

Usage: python3 backend/scripts/extract-catalog-page-content.py
"""
import json, re, sys
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'after-delete-folder'
OUT = ROOT / 'backend/scripts/seed-data/catalog-page-content.json'

FILES = {
    'switches-wiring-devices': 'product-switches', 'wires': 'product-wires',
    'cables': 'product-cables', 'lights': 'product-lighting',
    'fans-ventilation': 'product-fans', 'mcb-db-switchgear': 'product-switchgear',
    'generators': 'product-generators', 'transformers': 'product-transformers',
    'servo-stabilizers': 'product-servo-stabilizers', 'ups': 'product-ups',
    'load-break-switch': 'product-load-break-switch', 'refrigeration': 'product-refrigeration',
    'cctv': 'product-cctv', 'fire-alarm': 'product-fire-alarm',
    'fire-fighting': 'product-fire-fighting', 'pa-system': 'product-pa-system',
    'access-control': 'product-access-control',
}

# Bootstrap-icon (mockup) -> builder icon key. Falls back to 'star'.
ICONS = [  # first substring match wins; the builder only has 9 icon keys
    ('thermometer', 'snowflake'), ('snow', 'snowflake'), ('wind', 'snowflake'), ('droplet', 'snowflake'),
    ('lightning', 'plug'), ('plug', 'plug'), ('battery', 'plug'), ('server', 'plug'), ('credit', 'plug'),
    ('brightness', 'lightbulb'), ('bulb', 'lightbulb'), ('fire', 'fire'),
    ('shield', 'shield'), ('eye', 'shield'), ('camera', 'shield'), ('lock', 'shield'), ('person-check', 'shield'),
    ('house', 'housegear'), ('building', 'housegear'), ('shop', 'housegear'), ('bank', 'housegear'),
    ('door', 'housegear'), ('p-square', 'housegear'), ('hospital', 'housegear'), ('mortarboard', 'housegear'),
    ('tools', 'hardhat'), ('gear', 'hardhat'), ('rulers', 'hardhat'), ('clipboard', 'hardhat'),
    ('briefcase', 'hardhat'), ('cup', 'hardhat'), ('diagram', 'hardhat'), ('calculator', 'hardhat'),
]
def bi(el):
    """The mockup's own Bootstrap Icons class, e.g. bi-house-heart-fill."""
    i = el.find('i') if el else None
    return next((c for c in (i['class'] if i else []) if c.startswith('bi-')), '')
def icon(el):
    cls = ' '.join(el.find('i')['class']) if el and el.find('i') else ''
    for k, v in ICONS:
        if k in cls: return v
    return 'star'

def t(el): return re.sub(r'\s+', ' ', el.get_text(' ', strip=True)).replace(' ,', ',').replace(' .', '.') if el else ''

import hashlib, urllib.request
IMG_DIR = ROOT / 'frontend/public/seed/subhadra/catalog'
def localize(url):
    """Download a remote mockup image into the seed folder; return its /seed path."""
    name = hashlib.sha1(url.encode()).hexdigest()[:12] + '.jpg'
    dest = IMG_DIR / name
    if not dest.exists():
        IMG_DIR.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        dest.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    return '/seed/subhadra/catalog/' + name

def asset(src):
    """assets/images/x -> /seed/subhadra/x (already copied there); http urls kept."""
    if src.startswith('http'): return localize(src)
    if src.endswith('shop.webp'): return '/seed/subhadra/brand/shop.webp'
    return '/seed/subhadra/' + src.replace('assets/images/', '', 1)

def extract(path):
    s = BeautifulSoup(path.read_text(), 'html.parser')
    ban = s.select_one('section.page-banner')
    crumbs = ban.select('.breadcrumb a')
    ctas = ban.select('.page-banner-cta a')
    banner = {
        'eyebrow': t(ban.select_one('.eyebrow')),
        'headline': t(ban.h1),
        'currentLabel': t(ban.select_one('.breadcrumb .current')),
        'imageAlt': ban.select_one('img')['alt'],
        'backgroundImage': asset(ban.select_one('img')['src']),
        'subtitle': t(ban.select('.container-fluid > p')[-1]),
        'parentLabel': t(crumbs[1]) if len(crumbs) > 1 else '',
        'parentHref': '/products-services',
    }
    if ctas:
        banner['ctaPrimaryLabel'], banner['ctaPrimaryHref'] = t(ctas[0]), '#get-quote'
    if len(ctas) > 1:
        banner['ctaSecondaryLabel'], banner['ctaSecondaryHref'] = t(ctas[1]), '/products-services'
    if len(ctas) > 2:
        # mockup links "See Our Work" to work-<x>.html; kept as the site's /work section
        banner['ctaTertiaryLabel'], banner['ctaTertiaryHref'] = t(ctas[2]), '/work'

    ov = s.select_one('#overview')
    body = ov.select_one('.sector-detail-body')
    paras = [t(p) for p in body.find_all('p', recursive=False) if 'eyebrow' not in (p.get('class') or [])]
    brands = [i['alt'] for i in body.select('.v2-bc-logo img')]
    def logo_path(src):
        folder, name = src.split('ourbrands/', 1)[1].split('/', 1)
        slug = {'Design, Execution & Maintanance': 'design-execution-maintenance', 'Electrical Products': 'electrical-products', 'Life Style Residential Products': 'lifestyle-residential-products'}[folder]
        assert (ROOT / 'frontend/public/seed/subhadra/ourbrands' / slug / name).exists(), src
        return f'/seed/subhadra/ourbrands/{slug}/{name}'
    logos = [{'src': logo_path(i['src']), 'alt': i['alt']} for i in body.select('.v2-bc-logo img')]
    overview = {
        'sectionEyebrow': '', 'sectionTitle': '', 'sectionSubtitle': '',
        'items': [{
            'icon': '', 'eyebrow': t(body.select_one('.eyebrow')), 'heading': t(body.h2),
            'description': '\n\n'.join(paras),
            'checklist': '\n'.join(t(li) for li in body.select('.check-list li')),
            'image': asset(ov.select_one('.sector-detail-media img')['src']),
            'images': [], 'clients': [], 'brandTag': ' · '.join(brands),
            'brandLogos': logos,
            'ctaLabel': 'Enquire →', 'ctaHref': '#get-quote',
        }],
    }

    app = s.select_one('#applications')
    applications = {
        'sectionEyebrow': t(app.select_one('.eyebrow')), 'sectionTitle': t(app.h2),
        'items': [{'icon': icon(c.select_one('.why-icon')), 'biIcon': bi(c.select_one('.why-icon')), 'title': t(c.h4), 'description': t(c.p)}
                  for c in app.select('.why-card')],
    }

    ag = s.select_one('.about-grid')
    hl = ag.select('.point-highlight')
    st = ag.select('.about-stats .stat')
    approach = {
        'photo': asset(ag.select_one('.about-media img')['src']),
        'eyebrow': t(ag.select_one('.eyebrow')), 'heading': t(ag.h2),
        'paragraph1': t(ag.select_one('.about-copy')), 'paragraph2': '',
    }
    for i, h in enumerate(hl[:2], 1):
        approach[f'highlight{i}Icon'] = icon(h.select_one('.why-icon'))
        approach[f'highlight{i}BiIcon'] = bi(h.select_one('.why-icon'))
        approach[f'highlight{i}Title'] = t(h.h4)
        approach[f'highlight{i}Description'] = t(h.p)
    for i, x in enumerate(st[:3], 1):
        approach[f'stat{i}Value'] = t(x.b).replace(' ', '')
        approach[f'stat{i}Label'] = t(x.span)

    steps = s.select('.journey-point')
    hw = steps[0].find_previous('section')
    process = {
        'sectionEyebrow': t(hw.select_one('.eyebrow')), 'sectionTitle': t(hw.h2),
        'items': [{'stepLabel': t(p.select_one('.journey-year')), 'title': t(p.h4), 'description': t(p.p)} for p in steps],
    }

    lead = s.select_one('#get-quote')
    leadForm = {
        'sectionEyebrow': t(lead.select_one('.lead-copy .eyebrow')),
        'sectionTitle': t(lead.select_one('.lead-copy h2')),
        'introText': t(lead.select_one('.lead-copy > p:not(.eyebrow)')),
        'showFaqs': False,
        'checklistItems': '\n'.join(t(li) for li in lead.select('.lead-points li')),
        'trustStats': [{'number': t(d.b), 'label': t(d.span)} for d in lead.select('.lead-trust > div')],
        'formHeading': t(lead.select_one('.lead-form-card h3')),
        'formSubtext': t(lead.select_one('.lead-subtitle')),
        'interestOptions': '\n'.join(t(o) for o in lead.select('select option')),
        'ctaLabel': t(lead.select_one('button[type=submit]')),
        'formPrivacyNote': t(lead.select_one('.lead-privacy')),
    }
    return {
        'ConstructionInnerBanner': banner,
        'ConstructionDisciplineRows': overview,
        'ConstructionIconFeatureGrid': applications,
        'ConstructionApproachSplit': approach,
        'ConstructionProcessSteps': process,
        'ConstructionLeadFormFAQ': leadForm,
    }

out = {slug: extract(SRC / f'{f}.html') for slug, f in FILES.items()}
OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n')
print(f'wrote {len(out)} items -> {OUT}')
