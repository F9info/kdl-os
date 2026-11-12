#!/usr/bin/env python3
"""Builds the flow guides: content.py -> docs/flows/*.md -> PDFs in frontend/public/docs/flows/ (headless
Chrome) and frontend/src/admin/lib/flow-docs.json (the list the Documents page shows).
Screenshots come from img/ (refresh with: cd frontend && node ../docs/flows/screenshots.mjs).
Run: python3 docs/flows/build.py"""
import html, json, os, re, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from content import DOCS, ANNOT, SIZE, CROP

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
OUT = os.path.join(ROOT, 'frontend', 'public', 'docs', 'flows')
LIST = os.path.join(ROOT, 'frontend', 'src', 'admin', 'lib', 'flow-docs.json')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

CSS = """@page{size:A4;margin:16mm 14mm}
*{box-sizing:border-box}
body{font:10.5pt/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#1a2233}
h1{font-size:24pt;color:#fff;background:linear-gradient(120deg,#1d4ed8,#312e81);margin:0 0 10pt;padding:16pt 16pt;border-radius:8px}
h2{font-size:15pt;margin:20pt 0 6pt;color:#0f2a6b;border-bottom:2px solid #c7d2fe;padding-bottom:3pt;break-after:avoid}
h3{font-size:12pt;margin:14pt 0 4pt;color:#1e3a8a;break-after:avoid}
table{border-collapse:collapse;width:100%;margin:8pt 0;font-size:9.5pt;break-inside:avoid}
th,td{border:1px solid #cbd5e1;padding:4pt 7pt;text-align:left;vertical-align:top}
th{background:#eef2ff}
code{background:#f1f5f9;padding:0 3pt;border-radius:3px;font-size:9pt}
ol,ul{padding-left:18pt;margin:4pt 0}li{margin:2pt 0}p{margin:5pt 0}
pre{background:#0f172a;color:#e2e8f0;border-radius:6px;padding:9pt 11pt;font:8.6pt/1.45 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;margin:8pt 0;border-left:4px solid #38bdf8;break-inside:avoid}
pre:before{content:"Terminal";display:block;color:#7dd3fc;font:700 7.5pt -apple-system,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:5pt}
figure{margin:9pt 0;break-inside:avoid;text-align:center}
figure img{width:100%;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 2px 8px rgba(15,23,42,.12)}
figure .w{position:relative}
.pin{position:absolute;display:flex;align-items:center;gap:3pt;transform:translateY(-50%);white-space:nowrap}
.pin.l{flex-direction:row-reverse;transform:translate(-100%,-50%)}
.pin i{width:12pt;height:12pt;border-radius:50%;background:#dc2626;color:#fff;font:700 7.5pt/12pt Arial;text-align:center;font-style:normal;box-shadow:0 0 0 2pt rgba(220,38,38,.3)}
.pin b{background:#dc2626;color:#fff;font:600 8pt Arial;padding:2pt 6pt;border-radius:4px}
figcaption{font-size:8.8pt;color:#475569;margin-top:3pt}
.note{background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;padding:6pt 10pt;margin:8pt 0;font-size:9.8pt;break-inside:avoid}
.flow{display:flex;flex-wrap:wrap;gap:5pt;align-items:center;margin:10pt 0;break-inside:avoid}
.flow span{background:#eef2ff;border:1px solid #a5b4fc;color:#1e3a8a;border-radius:999px;padding:3pt 9pt;font-size:8.8pt;font-weight:600}
.flow i{color:#6366f1;font-style:normal;font-weight:700}
.mock{border:1px solid #cbd5e1;border-radius:10px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.18);width:78%;margin:10pt auto;padding:13pt 15pt;break-inside:avoid}
.mock h4{margin:0 0 2pt;font-size:12pt}.mock p{margin:0 0 8pt;color:#64748b;font-size:9pt}
.mock .card{border:1px solid #cbd5e1;border-radius:7px;padding:7pt 9pt;margin:5pt 0;display:flex;gap:8pt;align-items:flex-start;font-size:9.5pt}
.mock .card.on{border-color:#1d4ed8;background:#eff6ff}
.mock .box{width:11pt;height:11pt;border:1.5px solid #94a3b8;border-radius:3px;flex:none;margin-top:1pt}
.mock .on .box{background:#1d4ed8;border-color:#1d4ed8}
.mock .card small{display:block;color:#64748b;font-size:8.4pt}
.mock .btns{display:flex;justify-content:flex-end;gap:6pt;margin-top:9pt}
.mock .b{border:1px solid #cbd5e1;border-radius:6px;padding:3pt 11pt;font-size:9pt}.mock .b.p{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
.mock .cap{text-align:center;font-size:8.6pt;color:#64748b;margin-top:7pt}
.mcs{display:flex;gap:6pt;margin:8pt 0;break-inside:avoid}
.mc{flex:1;border:1px solid #cbd5e1;border-radius:7px;padding:7pt;background:#fff;font-size:8.6pt}
.mc .mh{display:flex;justify-content:space-between;gap:4pt;align-items:center}.mc .mh span{color:#fff;border-radius:999px;padding:1pt 6pt;font-size:7.4pt;font-weight:700}
.mc small{color:#64748b}.mc .mf{display:flex;gap:4pt;margin-top:6pt;border-top:1px solid #e2e8f0;padding-top:5pt}
.mc .b{border:1px solid #cbd5e1;border-radius:5px;padding:1pt 7pt;font-size:8pt}
.foot{margin-top:18pt;font-size:8.5pt;color:#64748b;border-top:1px solid #cbd5e1;padding-top:5pt}"""

def _card(name, badge, btn, extra=''):
    col = {'Available': '#64748b', 'Installed': '#475569', 'Enabled': '#1d4ed8', 'Disabled': '#dc2626'}[badge]
    return (f'<div class=mc><div class=mh><b>{name}</b><span style="background:{col}">{badge}</span></div>'
            f'<small>v1.0.0</small><div class=mf><span class=b>{btn}</span>{extra}</div></div>')

MOCKS = {
 'states': '<div class=mcs>' + _card('Landing Pages', 'Available', 'Install') + _card('Landing Pages', 'Installed', 'Enable')
           + _card('Landing Pages', 'Enabled', 'Disable', '<span class=b>Settings</span>') + _card('Landing Pages', 'Disabled', 'Enable')
           + '</div><div class=cap>Mockup: the four states of one module card and the button each one shows.</div>',
 'dlg_install': '<div class=mock><h4>Install module</h4><p>Install "landing"? This will register its permissions and seed data.</p><div class=btns><span class=b>Cancel</span><span class="b p">Install</span></div></div>',
 'dlg_enable': '<div class=mock><h4>Enable module</h4><p>Enable "landing"? Routes and nav items will become live immediately.</p><div class=btns><span class=b>Cancel</span><span class="b p">Enable</span></div></div>',
 'toast': '<div class=mock style="width:55%;border-left:4px solid #16a34a"><b>Module installed</b><p style="margin:2pt 0 0">"landing" was installed successfully.</p></div>',
 'wizard2': """<div class=mock><h4>What are you building?</h4><p>Step 2 of 2. Each product turns on the modules it needs.</p>
<div class="card on"><div class=box></div><div><b>Website</b><small>Multi-page corporate site with CMS, menus and page builder.</small></div></div>
<div class=card><div class=box></div><div><b>Landing Pages</b><small>Campaign and product pages built with the page builder.</small></div></div>
<div class=btns><span class=b>Back</span><span class="b p">Next</span></div>
<div class=cap>Mockup of the wizard's product step (Admin is always on, so it has no card).</div></div>""",
 'wizard3': """<div class=mock><h4>Create a starter website?</h4><p>KDL OS can create a ready 5-page website (Home, About, Services, Contact, FAQ) that you can edit. Choose Skip to start with no pages.</p>
<div class=btns><span class=b>Skip</span><span class="b p">Yes, create my website</span></div>
<div class=cap>Mockup of the wizard's website step (shown only when Website is ticked).</div></div>""",
}

def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    return re.sub(r'`(.+?)`', r'<code>\1</code>', t)

def render(md):
    out, lst, tbl, code = [], None, False, None
    def close():
        nonlocal lst, tbl
        if lst: out.append(f'</li></{lst}>'); lst = None
        if tbl: out.append('</tbody></table>'); tbl = False
    for ln in md.split('\n'):
        if code is not None:
            if ln.strip() == '```': out.append('<pre>' + html.escape('\n'.join(code)) + '</pre>'); code = None
            else: code.append(ln)
            continue
        if ln.strip() == '```': close(); code = []; continue
        if ln.startswith('|'):
            cells = [c.strip() for c in ln.strip().strip('|').split('|')]
            if set(''.join(cells)) <= set('-: '): continue
            if lst: close()
            if not tbl:
                out.append('<table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in cells) + '</tr></thead><tbody>'); tbl = True
            else:
                out.append('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in cells) + '</tr>')
            continue
        m = re.match(r'^(\d+)\. (.*)', ln)
        if m:
            if tbl: close()
            if lst == 'ol': out.append('</li>')
            else: close(); out.append(f'<ol start="{m[1]}">'); lst = 'ol'
            out.append(f'<li>{inline(m[2])}'); continue
        m = re.match(r'^(\s*)- (.*)', ln)
        if m:
            if m[1] and lst == 'ol': out.append(f'<ul><li>{inline(m[2])}</li></ul>'); continue
            if tbl: close()
            if lst == 'ul': out.append('</li>')
            else: close(); out.append('<ul>'); lst = 'ul'
            out.append(f'<li>{inline(m[2])}'); continue
        close()
        m = re.match(r'^!\[(.*?)\]\((.*?)\)$', ln.strip())
        if m:
            src = os.path.join(HERE, 'img', m[2] + '.jpg')
            if not os.path.exists(src): raise SystemExit(f'missing screenshot: {src}')
            pins = ''
            W, H = SIZE.get(m[2], (1360, 820)); cr = CROP.get(m[2], 0); H -= cr
            for n, (x, y, lab) in enumerate(ANNOT.get(m[2], []), 1):
                left = lab.startswith('<'); lab = lab.lstrip('<')
                pins += (f'<div class="pin{" l" if left else ""}" style="left:{x*100/W:.2f}%;top:{y*100/H:.2f}%"><i>{n}</i><b>{html.escape(lab)}</b></div>')
            wst = f' style="overflow:hidden;aspect-ratio:{W}/{H}"' if cr else ''
            ist = f' style="margin-top:-{cr*100/W:.3f}%"' if cr else ''
            out.append(f'<figure><div class=w{wst}><img src="file://{src}"{ist}>{pins}</div><figcaption>{inline(m[1])}</figcaption></figure>'); continue
        m = re.match(r'^\[\[mock:(\w+)\]\]$', ln.strip())
        if m: out.append(MOCKS[m[1]]); continue
        m = re.match(r'^\[\[flow: (.*)\]\]$', ln.strip())
        if m:
            out.append('<div class=flow>' + '<i>›</i>'.join(f'<span>{html.escape(x.strip())}</span>' for x in m[1].split('|')) + '</div>'); continue
        if ln.startswith('> '): out.append(f'<div class=note>{inline(ln[2:])}</div>'); continue
        m = re.match(r'^(#{1,3}) (.*)', ln)
        if m: out.append(f'<h{len(m[1])}>{inline(m[2])}</h{len(m[1])}>'); continue
        if ln.strip(): out.append(f'<p>{inline(ln)}</p>')
    close()
    return '\n'.join(out)

def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.pdf'): os.unlink(os.path.join(OUT, f))
    manifest = []
    for slug, (title, goal, md) in DOCS.items():
        open(os.path.join(HERE, slug + '.md'), 'w').write(md)
        page = (f'<!doctype html><meta charset=utf-8><title>{html.escape(title)}</title><style>{CSS}</style>{render(md)}'
                '<div class=foot>KDL OS · Flow guides · Admin &gt; Documents</div>')
        with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f: f.write(page); src = f.name
        pdf = os.path.join(OUT, slug + '.pdf')
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', f'--print-to-pdf={pdf}', 'file://' + src],
                       check=True, capture_output=True, timeout=180)
        os.unlink(src)
        manifest.append({'file': slug + '.pdf', 'title': title, 'goal': goal})
        print('ok', slug, round(os.path.getsize(pdf) / 1024), 'KB')
    with open(LIST, 'w') as f: json.dump(manifest, f, indent=2); f.write('\n')

if __name__ == '__main__':
    main()
