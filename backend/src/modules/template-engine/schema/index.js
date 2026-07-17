/**
 * Template Engine schema — VERBATIM port of the approved prototype
 * `template-engine.html` (script lines 466–1307): BASE_TABS, PANE_OVERRIDES,
 * EXTRA_TABS, PLATFORMS, field constructors, slug(), scaleField() and the
 * PLAT_TABS build loop. Do NOT hand-edit field lists here — this file is the
 * single source of truth shared by the seed generator and (later) the UI.
 * See .agents/TEMPLATE_ENGINE_ARCH.md §Seed generator.
 */
/* =====================================================================
   SETTINGS SCHEMA — pane = Type, group = Category, field = SettingField
   (maps 1:1 to KDL types / categories / setting_fields tables)
===================================================================== */
const C=(l,v,h)=>({l,t:'color',v,h}), N=(l,v,u,h)=>({l,t:'number',v,u,h}),
      SL=(l,v,min,max,u,step)=>({l,t:'slider',v,min,max,u,step}),
      SE=(l,v,o,h)=>({l,t:'select',v,o,h}), TG=(l,v,h)=>({l,t:'toggle',v,h}),
      TX=(l,v,h)=>({l,t:'text',v,h}), PW=(l,v,h)=>({l,t:'password',v,h}),
      RA=(l,v,o,h)=>({l,t:'radio',v,o,h}), MS=(l,v,o,h)=>({l,t:'multiselect',v,o,h}),
      FI=(l,v,h)=>({l,t:'file',v,h}), TA=(l,v,h)=>({l,t:'textarea',v,h}),
      // Typography Scale table: one row per text style {name,size,sizeUnit,
      // family,weight,lineHeight,letterSpacing}. `o` carries the Family
      // column's base choice list (FONTS) through seed's buildOptions, same
      // as SE fields. sizeUnit is one of TYPO_SIZE_UNITS (px/em/in).
      TT=(l,v,h)=>({l,t:'typo_table',v,o:FONTS,h});

const FONTS=['Inter','Sora','Roboto','Poppins','Poppins, Sora','Open Sans','Lato','Montserrat','Source Sans 3','SF Pro','System UI'];
const WEIGHTS=['100','300','400','500','600','700','800'];
const TYPO_SIZE_UNITS=['px','em','in'];

// Per-input-style settings (Forms) — each style is independently editable
const INPUT_STYLE_SECTIONS=(()=>{const out=[];
['Full Border','Underline','Filled','Filled + Border'].forEach(st=>{out.push(
 [st+' Settings',[N('Height',38,'px'),N('Font Size',13,'px'),TX('Padding','8px 12px'),SL('Radius',8,0,20,'px'),N('Border Width',st==='Filled'?0:1,'px'),SE('Font Family','Inter',FONTS),N('Label Font Size',12,'px'),SE('Label Position','Top',['Top','Left','Floating'])],null,'hidden'],
 [st+' Colors',[C('Background Color','#2a2a2e'),C('Text Color','#f2f2f5'),C('Border Color','#3d3d42'),C('Focus Color','#4f8ef7'),C('Placeholder Color','#a5a5ad')],'dark','hidden'],
 [st+' Colors',[C('Background Color','#ffffff'),C('Text Color','#1d1d21'),C('Border Color','#d8d8dd'),C('Focus Color','#0a66f0'),C('Placeholder Color','#9a9aa2')],'light','hidden']
);});return out;})();

const BASE_TABS=[
{id:'branding',icon:'🎨',ic:'#e8554d',label:'Theme Color',desc:'Theme colors — dark and light',
 modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
  ['Brand Colors',[C('Primary Color','#7468F3'),C('Highlight Color','#F7B23B'),C('Secondary Color','#0ea5e9'),C('Tertiary Color','#64d2ff'),C('Accent Color','#a855f7'),C('Titles Text Color','#f2f2f5'),C('Body Text Color','#c7c7ce')],'dark'],
  ['Brand Colors',[C('Primary Color','#2119B3'),C('Highlight Color','#F9941F'),C('Secondary Color','#0284c7'),C('Tertiary Color','#0891b2'),C('Accent Color','#7c3aed'),C('Titles Text Color','#1d1d21'),C('Body Text Color','#3a3a40')],'light'],
  ['Surfaces',[C('Background Color','#1e1e20'),C('Surface Color','#2a2a2e'),C('Card Color','#323236'),C('Sidebar Color','#26262a'),C('Header Color','#2a2a2e'),C('Footer Color','#26262a')],'dark'],
  ['Text & Interaction',[C('Text Primary','#f2f2f5'),C('Text Secondary','#a5a5ad'),C('Text Tertiary','#6e6e76'),C('Link Color','#4f8ef7'),C('Hover Color','#5e9bff'),C('Border Color','#3d3d42'),C('Divider Color','#38383d')],'dark'],
  ['Surfaces',[C('Background Color','#f2f2f7'),C('Surface Color','#ffffff'),C('Card Color','#ffffff'),C('Sidebar Color','#eeeef1'),C('Header Color','#ffffff'),C('Footer Color','#f6f6f8')],'light'],
  ['Text & Interaction',[C('Text Primary','#1d1d21'),C('Text Secondary','#74747c'),C('Text Tertiary','#9a9aa2'),C('Link Color','#0a66f0'),C('Hover Color','#0554cd'),C('Border Color','#d8d8dd'),C('Divider Color','#e0e0e4')],'light'],
]},
{id:'typography',icon:'🔤',ic:'#5e5ce6',label:'Typography',desc:'Fonts, weights and per-device font sizes',
 devices:[{id:'desktop',label:'🖥️ Desktop'},{id:'laptop',label:'💻 Laptop'},{id:'ipad',label:'📱 iPad'},{id:'mobile',label:'📲 Mobile'}],sections:[
  ['Custom Fonts',[{l:'Custom Fonts',t:'fonts',v:[{type:'google',name:'Inter',src:'https://fonts.googleapis.com/css2?family=Inter:wght@300..800'}],h:'Add rows — Google Font URL or upload a font file'}]],
  // Typography Scale: one table per device, one row per text style — replaces
  // the old separate Font Size / Font Weight / Text Rules groups (KDL request:
  // "name, size, family, weight, rules in one table, e.g. h1, 32px, inter, 400").
  ['Typography Scale',[TT('Typography Scale',[
    {name:'H1 (Title)',size:32,family:'Poppins, Sora',weight:'700',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H2',size:26,family:'Poppins, Sora',weight:'700',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H3',size:22,family:'Poppins, Sora',weight:'600',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H4',size:18,family:'Poppins',weight:'600',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H5',size:16,family:'Poppins',weight:'500',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H6',size:14,family:'Poppins',weight:'500',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'Paragraph',size:14,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'Body',size:14,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'List (li)',size:14,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'Small Text',size:12,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'Navigation',size:14,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
  ])],'desktop'],
  ['Typography Scale',[TT('Typography Scale',[
    {name:'H1 (Title)',size:30,family:'Poppins, Sora',weight:'700',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H2',size:24,family:'Poppins, Sora',weight:'700',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H3',size:20,family:'Poppins, Sora',weight:'600',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H4',size:17,family:'Poppins',weight:'600',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H5',size:15,family:'Poppins',weight:'500',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'H6',size:13,family:'Poppins',weight:'500',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'Paragraph',size:14,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'Body',size:14,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'List (li)',size:14,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'Small Text',size:12,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
    {name:'Navigation',size:13,family:'Inter',weight:'400',lineHeight:1.5,letterSpacing:0,sizeUnit:'px'},
  ])],'laptop'],
  ['Typography Scale',[TT('Typography Scale',[
    {name:'H1 (Title)',size:28,family:'Poppins, Sora',weight:'700',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'H2',size:23,family:'Poppins, Sora',weight:'700',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'H3',size:19,family:'Poppins, Sora',weight:'600',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'H4',size:16,family:'Poppins',weight:'600',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'H5',size:14,family:'Poppins',weight:'500',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'H6',size:13,family:'Poppins',weight:'500',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'Paragraph',size:13,family:'Inter',weight:'400',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'Body',size:13,family:'Inter',weight:'400',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'List (li)',size:13,family:'Inter',weight:'400',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'Small Text',size:11,family:'Inter',weight:'400',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
    {name:'Navigation',size:13,family:'Inter',weight:'400',lineHeight:1.45,letterSpacing:0,sizeUnit:'px'},
  ])],'ipad'],
  ['Typography Scale',[TT('Typography Scale',[
    {name:'H1 (Title)',size:24,family:'Poppins, Sora',weight:'700',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'H2',size:20,family:'Poppins, Sora',weight:'700',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'H3',size:18,family:'Poppins, Sora',weight:'600',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'H4',size:15,family:'Poppins',weight:'600',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'H5',size:13,family:'Poppins',weight:'500',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'H6',size:12,family:'Poppins',weight:'500',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'Paragraph',size:13,family:'Inter',weight:'400',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'Body',size:13,family:'Inter',weight:'400',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'List (li)',size:13,family:'Inter',weight:'400',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'Small Text',size:11,family:'Inter',weight:'400',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
    {name:'Navigation',size:13,family:'Inter',weight:'400',lineHeight:1.4,letterSpacing:0,sizeUnit:'px'},
  ])],'mobile'],
]},
{id:'layout',icon:'📐',ic:'#30b0c7',label:'Layout',desc:'Structure, container, grid and spacing — per device',
 devices:[{id:'desktop',label:'🖥️ Desktop'},{id:'laptop',label:'💻 Laptop'},{id:'ipad',label:'📱 iPad'},{id:'mobile',label:'📲 Mobile'}],sections:[
  ['Structure',[SL('Sidebar Width',240,180,360,'px'),RA('Sidebar Position','Left',['Left','Right']),N('Header Height',60,'px'),N('Footer Height',48,'px')],'desktop'],
  ['Structure',[SL('Sidebar Width',220,180,360,'px'),RA('Sidebar Position','Left',['Left','Right']),N('Header Height',56,'px'),N('Footer Height',44,'px')],'laptop'],
  ['Structure',[SL('Sidebar Width',200,160,320,'px'),RA('Sidebar Position','Left',['Left','Right']),N('Header Height',52,'px'),N('Footer Height',40,'px')],'ipad'],
  ['Structure',[SL('Sidebar Width',280,220,360,'px'),RA('Sidebar Position','Left',['Left','Right']),N('Header Height',48,'px'),N('Footer Height',40,'px')],'mobile'],
  ['Container & Grid',[SE('Container Width','1320px',['Fluid (100%)','1140px','1320px','1600px','Custom']),N('Custom Container Width',1320,'px','when Container Width = Custom'),SE('Grid Columns','12',['12','16','24']),SL('Grid Gap',24,0,64,'px'),SL('Card Spacing',16,0,48,'px')],'desktop'],
  ['Container & Grid',[SE('Container Width','1140px',['Fluid (100%)','960px','1140px','1320px','Custom']),N('Custom Container Width',1140,'px','when Container Width = Custom'),SE('Grid Columns','12',['12','16','24']),SL('Grid Gap',20,0,64,'px'),SL('Card Spacing',14,0,48,'px')],'laptop'],
  ['Container & Grid',[SE('Container Width','Fluid (100%)',['Fluid (100%)','720px','960px','Custom']),N('Custom Container Width',960,'px','when Container Width = Custom'),SE('Grid Columns','8',['6','8','12']),SL('Grid Gap',16,0,48,'px'),SL('Card Spacing',12,0,40,'px')],'ipad'],
  ['Container & Grid',[SE('Container Width','Fluid (100%)',['Fluid (100%)','540px','Custom']),N('Custom Container Width',540,'px','when Container Width = Custom'),SE('Grid Columns','4',['2','4','6']),SL('Grid Gap',12,0,32,'px'),SL('Card Spacing',10,0,32,'px')],'mobile'],
  ['Surface Style',[N('Page Padding',24,'px'),SL('Border Radius',10,0,24,'px'),SL('Shadow Level',2,0,5,'')],'desktop'],
  ['Surface Style',[N('Page Padding',20,'px'),SL('Border Radius',10,0,24,'px'),SL('Shadow Level',2,0,5,'')],'laptop'],
  ['Surface Style',[N('Page Padding',16,'px'),SL('Border Radius',10,0,24,'px'),SL('Shadow Level',1,0,5,'')],'ipad'],
  ['Surface Style',[N('Page Padding',12,'px'),SL('Border Radius',8,0,24,'px'),SL('Shadow Level',1,0,5,'')],'mobile'],
]},
{id:'navigation',icon:'🧭',ic:'#32d74b',label:'Navigation',desc:'Sidebar, menus and navigation aids',
 modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
  // Menu Font Size removed — was a second, out-of-sync source of truth for the
  // same concept as Typography Scale's per-device "Navigation" row. That row
  // is now canonical; see AdminSidebar.tsx / ComponentPreviews.tsx.
  ['Sidebar & Menu',[SE('Sidebar Style','Dark',['Dark','Light','Glass','Compact']),SE('Icon Style','Line',['Line','Filled','Duotone']),N('Menu Icon Size',18,'px')]],
  ['Menu Colors',[C('Menu Text Color','#a5a5ad'),C('Menu Hover Color','#323236'),C('Active Menu Color','#4f8ef7'),C('Active Background','#1f3a63')],'dark'],
  ['Menu Colors',[C('Menu Text Color','#66707f'),C('Menu Hover Color','#eceef3'),C('Active Menu Color','#0a66f0'),C('Active Background','#e8f0fe')],'light'],
  ['Behavior',[TG('Expand / Collapse',true),TG('Sticky Sidebar',true),TG('Breadcrumbs',true),TG('Top Navigation',false),TG('Bottom Navigation',false)]],
]},
{id:'buttons',icon:'🔘',ic:'#4f8ef7',label:'Buttons',desc:'Full button styling — per theme and per device',
 modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],
 devices:[{id:'desktop',label:'🖥️ Desktop'},{id:'laptop',label:'💻 Laptop'},{id:'ipad',label:'📱 iPad'},{id:'mobile',label:'📲 Mobile'}],sections:[
  ['Button Defaults',[SE('Button Font','Inter',FONTS),SE('Font Weight','600',WEIGHTS),SE('Loading Style','Spinner',['Spinner','Dots','Progress bar']),TX('Transition','all .2s ease')]],
  ['Button Sizes',[N('Font Size',13,'px'),TX('Padding','10px 20px'),N('Height',38,'px'),SL('Border Radius',8,0,24,'px')],'desktop'],
  ['Button Sizes',[N('Font Size',13,'px'),TX('Padding','9px 18px'),N('Height',36,'px'),SL('Border Radius',8,0,24,'px')],'laptop'],
  ['Button Sizes',[N('Font Size',12,'px'),TX('Padding','8px 16px'),N('Height',34,'px'),SL('Border Radius',8,0,24,'px')],'ipad'],
  ['Button Sizes',[N('Font Size',12,'px'),TX('Padding','8px 14px'),N('Height',40,'px','larger touch target'),SL('Border Radius',8,0,24,'px')],'mobile'],
  ['Primary Button',[C('Background Color','#4f8ef7'),C('Text Color','#ffffff'),C('Hover Color','#3b7bf0'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',2,'px'),N('Shadow Blur',6,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#4f8ef7'),SL('Shadow Opacity',35,0,100,'%')],'dark'],
  ['Secondary Button',[C('Background Color','#48484e'),C('Text Color','#f2f2f5'),C('Hover Color','#55555c'),TX('Border','1px solid #3d3d42'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'dark'],
  ['Tertiary Button',[C('Background Color','#2a2a2e'),C('Text Color','#a5a5ad'),C('Hover Color','#323238'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'dark'],
  ['Outline Button',[C('Background Color','#00000000','transparent background'),C('Text Color','#4f8ef7'),C('Hover Color','#1e2f4d'),TX('Border','1px solid #4f8ef7'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'dark'],
  ['White Button',[C('Background Color','#ffffff'),C('Text Color','#1d1d21'),C('Hover Color','#f0f0f2'),TX('Border','1px solid #d8d8dd'),N('Shadow X',0,'px'),N('Shadow Y',1,'px'),N('Shadow Blur',3,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',12,0,100,'%')],'dark'],
  ['Primary Button',[C('Background Color','#0a66f0'),C('Text Color','#ffffff'),C('Hover Color','#0554cd'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',2,'px'),N('Shadow Blur',6,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#0a66f0'),SL('Shadow Opacity',25,0,100,'%')],'light'],
  ['Secondary Button',[C('Background Color','#e2e2e7'),C('Text Color','#1d1d21'),C('Hover Color','#d4d4da'),TX('Border','1px solid #d8d8dd'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'light'],
  ['Tertiary Button',[C('Background Color','#f2f2f7'),C('Text Color','#74747c'),C('Hover Color','#e8e8ee'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'light'],
  ['Outline Button',[C('Background Color','#00000000','transparent background'),C('Text Color','#0a66f0'),C('Hover Color','#e8f0fe'),TX('Border','1px solid #0a66f0'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'light'],
  ['White Button',[C('Background Color','#ffffff'),C('Text Color','#1d1d21'),C('Hover Color','#f4f4f6'),TX('Border','1px solid #d8d8dd'),N('Shadow X',0,'px'),N('Shadow Y',1,'px'),N('Shadow Blur',3,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',12,0,100,'%')],'light'],
]},
{id:'forms',icon:'📝',ic:'#bf5af2',label:'Forms',desc:'Inputs, labels and validation',
 modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
  // Edited inline in the Live Preview — hidden from the list below
  ['Input Styles',[MS('Input Styles',[],['Full Border','Underline','Filled','Filled + Border'])],null,'hidden'],
  ...INPUT_STYLE_SECTIONS,
  ['Validation Colors',[C('Validation Success','#32d74b'),C('Validation Error','#ff453a')],'dark','hidden'],
  ['Validation Colors',[C('Validation Success','#1f9a3d'),C('Validation Error','#d02f28')],'light','hidden'],
  ['Checkbox & Radio Colors',[C('Checked Color','#4f8ef7'),C('Border Color','#5a5a61'),C('Check Icon Color','#ffffff')],'dark','hidden'],
  ['Checkbox & Radio Colors',[C('Checked Color','#0a66f0'),C('Border Color','#b9b9c0'),C('Check Icon Color','#ffffff')],'light','hidden'],
  ['Switch Colors',[C('Switch On Color','#32d74b'),C('Switch Off Color','#48484e'),C('Knob Color','#ffffff')],'dark','hidden'],
  ['Switch Colors',[C('Switch On Color','#1f9a3d'),C('Switch Off Color','#d4d4da'),C('Knob Color','#ffffff')],'light','hidden'],
  ['Choice Controls',[SE('Checkbox Style','Rounded',['Square','Rounded','Circle','Outline Tick','Tick Only','Cross']),SE('Radio Button Style','Dot',['Dot','Filled','Check','Ring','Square Dot','Diamond']),SE('Switch Style','Pill',['Pill','Square','iOS']),TG('Show ON/OFF Labels',true)],null,'hidden'],
]},
{id:'tables',icon:'📊',ic:'#ff9f0a',label:'Tables',desc:'Data table appearance and tools',
 modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
  ['Table Colors',[C('Header Background','#323236'),C('Header Text Color','#a5a5ad'),C('Row Text Color','#f2f2f5'),C('Alternate Row Color','#2a2a2e'),C('Row Border Color','#3d3d42')],'dark'],
  ['Table Colors',[C('Header Background','#f0f2f5'),C('Header Text Color','#66707f'),C('Row Text Color','#1d1d21'),C('Alternate Row Color','#f6f6f8'),C('Row Border Color','#e0e0e4')],'light'],
  ['Rows & Borders',[N('Row Height',44,'px'),SE('Border Style','Horizontal',['None','Horizontal','Full grid'])]],
  ['Tools',[SE('Pagination Style','Numbered',['Numbered','Simple','Load more','Infinite scroll']),SE('Search Box Style','Rounded',['Rounded','Square','Minimal']),SE('Export Button Style','Dropdown',['Dropdown','Split buttons','Icon only']),TG('Sticky Header',true)]],
]},
{id:'cards',icon:'🃏',ic:'#64d2ff',label:'Cards',desc:'Card surfaces and motion',
 modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
  ['Card Colors',[C('Background Color','#323236'),C('Border Color','#3d3d42')],'dark'],
  ['Card Colors',[C('Background Color','#ffffff'),C('Border Color','#d8d8dd')],'light'],
  ['Surface',[SE('Card Style','Elevated',['Flat','Bordered','Elevated']),SL('Border Radius',12,0,28,'px'),SE('Shadow','Soft',['None','Soft','Medium','Hard']),N('Padding',20,'px')]],
  ['Structure & Motion',[SE('Header Style','Divided',['None','Divided','Filled']),SE('Footer Style','Plain',['None','Plain','Actions bar']),SE('Hover Animation','Lift',['None','Lift','Glow','Scale'])]],
]},
{id:'popup',icon:'🪟',ic:'#ff375f',label:'Popup',desc:'Modals, dialogs and overlay styling',
 modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
  ['Popup Colors',[C('Background Color','#2a2a2e'),C('Text Color','#f2f2f5'),C('Border Color','#3d3d42'),C('Overlay Color','#000000'),C('Close Icon Color','#a5a5ad')],'dark'],
  ['Popup Colors',[C('Background Color','#ffffff'),C('Text Color','#1d1d21'),C('Border Color','#d8d8dd'),C('Overlay Color','#1d1d21'),C('Close Icon Color','#74747c')],'light'],
  ['Size & Shape',[SE('Width','Medium (560px)',['Small (400px)','Medium (560px)','Large (720px)','Full screen']),SL('Border Radius',12,0,28,'px'),N('Padding',24,'px'),TX('Box Shadow','0 20px 60px rgba(0,0,0,.4)')]],
  ['Overlay',[SL('Overlay Opacity',60,0,100,'%'),TG('Overlay Blur',true)]],
  ['Behavior',[SE('Animation','Scale',['None','Fade','Scale','Slide up','Slide down']),N('Animation Duration',200,'ms'),SE('Position','Center',['Center','Top']),TG('Close on Overlay Click',true),TG('Close on Escape Key',true),TG('Show Close Button',true)]],
]},
{id:'alerts',icon:'⚠️',ic:'#ffd60a',label:'Alerts',desc:'Success, warning, error and info alerts',
 modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
  ['Success Alert',[C('Background Color','#0e2a1c'),C('Text Color','#32d74b'),C('Border Color','#1d4d33'),C('Icon Color','#32d74b')],'dark'],
  ['Warning Alert',[C('Background Color','#2a2410'),C('Text Color','#ffd60a'),C('Border Color','#55491a'),C('Icon Color','#ffd60a')],'dark'],
  ['Error Alert',[C('Background Color','#2d1414'),C('Text Color','#ff453a'),C('Border Color','#5c2523'),C('Icon Color','#ff453a')],'dark'],
  ['Info Alert',[C('Background Color','#12233d'),C('Text Color','#4f8ef7'),C('Border Color','#1f3a63'),C('Icon Color','#4f8ef7')],'dark'],
  ['Success Alert',[C('Background Color','#e6f7ec'),C('Text Color','#1f9a3d'),C('Border Color','#b8e6c6'),C('Icon Color','#1f9a3d')],'light'],
  ['Warning Alert',[C('Background Color','#fdf6e0'),C('Text Color','#a87b00'),C('Border Color','#f0dfa3'),C('Icon Color','#a87b00')],'light'],
  ['Error Alert',[C('Background Color','#fdeceb'),C('Text Color','#d02f28'),C('Border Color','#f4c2bf'),C('Icon Color','#d02f28')],'light'],
  ['Info Alert',[C('Background Color','#e8f0fe'),C('Text Color','#0a66f0'),C('Border Color','#bed4f8'),C('Icon Color','#0a66f0')],'light'],
  ['Shape',[SL('Border Radius',8,0,20,'px'),N('Padding',14,'px'),SE('Border Style','Left accent',['None','Full border','Left accent'])]],
  ['Behavior',[TG('Show Icon',true),TG('Dismissible',true),N('Auto Dismiss',5000,'ms','0 = stays until closed'),SE('Toast Position','Top right',['Top right','Top left','Top center','Bottom right','Bottom left','Bottom center']),SE('Animation','Slide',['Slide','Fade','Pop'])]],
]},
{id:'images',icon:'🖼️',ic:'#30d158',label:'Images',desc:'Image size classes per device — use as class="thumbnail-image"',
 devices:[{id:'desktop',label:'🖥️ Desktop'},{id:'laptop',label:'💻 Laptop'},{id:'ipad',label:'📱 iPad'},{id:'mobile',label:'📲 Mobile'}],sections:[
  ['Image Classes',[{l:'Image Classes',t:'imglist',h:'rendered as CSS classes',v:[
    {name:'thumbnail-image',w:150,h:150,fit:'cover'},
    {name:'avatar-image',w:48,h:48,fit:'cover'},
    {name:'card-image',w:400,h:225,fit:'cover'},
    {name:'banner-image',w:1920,h:480,fit:'cover'},
    {name:'gallery-image',w:800,h:600,fit:'contain'},
    {name:'logo-image',w:160,h:40,fit:'contain'},
    {name:'content-image',w:400,h:'auto',fit:'cover'},
    {name:'icon-image',w:'auto',h:75,fit:'contain'},
  ]}],'desktop'],
  ['Image Classes',[{l:'Image Classes',t:'imglist',h:'rendered as CSS classes',v:[
    {name:'thumbnail-image',w:130,h:130,fit:'cover'},
    {name:'avatar-image',w:44,h:44,fit:'cover'},
    {name:'card-image',w:360,h:200,fit:'cover'},
    {name:'banner-image',w:1440,h:400,fit:'cover'},
    {name:'gallery-image',w:700,h:525,fit:'contain'},
    {name:'logo-image',w:150,h:38,fit:'contain'},
  ]}],'laptop'],
  ['Image Classes',[{l:'Image Classes',t:'imglist',h:'rendered as CSS classes',v:[
    {name:'thumbnail-image',w:110,h:110,fit:'cover'},
    {name:'avatar-image',w:40,h:40,fit:'cover'},
    {name:'card-image',w:320,h:180,fit:'cover'},
    {name:'banner-image',w:1024,h:320,fit:'cover'},
    {name:'gallery-image',w:600,h:450,fit:'contain'},
    {name:'logo-image',w:140,h:35,fit:'contain'},
  ]}],'ipad'],
  ['Image Classes',[{l:'Image Classes',t:'imglist',h:'rendered as CSS classes',v:[
    {name:'thumbnail-image',w:90,h:90,fit:'cover'},
    {name:'avatar-image',w:36,h:36,fit:'cover'},
    {name:'card-image',w:340,h:190,fit:'cover'},
    {name:'banner-image',w:640,h:280,fit:'cover'},
    {name:'gallery-image',w:340,h:255,fit:'contain'},
    {name:'logo-image',w:120,h:30,fit:'contain'},
  ]}],'mobile'],
  ['Defaults',[SE('Default Object Fit','cover',['cover','contain','fill','none','scale-down']),SE('Default Object Position','center center',['center center','top center','bottom center','center left','center right','top left','top right','bottom left','bottom right']),SL('Image Border Radius',6,0,24,'px'),TG('Lazy Loading',true),SL('Image Quality',80,10,100,'%')]],
]},
];


/* ===================================================================== */
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const clone=o=>JSON.parse(JSON.stringify(o));

/* ---- Platforms -----------------------------------------------------------
   Each platform keeps a full, independent copy of every pane AND its own
   device sub-tabs, since each renders on different hardware:
     Web App  → Desktop + Laptop/Tablet/Mobile in ↔ horizontal / ↕ vertical
     TV       → 720p / 1080p / 4K / 8K (always landscape, 10-foot UI)
     Android  → Phone / Tablet in ↕ / ↔
     iOS      → iPhone / iPad in ↕ / ↔
   Device sections are authored once (desktop/laptop/ipad/mobile base tags in
   BASE_TABS) and re-mapped per platform via `from`; `scale` multiplies px
   values so TV resolutions start with correctly enlarged defaults. */
const PLATFORMS=[
  {id:'webapp',label:'🌐 Webapp Frontend',devices:[
    {id:'desktop',label:'🖥️ Desktop',from:'desktop'},
    {id:'laptop_h',label:'💻 Laptop ↔',from:'laptop'},{id:'laptop_v',label:'💻 Laptop ↕',from:'laptop'},
    {id:'tablet_h',label:'📱 Tablet ↔',from:'ipad'},{id:'tablet_v',label:'📱 Tablet ↕',from:'ipad'},
    {id:'mobile_h',label:'📲 Mobile ↔',from:'mobile'},{id:'mobile_v',label:'📲 Mobile ↕',from:'mobile'}]},
  // Admin panel gets the same 11-pane BASE_TABS shape as the frontend site
  // (no PANE_OVERRIDES/EXTRA_TABS entry needed — mirrors how 'webapp' itself
  // has none and falls straight through to BASE_TABS verbatim).
  {id:'webapp_admin',label:'🛠️ Webapp Admin',devices:[
    {id:'desktop',label:'🖥️ Desktop',from:'desktop'},
    {id:'laptop_h',label:'💻 Laptop ↔',from:'laptop'},{id:'laptop_v',label:'💻 Laptop ↕',from:'laptop'},
    {id:'tablet_h',label:'📱 Tablet ↔',from:'ipad'},{id:'tablet_v',label:'📱 Tablet ↕',from:'ipad'},
    {id:'mobile_h',label:'📲 Mobile ↔',from:'mobile'},{id:'mobile_v',label:'📲 Mobile ↕',from:'mobile'}]},
  {id:'tv',label:'📺 TV',allDevices:true,devices:[
    {id:'tv_720p',label:'📺 HD 720p',from:'desktop',scale:1},
    {id:'tv_1080p',label:'📺 Full HD 1080p',from:'desktop',scale:1.5},
    {id:'tv_4k',label:'📺 4K Ultra HD',from:'desktop',scale:3},
    {id:'tv_8k',label:'📺 8K',from:'desktop',scale:6}]},
  {id:'android',label:'🤖 Android Native App',devices:[
    {id:'phone_v',label:'📱 Phone ↕',from:'mobile'},{id:'phone_h',label:'📱 Phone ↔',from:'mobile'},
    {id:'tablet_v',label:'📱 Tablet ↕',from:'ipad'},{id:'tablet_h',label:'📱 Tablet ↔',from:'ipad'}]},
  {id:'ios',label:'🍎 iOS Native App',devices:[
    {id:'iphone_v',label:'📱 iPhone ↕',from:'mobile'},{id:'iphone_h',label:'📱 iPhone ↔',from:'mobile'},
    {id:'ipad_v',label:'📱 iPad ↕',from:'ipad'},{id:'ipad_h',label:'📱 iPad ↔',from:'ipad'}]},
];

// Scale px values (numbers, "10px 20px" strings, image class dimensions) for TV.
const scalePx=(v,s)=>{
  if(typeof v==='number') return Math.round(v*s*100)/100;
  if(typeof v==='string') return v.replace(/(-?\d+(?:\.\d+)?)px/g,(m,n)=>Math.round(n*s)+'px');
  return v;
};
const scaleField=(f,s)=>{
  if(!s||s===1) return f;
  if((f.t==='number'||f.t==='slider')&&f.u==='px'){
    f.v=scalePx(f.v,s);
    if(f.min!=null)f.min=scalePx(f.min,s);
    if(f.max!=null)f.max=scalePx(f.max,s);
  }
  else if(f.t==='text') f.v=scalePx(f.v,s);
  else if(f.t==='imglist'&&Array.isArray(f.v)) f.v.forEach(r=>{
    if(r.w!=='auto')r.w=scalePx(r.w,s);
    if(r.h!=='auto')r.h=scalePx(r.h,s);
  });
  return f;
};

/* ---- Native pane redesigns ------------------------------------------------
   Web panes don't map to native apps: Android (Material 3) gets App Bar,
   Bottom Navigation, Drawer, FAB, ripple, dialogs/bottom sheets and snackbars;
   iOS (HIG) gets Navigation Bar with large titles, Tab Bar, action sheets,
   modal sheets with detents and banners; TV gets rail navigation and focus
   states for remote control. `sections` replaces a pane's sections, `append`
   adds extra ones, `patch` overrides field defaults, `label`/`desc`/`modes`
   override pane chrome. */
const PANE_OVERRIDES={
tv:{
  branding:{desc:'Dark theme focus — accent colors and surface colors'},
  typography:{desc:'Large text scaling and font styles for TV viewing distance'},
  layout:{label:'Layout & Grid',desc:'TV grid system, safe margins and overscan handling'},
  navigation:{modes:null,desc:'D-pad navigation — top bar, side rail and menu',sections:[
    ['Navigation Style',[SE('Type','Side Rail',['Top Bar','Side Rail']),N('Rail Width',360,'px'),N('Item Height',64,'px'),N('Item Font Size',24,'px'),TG('Collapse When Content Focused',true)]],
    ['Rail Colors',[C('Background Color','#1a1a1c'),C('Item Text Color','#a5a5ad'),C('Active Item Color','#ffffff'),C('Active Item Background','#323236')]],
    ['Focus & Remote',[C('Focus Ring Color','#4f8ef7'),SL('Focus Ring Width',4,0,10,'px'),SL('Focus Scale',110,100,130,'%'),TG('Focus Glow',true),N('Focus Animation',150,'ms'),TG('Loop Navigation',false)]],
  ]},
  buttons:{desc:'Standard, focused, clickable and icon buttons',append:[
    ['Focus State',[C('Focus Border Color','#ffffff'),SL('Focus Border Width',3,0,8,'px'),SL('Focus Scale',108,100,125,'%'),SL('Focus Elevation',3,0,5,'')]],
  ]},
  forms:{label:'Text Fields & Input',desc:'Keyboard input and search input for TV'},
  cards:{desc:'Content cards, poster cards and live cards'},
  popup:{label:'Dialogs & Overlays',desc:'Modal dialogs and side panels'},
  images:{label:'Images & Thumbnails',desc:'Poster art, fanart and thumbnail styles'},
},
android:{
  typography:{
    patch:{
      'Font Family':{'Heading Font':'Roboto','Body Font':'Roboto','Navigation Font':'Roboto'},
      'Font Size|mobile':{'H1 (Title)':32,'H2':28,'H3':24,'H4':22,'H5':16,'H6':14,'Paragraph (Body)':16,'Small Text':12},
      'Font Size|ipad':{'H1 (Title)':36,'H2':30,'H3':26,'H4':22,'H5':18,'H6':16,'Paragraph (Body)':16,'Small Text':12},
    },
    append:[
      ['Material Type Scale',[N('Display Large',57,'px','line-height 64sp · Roboto Bold'),N('Headline Large',32,'px','line-height 40sp · Roboto Bold'),N('Title Large',22,'px','line-height 28sp · Roboto Medium'),N('Title Medium',16,'px','line-height 24sp · Roboto Medium'),N('Body Large',16,'px','line-height 24sp · Roboto Regular'),N('Body Medium',14,'px','line-height 20sp · Roboto Regular'),N('Label Large',14,'px','line-height 20sp · Roboto Medium'),N('Caption',12,'px','line-height 16sp · Roboto Regular')]],
    ],
  },
  branding:{
    patch:{
      'Brand Colors|light':{'Primary Color':'#0066FF','Secondary Color':'#00A86B','Titles Text Color':'#212121','Body Text Color':'#616161'},
      'Brand Colors|dark':{'Primary Color':'#82B1FF','Secondary Color':'#4CD8A0'},
      'Surfaces|light':{'Background Color':'#F7F8FA','Surface Color':'#FFFFFF','Card Color':'#FFFFFF','Sidebar Color':'#FFFFFF','Header Color':'#FFFFFF','Footer Color':'#FFFFFF'},
      'Surfaces|dark':{'Background Color':'#121212','Surface Color':'#1E1E20','Card Color':'#1E1E20','Sidebar Color':'#1A1A1C','Header Color':'#1E1E20','Footer Color':'#1A1A1C'},
      'Text & Interaction|light':{'Text Primary':'#212121','Text Secondary':'#616161','Link Color':'#0066FF','Hover Color':'#0052CC','Border Color':'#E0E0E0','Divider Color':'#E0E0E0'},
      'Text & Interaction|dark':{'Text Primary':'#E6E6E6','Text Secondary':'#9E9E9E','Link Color':'#82B1FF','Hover Color':'#6E9FEF','Border Color':'#3A3A3C','Divider Color':'#2C2C2E'},
    },
    append:[
      ['Material Color Roles',[C('Primary Container','#1E3A5F'),C('On Primary Container','#DCE8FF'),C('Success Color','#4CD8A0'),C('Warning Color','#FFB74D'),C('Error Color','#EF5350')],'dark'],
      ['Material Color Roles',[C('Primary Container','#DCE8FF'),C('On Primary Container','#0A2540'),C('Success Color','#00A86B'),C('Warning Color','#FFA000'),C('Error Color','#D32F2F')],'light'],
      ['Material You',[TG('Dynamic Color (Material You)',false,'derive palette from wallpaper'),SE('Contrast Level','Standard',['Standard','Medium','High'])]],
    ],
  },
  forms:{label:'Inputs',desc:'Text fields, checkboxes, radio buttons, switches — Material 3',
    patch:{
      'Full Border Settings':{'Height':56,'Font Size':16,'Radius':12,'Border Width':1,'Label Font Size':14,'Font Family':'Roboto','Padding':'12px 16px'},
      'Underline Settings':{'Height':56,'Font Size':16,'Radius':0,'Border Width':1,'Label Font Size':14,'Font Family':'Roboto','Padding':'12px 16px'},
      'Filled Settings':{'Height':56,'Font Size':16,'Radius':12,'Border Width':0,'Label Font Size':14,'Font Family':'Roboto','Padding':'12px 16px'},
      'Filled + Border Settings':{'Height':56,'Font Size':16,'Radius':12,'Border Width':1,'Label Font Size':14,'Font Family':'Roboto','Padding':'12px 16px'},
      'Full Border Colors|light':{'Background Color':'#FFFFFF','Text Color':'#212121','Border Color':'#E0E0E0','Focus Color':'#0066FF','Placeholder Color':'#9E9E9E'},
      'Underline Colors|light':{'Background Color':'#FFFFFF','Text Color':'#212121','Border Color':'#E0E0E0','Focus Color':'#0066FF','Placeholder Color':'#9E9E9E'},
      'Filled Colors|light':{'Background Color':'#F7F8FA','Text Color':'#212121','Border Color':'#E0E0E0','Focus Color':'#0066FF','Placeholder Color':'#9E9E9E'},
      'Filled + Border Colors|light':{'Background Color':'#F7F8FA','Text Color':'#212121','Border Color':'#E0E0E0','Focus Color':'#0066FF','Placeholder Color':'#9E9E9E'},
      'Full Border Colors|dark':{'Background Color':'#1E1E20','Text Color':'#E6E6E6','Border Color':'#3A3A3C','Focus Color':'#82B1FF','Placeholder Color':'#757575'},
      'Underline Colors|dark':{'Background Color':'#1E1E20','Text Color':'#E6E6E6','Border Color':'#3A3A3C','Focus Color':'#82B1FF','Placeholder Color':'#757575'},
      'Filled Colors|dark':{'Background Color':'#26262A','Text Color':'#E6E6E6','Border Color':'#3A3A3C','Focus Color':'#82B1FF','Placeholder Color':'#757575'},
      'Filled + Border Colors|dark':{'Background Color':'#26262A','Text Color':'#E6E6E6','Border Color':'#3A3A3C','Focus Color':'#82B1FF','Placeholder Color':'#757575'},
      'Validation Colors|light':{'Validation Success':'#00A86B','Validation Error':'#D32F2F'},
      'Validation Colors|dark':{'Validation Success':'#4CD8A0','Validation Error':'#EF5350'},
      'Checkbox & Radio Colors|light':{'Checked Color':'#0066FF','Border Color':'#9E9E9E'},
      'Checkbox & Radio Colors|dark':{'Checked Color':'#82B1FF'},
      'Switch Colors|light':{'Switch On Color':'#0066FF','Switch Off Color':'#E0E0E0'},
      'Switch Colors|dark':{'Switch On Color':'#82B1FF'},
    },
    append:[
      ['Slider',[C('Active Track','#0066FF'),C('Inactive Track','#E0E0E0'),C('Thumb Color','#0066FF'),N('Track Height',4,'px'),TG('Show Value Label',true)]],
    ],
  },
  cards:{desc:'Material cards — 16dp radius, 16dp padding, elevation',
    patch:{
      'Card Colors|dark':{'Background Color':'#1E1E20','Border Color':'#3A3A3C'},
      'Card Colors|light':{'Background Color':'#FFFFFF','Border Color':'#E0E0E0'},
      'Surface':{'Border Radius':16,'Padding':16},
    },
    append:[
      ['Material Card Extras',[N('Border Width',1,'px'),SL('Elevation',2,0,5,''),SE('Tap Feedback','Ripple',['None','Ripple','Highlight'])]],
    ],
  },
  images:{label:'Media',desc:'Images, icons and avatars',sections:[
    ['Image Classes',[{l:'Image Classes',t:'imglist',h:'rendered as CSS classes',v:[
      {name:'avatar-small',w:24,h:24,fit:'cover'},
      {name:'avatar-medium',w:40,h:40,fit:'cover'},
      {name:'avatar-large',w:56,h:56,fit:'cover'},
      {name:'avatar-xl',w:72,h:72,fit:'cover'},
      {name:'thumbnail-image',w:96,h:96,fit:'cover'},
      {name:'card-image',w:328,h:184,fit:'cover'},
      {name:'banner-image',w:'auto',h:200,fit:'cover'},
    ]}],'mobile'],
    ['Image Classes',[{l:'Image Classes',t:'imglist',h:'rendered as CSS classes',v:[
      {name:'avatar-small',w:24,h:24,fit:'cover'},
      {name:'avatar-medium',w:40,h:40,fit:'cover'},
      {name:'avatar-large',w:56,h:56,fit:'cover'},
      {name:'avatar-xl',w:72,h:72,fit:'cover'},
      {name:'thumbnail-image',w:120,h:120,fit:'cover'},
      {name:'card-image',w:400,h:225,fit:'cover'},
      {name:'banner-image',w:'auto',h:280,fit:'cover'},
    ]}],'ipad'],
    ['Icons',[N('Small',16,'px'),N('Medium',24,'px'),N('Large',32,'px'),N('Extra Large',48,'px'),SE('Icon Set','Material Symbols',['Material Symbols','Material Icons','Custom'])]],
    ['Defaults',[SE('Default Object Fit','cover',['cover','contain','fill','none','scale-down']),SE('Default Object Position','center center',['center center','top center','bottom center','center left','center right','top left','top right','bottom left','bottom right']),SL('Image Border Radius',8,0,24,'px'),TG('Lazy Loading',true),SL('Image Quality',80,10,100,'%')]],
  ]},
  navigation:{label:'Drawer',desc:'Navigation drawer, app bar & bottom navigation (Material 3)',sections:[
    ['Navigation Drawer',[SE('Type','Modal',['Modal','Standard','Rail']),RA('Position','Left',['Left','Right','Bottom','Top']),SL('Width',320,240,400,'px'),N('Item Height',56,'px'),N('Item Font Size',14,'px'),N('Icon Size',24,'px'),SL('Item Corner Radius',28,0,28,'px'),TX('Item Padding','12px 16px'),N('Section Label Size',12,'px'),TG('Show Section Labels',true),TG('Show Dividers',true)]],
    ['Drawer Header',[SE('Header Style','Profile',['None','Logo','Profile','Cover image']),N('Height',180,'px'),TG('Show Avatar',true),N('Avatar Size',64,'px'),TG('Show Name',true),TG('Show Email',true)]],
    ['Drawer Header Colors',[C('Background Color','#1E3A5F'),C('Name Color','#FFFFFF'),C('Email Color','#C7C7CE')],'dark'],
    ['Drawer Header Colors',[C('Background Color','#0066FF','primary'),C('Name Color','#FFFFFF'),C('Email Color','#DCE8FF')],'light'],
    ['Drawer Colors',[C('Background Color','#1A1A1C'),C('Item Text Color','#C7C7CE'),C('Icon Color','#9E9E9E'),C('Active Item Color','#82B1FF'),C('Active Item Background','#1E3A5F'),C('Section Label Color','#757575'),C('Divider Color','#2C2C2E'),C('Badge Color','#EF5350')],'dark'],
    ['Drawer Colors',[C('Background Color','#FFFFFF'),C('Item Text Color','#3A3A40'),C('Icon Color','#616161'),C('Active Item Color','#0066FF'),C('Active Item Background','#DCE8FF','primary container'),C('Section Label Color','#9E9E9E'),C('Divider Color','#E0E0E0'),C('Badge Color','#D32F2F')],'light'],
    ['Drawer Behavior',[TG('Swipe to Open',true),TG('Close on Item Tap',true),SL('Scrim Opacity',50,0,100,'%'),C('Scrim Color','#000000'),N('Elevation',16,'px'),N('Animation Duration',250,'ms')]],
    ['Navigation Rail',[N('Rail Width',80,'px'),TG('Show Labels',true),SE('Alignment','Top',['Top','Center']),TG('Show FAB in Rail',false)]],
    ['Behavior',[TG('Back Button in App Bar',true),TG('Predictive Back Gesture',true)]],
  ]},
  layout:{desc:'Design tokens — spacing, radius, elevation + screens, lists & grids',sections:[
    ['Screen',[N('Horizontal Margin',16,'px'),N('Vertical Margin',16,'px'),SL('Section Gap',24,0,48,'px'),N('Grid Base Unit',8,'px','8dp grid'),TG('Safe Area',true),TG('Edge-to-Edge Content',true)],'mobile'],
    ['Screen',[N('Horizontal Margin',24,'px'),N('Vertical Margin',24,'px'),SL('Section Gap',32,0,64,'px'),N('Grid Base Unit',8,'px','8dp grid'),TG('Safe Area',true),TG('Edge-to-Edge Content',true)],'ipad'],
    ['Lists',[N('Item Height',56,'px','one-line'),N('Two-line Height',72,'px'),N('Three-line Height',88,'px'),N('Icon Size',24,'px'),N('Title Size',16,'px'),N('Subtitle Size',14,'px'),N('Divider Width',1,'px'),TG('Show Dividers',true)],'mobile'],
    ['Lists',[N('Item Height',56,'px','one-line'),N('Two-line Height',72,'px'),N('Three-line Height',88,'px'),N('Icon Size',24,'px'),N('Title Size',16,'px'),N('Subtitle Size',14,'px'),N('Divider Width',1,'px'),TG('Show Dividers',true)],'ipad'],
    ['Grid',[SE('Grid Columns','2',['1','2','3']),SL('Grid Gap',8,0,32,'px')],'mobile'],
    ['Grid',[SE('Grid Columns','3',['2','3','4','6']),SL('Grid Gap',16,0,40,'px')],'ipad'],
    ['Safe Areas',[TG('Draw Behind Status Bar',true),TG('Draw Behind Gesture Bar',false),N('Gesture Inset',24,'px')]],
    ['Density & Breakpoints',[SE('Density','Default',['Comfortable','Default','Compact']),TG('Window Size Classes',true),N('Compact Max Width',600,'px','window class compact < 600dp'),N('Medium Max Width',840,'px','600–840dp; expanded above')]],
  ]},
  buttons:{desc:'Material buttons — primary, secondary, outlined, text, icon',sections:[
    ['Button Defaults',[SE('Button Font','Roboto',FONTS),SE('Font Weight','500',WEIGHTS),N('Font Size',16,'px','Roboto Medium 16sp'),TX('Padding','12px 24px'),TX('Transition','all .2s ease'),SE('Loading Style','Circular',['Circular','Dots','Progress bar'])]],
    ['Primary Button',[C('Background Color','#82B1FF'),C('Text Color','#0A2540'),C('Pressed Color','#6E9FEF'),TX('Border','none'),N('Height',48,'px'),SL('Corner Radius',12,0,28,'px'),N('Elevation',2,'px')],'dark'],
    ['Secondary Button',[C('Background Color','#2A2A2E','surface'),C('Text Color','#82B1FF'),C('Pressed Color','#323238'),TX('Border','none'),N('Height',48,'px'),SL('Corner Radius',12,0,28,'px'),N('Elevation',0,'px')],'dark'],
    ['Outlined Button',[C('Background Color','#00000000','transparent'),C('Text Color','#82B1FF'),C('Pressed Color','#1E3A5F'),TX('Border','1px solid #5A5A61'),N('Height',48,'px'),SL('Corner Radius',12,0,28,'px'),N('Elevation',0,'px')],'dark'],
    ['Text Button',[C('Background Color','#00000000','transparent'),C('Text Color','#82B1FF'),C('Pressed Color','#1E3A5F'),TX('Border','none'),N('Height',40,'px'),SL('Corner Radius',0,0,28,'px'),N('Elevation',0,'px')],'dark'],
    ['Icon Button',[C('Background Color','#82B1FF'),C('Icon Color','#0A2540'),C('Pressed Color','#6E9FEF'),TX('Border','none'),N('Height',48,'px'),SL('Corner Radius',12,0,28,'px'),N('Icon Size',24,'px'),N('Elevation',2,'px')],'dark'],
    ['Primary Button',[C('Background Color','#0066FF','primary'),C('Text Color','#FFFFFF'),C('Pressed Color','#0052CC'),TX('Border','none'),N('Height',48,'px'),SL('Corner Radius',12,0,28,'px'),N('Elevation',2,'px')],'light'],
    ['Secondary Button',[C('Background Color','#FFFFFF','surface'),C('Text Color','#0066FF'),C('Pressed Color','#F0F4FB'),TX('Border','none'),N('Height',48,'px'),SL('Corner Radius',12,0,28,'px'),N('Elevation',0,'px')],'light'],
    ['Outlined Button',[C('Background Color','#00000000','transparent'),C('Text Color','#0066FF'),C('Pressed Color','#DCE8FF'),TX('Border','1px solid #E0E0E0'),N('Height',48,'px'),SL('Corner Radius',12,0,28,'px'),N('Elevation',0,'px')],'light'],
    ['Text Button',[C('Background Color','#00000000','transparent'),C('Text Color','#0066FF'),C('Pressed Color','#DCE8FF'),TX('Border','none'),N('Height',40,'px'),SL('Corner Radius',0,0,28,'px'),N('Elevation',0,'px')],'light'],
    ['Icon Button',[C('Background Color','#0066FF'),C('Icon Color','#FFFFFF'),C('Pressed Color','#0052CC'),TX('Border','none'),N('Height',48,'px'),SL('Corner Radius',12,0,28,'px'),N('Icon Size',24,'px'),N('Elevation',2,'px')],'light'],
    ['Touch Feedback',[TG('Ripple Effect',true),SL('Ripple Opacity',12,0,40,'%'),N('Min Touch Target',48,'px','accessibility minimum')]],
  ]},
  popup:{label:'Dialogs & Sheets',desc:'Material dialogs, bottom sheets and scrim',sections:[
    ['Dialog',[SL('Corner Radius',24,0,28,'px'),N('Padding',24,'px'),N('Title Size',20,'px'),N('Message Size',16,'px'),N('Button Height',48,'px'),SE('Width','Wrap content',['Wrap content','Fixed 280px','Fixed 320px']),SE('Button Layout','Side by side',['Side by side','Stacked']),SE('Full-screen Dialog','Off',['Off','On compact screens','Always'])]],
    ['Dialog Colors',[C('Background Color','#2f2f33'),C('Title Color','#E6E6E6'),C('Body Color','#c7c7ce'),C('Action Color','#82B1FF')],'dark'],
    ['Dialog Colors',[C('Background Color','#ffffff'),C('Title Color','#212121'),C('Body Color','#616161'),C('Action Color','#0066FF')],'light'],
    ['Bottom Sheet',[SE('Type','Modal',['Modal','Standard']),SL('Corner Radius',28,0,28,'px'),TG('Drag Handle',true),SL('Peek Height',40,10,90,'%')]],
    ['Bottom Sheet Colors',[C('Background Color','#2a2a2e'),C('Drag Handle Color','#5a5a61')],'dark'],
    ['Bottom Sheet Colors',[C('Background Color','#ffffff'),C('Drag Handle Color','#b9b9c0')],'light'],
    ['Side Sheet',[TG('Enable Side Sheet',false),SL('Width',256,200,400,'px'),SE('Type','Modal',['Modal','Standard'])]],
    ['Scrim & Behavior',[C('Scrim Color','#000000'),SL('Scrim Opacity',50,0,100,'%'),TG('Close on Scrim Tap',true),N('Animation Duration',250,'ms')]],
  ]},
  alerts:{label:'Feedback',desc:'Snackbars, toasts, progress indicators and status colors',sections:[
    ['Snackbar',[SE('Position','Bottom',['Bottom','Top']),SL('Corner Radius',8,0,20,'px'),SE('Duration','Short',['Short','Long']),N('Auto Dismiss',4000,'ms'),TG('Show Action Button',true),TG('Swipe to Dismiss',true)]],
    ['Snackbar Colors',[C('Background Color','#E6E6E6','inverse surface'),C('Text Color','#212121'),C('Action Color','#0066FF')],'dark'],
    ['Snackbar Colors',[C('Background Color','#323232','dark grey — per style guide'),C('Text Color','#FFFFFF'),C('Action Color','#82B1FF')],'light'],
    ['Toast',[SE('Duration','Short',['Short','Long']),SE('Position','Bottom',['Bottom','Center','Top'])]],
    ['Progress Indicators',[N('Circular Size',40,'px'),N('Circular Stroke',4,'px'),N('Linear Height',4,'px'),SE('Circular Style','Indeterminate',['Determinate','Indeterminate']),C('Indicator Color','#0066FF','primary'),C('Track Color','#E0E0E0'),SE('Loading Screen','Centered',['Centered','Top bar','Skeleton'])]],
    ['Status Colors',[C('Success Color','#4CD8A0'),C('Warning Color','#FFB74D'),C('Error Color','#EF5350'),C('Info Color','#82B1FF')],'dark'],
    ['Status Colors',[C('Success Color','#00A86B'),C('Warning Color','#FFA000'),C('Error Color','#D32F2F'),C('Info Color','#0066FF')],'light'],
  ]},
},
ios:{
  typography:{
    patch:{
      'Font Family':{'Heading Font':'SF Pro','Body Font':'SF Pro','Navigation Font':'SF Pro'},
      'Font Size|mobile':{'H1 (Title)':34,'H2':28,'H3':22,'H4':20,'H5':17,'H6':15,'Paragraph (Body)':17,'Small Text':13},
      'Font Size|ipad':{'H1 (Title)':34,'H2':28,'H3':24,'H4':20,'H5':17,'H6':15,'Paragraph (Body)':17,'Small Text':13},
    },
    append:[
      ['iOS Type Scale',[N('Large Title',34,'px','SF Pro Display Bold'),N('Title 1',28,'px','SF Pro Display Bold'),N('Title 2',22,'px','SF Pro Display Semibold'),N('Title 3',20,'px','SF Pro Display Semibold'),N('Headline',17,'px','SF Pro Text Semibold'),N('Body',17,'px','SF Pro Text Regular'),N('Callout',16,'px','SF Pro Text Regular'),N('Subheadline',15,'px','SF Pro Text Regular'),N('Footnote',13,'px','SF Pro Text Regular'),N('Caption',12,'px','SF Pro Text Regular')]],
    ],
  },
  branding:{
    patch:{
      'Brand Colors|light':{'Primary Color':'#007AFF','Secondary Color':'#34C759','Titles Text Color':'#000000','Body Text Color':'#3C3C43'},
      'Brand Colors|dark':{'Primary Color':'#0A84FF','Secondary Color':'#30D158'},
      'Surfaces|light':{'Background Color':'#F2F2F7','Surface Color':'#FFFFFF','Card Color':'#FFFFFF','Sidebar Color':'#FFFFFF','Header Color':'#F9F9F9','Footer Color':'#F9F9F9'},
      'Surfaces|dark':{'Background Color':'#000000','Surface Color':'#1C1C1E','Card Color':'#2C2C2E','Sidebar Color':'#1C1C1E','Header Color':'#1C1C1E','Footer Color':'#1C1C1E'},
      'Text & Interaction|light':{'Text Primary':'#000000','Text Secondary':'#3C3C43','Link Color':'#007AFF','Hover Color':'#0062CC','Border Color':'#C6C6C8','Divider Color':'#C6C6C8'},
      'Text & Interaction|dark':{'Text Primary':'#FFFFFF','Text Secondary':'#EBEBF5','Link Color':'#0A84FF','Hover Color':'#409CFF','Border Color':'#38383A','Divider Color':'#38383A'},
    },
    append:[
      ['iOS System Colors',[C('System Blue','#0A84FF','primary actions'),C('System Green','#30D158','success'),C('System Orange','#FF9F0A','warning'),C('System Red','#FF453A','errors'),C('Separator','#38383A','dividers')],'dark'],
      ['iOS System Colors',[C('System Blue','#007AFF','primary actions'),C('System Green','#34C759','success'),C('System Orange','#FF9500','warning'),C('System Red','#FF3B30','errors'),C('Separator','#C6C6C8','dividers')],'light'],
    ],
  },
  forms:{label:'Inputs',desc:'Text fields, pickers, toggles, segmented controls (HIG)',
    patch:{
      'Full Border Settings':{'Height':50,'Font Size':17,'Radius':12,'Border Width':1,'Label Font Size':15,'Font Family':'SF Pro','Padding':'12px 16px'},
      'Underline Settings':{'Height':50,'Font Size':17,'Radius':0,'Border Width':1,'Label Font Size':15,'Font Family':'SF Pro','Padding':'12px 16px'},
      'Filled Settings':{'Height':50,'Font Size':17,'Radius':12,'Border Width':0,'Label Font Size':15,'Font Family':'SF Pro','Padding':'12px 16px'},
      'Filled + Border Settings':{'Height':50,'Font Size':17,'Radius':12,'Border Width':1,'Label Font Size':15,'Font Family':'SF Pro','Padding':'12px 16px'},
      'Full Border Colors|light':{'Background Color':'#FFFFFF','Text Color':'#000000','Border Color':'#C6C6C8','Focus Color':'#007AFF','Placeholder Color':'#8E8E93'},
      'Underline Colors|light':{'Background Color':'#FFFFFF','Text Color':'#000000','Border Color':'#C6C6C8','Focus Color':'#007AFF','Placeholder Color':'#8E8E93'},
      'Filled Colors|light':{'Background Color':'#F2F2F7','Text Color':'#000000','Border Color':'#C6C6C8','Focus Color':'#007AFF','Placeholder Color':'#8E8E93'},
      'Filled + Border Colors|light':{'Background Color':'#F2F2F7','Text Color':'#000000','Border Color':'#C6C6C8','Focus Color':'#007AFF','Placeholder Color':'#8E8E93'},
      'Full Border Colors|dark':{'Background Color':'#1C1C1E','Text Color':'#FFFFFF','Border Color':'#38383A','Focus Color':'#0A84FF','Placeholder Color':'#8E8E93'},
      'Underline Colors|dark':{'Background Color':'#1C1C1E','Text Color':'#FFFFFF','Border Color':'#38383A','Focus Color':'#0A84FF','Placeholder Color':'#8E8E93'},
      'Filled Colors|dark':{'Background Color':'#2C2C2E','Text Color':'#FFFFFF','Border Color':'#38383A','Focus Color':'#0A84FF','Placeholder Color':'#8E8E93'},
      'Filled + Border Colors|dark':{'Background Color':'#2C2C2E','Text Color':'#FFFFFF','Border Color':'#38383A','Focus Color':'#0A84FF','Placeholder Color':'#8E8E93'},
      'Validation Colors|light':{'Validation Success':'#34C759','Validation Error':'#FF3B30'},
      'Validation Colors|dark':{'Validation Success':'#30D158','Validation Error':'#FF453A'},
      'Checkbox & Radio Colors|light':{'Checked Color':'#007AFF'},
      'Checkbox & Radio Colors|dark':{'Checked Color':'#0A84FF'},
      'Switch Colors|light':{'Switch On Color':'#34C759','Switch Off Color':'#E9E9EB'},
      'Switch Colors|dark':{'Switch On Color':'#30D158','Switch Off Color':'#39393D'},
      'Choice Controls':{'Switch Style':'iOS','Checkbox Style':'Circle','Radio Button Style':'Check'},
    },
    append:[
      ['Segmented Control',[N('Height',32,'px'),SE('Style','System',['System','Custom']),N('Font Size',15,'px'),C('Active Background','#FFFFFF'),C('Active Text','#000000'),C('Track Color','#767680'),TG('Haptic on Change',true)]],
      ['Pickers',[SE('Date Picker','Compact',['Wheel','Compact','Inline']),SE('Picker Style','Menu',['Menu','Wheel']),TG('Keyboard Accessory Bar',true)]],
      ['Slider & Stepper',[SE('Slider Style','System',['System','Custom']),C('Slider Tint','#0A84FF'),C('Slider Track','#3A3A3C'),TG('Show Value Label',false),SE('Stepper Style','System',['System','Custom']),C('Stepper Tint','#0A84FF')]],
    ],
  },
  cards:{desc:'iOS cards — 16pt radius, secondary system background',
    patch:{
      'Card Colors|dark':{'Background Color':'#2C2C2E','Border Color':'#38383A'},
      'Card Colors|light':{'Background Color':'#FFFFFF','Border Color':'#C6C6C8'},
      'Surface':{'Border Radius':16,'Padding':16,'Shadow':'Soft'},
    },
  },
  images:{label:'Media',desc:'Images, avatars and SF Symbols',sections:[
    ['Image Classes',[{l:'Image Classes',t:'imglist',h:'rendered as CSS classes',v:[
      {name:'avatar-xs',w:24,h:24,fit:'cover'},
      {name:'avatar-sm',w:32,h:32,fit:'cover'},
      {name:'avatar-md',w:40,h:40,fit:'cover'},
      {name:'avatar-lg',w:56,h:56,fit:'cover'},
      {name:'avatar-xl',w:72,h:72,fit:'cover'},
      {name:'thumbnail-image',w:96,h:96,fit:'cover'},
      {name:'card-image',w:343,h:193,fit:'cover'},
      {name:'banner-image',w:'auto',h:200,fit:'cover'},
    ]}],'mobile'],
    ['Image Classes',[{l:'Image Classes',t:'imglist',h:'rendered as CSS classes',v:[
      {name:'avatar-xs',w:24,h:24,fit:'cover'},
      {name:'avatar-sm',w:32,h:32,fit:'cover'},
      {name:'avatar-md',w:40,h:40,fit:'cover'},
      {name:'avatar-lg',w:56,h:56,fit:'cover'},
      {name:'avatar-xl',w:72,h:72,fit:'cover'},
      {name:'thumbnail-image',w:120,h:120,fit:'cover'},
      {name:'card-image',w:420,h:236,fit:'cover'},
      {name:'banner-image',w:'auto',h:280,fit:'cover'},
    ]}],'ipad'],
    ['SF Symbols',[N('Small',16,'px'),N('Medium',20,'px'),N('Large',24,'px'),N('XL',32,'px'),SE('Icon Library','SF Symbols',['SF Symbols','Custom'])]],
    ['Defaults',[SE('Default Object Fit','cover',['cover','contain','fill','none','scale-down']),SE('Default Object Position','center center',['center center','top center','bottom center','center left','center right','top left','top right','bottom left','bottom right']),SL('Image Border Radius',10,0,24,'px'),TG('Lazy Loading',true),SL('Image Quality',80,10,100,'%')]],
  ]},
  navigation:{label:'Navigation Bar',desc:'Top navigation bar, toolbar & gestures (HIG)',sections:[
    ['Navigation Bar (Top)',[SE('Title Style','Large',['Standard','Large']),N('Bar Height',44,'px'),N('Large Title Size',34,'px'),N('Title Font Size',17,'px'),TG('Translucent (Blur)',true),SE('Back Style','Chevron + Text',['Chevron','Chevron + Text'])]],
    ['Navigation Bar Colors',[C('Background Color','#1c1c1e'),C('Title Color','#ffffff'),C('Tint Color','#0a84ff'),C('Separator Color','#38383a')],'dark'],
    ['Navigation Bar Colors',[C('Background Color','#f9f9f9'),C('Title Color','#000000'),C('Tint Color','#007aff'),C('Separator Color','#c6c6c8')],'light'],
    ['Toolbar & Search',[TG('Bottom Toolbar',false),SE('Search Bar Style','Prominent',['Minimal','Prominent']),TG('Hide Bars on Scroll',true)]],
    ['Search & Filtering',[N('Search Bar Height',36,'px'),SL('Search Bar Radius',10,0,18,'px'),TG('Show Cancel Button',true),TG('Filter Chips',true),TG('Search Tokens',true)]],
    ['Behavior',[TG('Swipe Back Gesture',true),TG('Haptic Feedback',true)]],
  ]},
  layout:{desc:'Screens, safe areas and list styles — per device',sections:[
    ['Screen',[N('Screen Padding',16,'px'),SL('Content Corner Radius',10,0,26,'px'),SL('Card Spacing',12,0,32,'px')],'mobile'],
    ['Screen',[N('Screen Padding',20,'px'),SL('Content Corner Radius',12,0,26,'px'),SL('Card Spacing',16,0,40,'px')],'ipad'],
    ['List Style',[SE('List Type','Inset Grouped',['Plain','Grouped','Inset Grouped','Sidebar']),SL('Row Corner Radius',10,0,20,'px'),N('Row Height',44,'px')],'mobile'],
    ['List Style',[SE('List Type','Inset Grouped',['Plain','Grouped','Inset Grouped','Sidebar']),SL('Row Corner Radius',10,0,20,'px'),N('Row Height',44,'px')],'ipad'],
    ['Safe Areas',[TG('Respect Safe Areas',true),TG('Extend Behind Home Indicator',false),N('Extra Bottom Inset',0,'px')]],
  ]},
  buttons:{desc:'iOS buttons — filled, tinted, gray, bordered, plain (HIG)',sections:[
    ['Button Defaults',[SE('Button Font','SF Pro',FONTS),SE('Font Weight','600',WEIGHTS),SE('Loading Style','Spinner',['Spinner','Dots','Progress bar']),TX('Transition','all .2s ease')]],
    ['Button Sizes',[N('Font Size',17,'px'),TX('Padding','14px 20px'),N('Height',50,'px'),SL('Border Radius',12,0,26,'px')],'mobile'],
    ['Button Sizes',[N('Font Size',17,'px'),TX('Padding','14px 20px'),N('Height',50,'px'),SL('Border Radius',12,0,26,'px')],'ipad'],
    ['Filled Button',[C('Background Color','#0a84ff'),C('Text Color','#ffffff'),C('Pressed Color','#096dd1'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'dark'],
    ['Tinted Button',[C('Background Color','#0a84ff26','15% tint fill'),C('Text Color','#0a84ff'),C('Pressed Color','#0a84ff40'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'dark'],
    ['Gray Button',[C('Background Color','#3a3a3c'),C('Text Color','#0a84ff'),C('Pressed Color','#48484a'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'dark'],
    ['Bordered Button',[C('Background Color','#00000000','transparent background'),C('Text Color','#0a84ff'),C('Pressed Color','#2c2c2e'),TX('Border','1px solid #48484a'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'dark'],
    ['Plain Button',[C('Background Color','#00000000','transparent background'),C('Text Color','#0a84ff'),C('Pressed Color','#ffffff14'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'dark'],
    ['Filled Button',[C('Background Color','#007aff'),C('Text Color','#ffffff'),C('Pressed Color','#0062cc'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'light'],
    ['Tinted Button',[C('Background Color','#007aff26','15% tint fill'),C('Text Color','#007aff'),C('Pressed Color','#007aff40'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'light'],
    ['Gray Button',[C('Background Color','#e9e9eb'),C('Text Color','#007aff'),C('Pressed Color','#dcdce0'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'light'],
    ['Bordered Button',[C('Background Color','#00000000','transparent background'),C('Text Color','#007aff'),C('Pressed Color','#f2f2f7'),TX('Border','1px solid #c6c6c8'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'light'],
    ['Plain Button',[C('Background Color','#00000000','transparent background'),C('Text Color','#007aff'),C('Pressed Color','#00000010'),TX('Border','none'),N('Shadow X',0,'px'),N('Shadow Y',0,'px'),N('Shadow Blur',0,'px'),N('Shadow Spread',0,'px'),C('Shadow Color','#000000'),SL('Shadow Opacity',0,0,100,'%')],'light'],
    ['Control & Haptics',[SE('Control Size','Large',['Small','Medium','Large']),TG('Haptic on Tap',true)]],
  ]},
  popup:{label:'Alerts & Sheets',desc:'Alert dialogs, action sheets and modal sheets',sections:[
    ['Alert Dialog',[SL('Corner Radius',14,0,24,'px'),SE('Button Layout','Stacked',['Side by side','Stacked']),TG('Blur Background',true)]],
    ['Alert Colors',[C('Background Color','#2c2c2e'),C('Title Color','#ffffff'),C('Message Color','#aeaeb2'),C('Action Color','#0a84ff'),C('Destructive Color','#ff453a')],'dark'],
    ['Alert Colors',[C('Background Color','#f2f2f7'),C('Title Color','#000000'),C('Message Color','#3c3c43'),C('Action Color','#007aff'),C('Destructive Color','#ff3b30')],'light'],
    ['Action Sheet',[TG('Show Cancel Button',true),SL('Corner Radius',14,0,24,'px'),TG('Blur Background',true)]],
    ['Sheet (Modal)',[SE('Detents','Medium + Large',['Medium','Large','Medium + Large']),TG('Show Grabber',true),SL('Corner Radius',10,0,24,'px')]],
    ['Overlay',[SL('Dim Opacity',40,0,100,'%'),TG('Tap Outside to Dismiss',true),N('Animation Duration',300,'ms')]],
  ]},
  alerts:{label:'Progress & Feedback',desc:'Banners, toasts, spinners, progress bars & status colors',sections:[
    ['Notification Banner',[SE('Position','Top',['Top','Bottom']),SL('Corner Radius',12,0,24,'px'),N('Auto Dismiss',4000,'ms'),TG('Blur Background',true),TG('Haptic on Show',true)]],
    ['Banner Colors',[C('Background Color','#2c2c2e'),C('Title Color','#ffffff'),C('Message Color','#aeaeb2')],'dark'],
    ['Banner Colors',[C('Background Color','#ffffff'),C('Title Color','#000000'),C('Message Color','#3c3c43')],'light'],
    ['Progress Indicators',[SE('Activity Indicator','Medium',['Medium','Large']),C('Indicator Tint','#8e8e93'),N('Progress Bar Height',4,'px'),C('Progress Tint','#0a84ff'),C('Progress Track','#3a3a3c')]],
    ['Toast',[SL('Toast Radius',12,0,24,'px'),N('Toast Font Size',15,'px'),SE('Toast Position','Bottom',['Top','Bottom']),N('Toast Auto Dismiss',3000,'ms')]],
    ['Status Colors',[C('Success Color','#30d158'),C('Warning Color','#ffd60a'),C('Error Color','#ff453a'),C('Info Color','#0a84ff')],'dark'],
    ['Status Colors',[C('Success Color','#34c759'),C('Warning Color','#ffcc00'),C('Error Color','#ff3b30'),C('Info Color','#007aff')],'light'],
  ]},
},
};

/* ---- Platform-specific EXTRA panes (added to the sidebar, per platform) ---- */
const EXTRA_TABS={
tv:[
 {after:'layout',id:'dimensions',icon:'🖥️',ic:'#30b0c7',label:'Dimensions & Resolution',desc:'720p / 1080p / 4K scaling, DPI buckets and overscan',sections:[
   ['Resolution & Scaling',[SE('Design Baseline','1080p',['720p','1080p','4K','8K'],'authoring resolution — others scale from it'),SE('DPI Bucket','xhdpi (320dpi)',['tvdpi (213dpi)','hdpi (240dpi)','xhdpi (320dpi)','xxhdpi (480dpi)']),TG('Auto Scale UI',true,'scale px values by resolution'),SL('Global UI Scale',100,50,300,'%',5)]],
   ['Overscan & Safe Area',[SL('Horizontal Safe Margin',48,0,96,'px'),SL('Vertical Safe Margin',27,0,64,'px'),TG('Apply Overscan Insets',true,'keep UI inside the title-safe area')]],
   ['Display',[SE('Aspect Ratio','16:9',['16:9','21:9','4:3']),TG('4K Asset Variants',true,'serve @2x posters on 4K / 8K')]],
 ]},
 {after:'navigation',id:'search',icon:'🔍',ic:'#ff9f0a',label:'Search',desc:'Global search and voice search UI',sections:[
   ['Search Screen',[SE('Layout','Keyboard left',['Keyboard left','Keyboard top']),N('Input Font Size',36,'px'),C('Input Text Color','#ffffff'),C('Placeholder Color','#6e6e76'),TX('Placeholder Text','Search movies, shows…')]],
   ['On-screen Keyboard',[SE('Keyboard Style','Grid',['Grid','Row']),N('Key Size',48,'px'),C('Key Color','#26262a'),C('Key Focused Color','#4f8ef7'),SL('Key Corner Radius',8,0,24,'px')]],
   ['Voice Search',[TG('Enable Voice Search',true),C('Mic Accent Color','#ff453a'),TG('Show Voice Hint',true)]],
   ['Results',[SE('Results Layout','Grid',['Grid','Rows']),N('Results Columns',5,''),TG('Search While Typing',true),N('Debounce',300,'ms')]],
 ]},
 {after:'buttons',id:'controls',icon:'🎚️',ic:'#bf5af2',label:'Controls',desc:'Switches, sliders, radio groups and checkboxes for D-pad',sections:[
   ['Switches',[SE('Style','Pill',['Pill','Square']),C('On Color','#4f8ef7'),C('Off Color','#48484e'),C('Knob Color','#ffffff'),N('Width',52,'px'),N('Height',28,'px')]],
   ['Sliders',[C('Active Track','#4f8ef7'),C('Inactive Track','#3d3d42'),C('Thumb Color','#ffffff'),N('Track Height',6,'px'),N('Thumb Size',20,'px'),TG('Show Value Label',true)]],
   ['Radio Groups',[SE('Style','Dot',['Dot','Filled','Check']),C('Checked Color','#4f8ef7'),C('Border Color','#5a5a61'),N('Size',24,'px')]],
   ['Checkboxes',[SE('Style','Rounded',['Square','Rounded','Circle']),C('Checked Color','#4f8ef7'),C('Check Icon Color','#ffffff'),N('Size',24,'px')]],
   ['Focus State',[C('Focus Ring Color','#4f8ef7'),SL('Focus Ring Width',3,0,8,'px'),SL('Focus Scale',105,100,120,'%')]],
 ]},
 {after:'forms',id:'lists',icon:'📜',ic:'#32d74b',label:'Lists & Rows',desc:'Horizontal browse rows and vertical lists',sections:[
   ['Browse Rows (Horizontal)',[N('Row Header Font Size',24,'px'),C('Row Header Color','#f2f2f5'),N('Item Spacing',24,'px'),N('Row Spacing',40,'px'),SL('Visible Cards',5,3,8,''),TG('Infinite Scroll',true)]],
   ['Vertical Lists',[N('Item Height',72,'px'),N('Item Font Size',22,'px'),C('Item Text Color','#f2f2f5'),C('Focused Background','#323236'),SL('Corner Radius',8,0,20,'px'),TG('Show Dividers',false)]],
   ['Scrolling & Alignment',[SE('Focus Alignment','Start',['Start','Center']),N('Scroll Animation',250,'ms'),TG('Remember Row Position',true)]],
 ]},
 {after:'cards',id:'surfaces',icon:'🌑',ic:'#5e5ce6',label:'Surfaces & Backgrounds',desc:'Dark surfaces and Leanback background',sections:[
   ['Dark Surfaces',[C('App Background','#0d0d0f'),C('Surface Color','#1a1a1c'),C('Card Surface','#26262a'),C('Elevated Surface','#323236')]],
   ['Leanback Background',[TG('Dynamic Background',true,'backdrop follows the focused content'),SL('Background Dim',40,0,100,'%'),SL('Background Blur',20,0,60,'px'),N('Crossfade Duration',500,'ms'),C('Fallback Color','#0d0d0f')]],
   ['Gradients & Scrims',[TG('Bottom Scrim',true),C('Scrim Color','#000000'),SL('Scrim Opacity',60,0,100,'%')]],
 ]},
 {after:'surfaces',id:'icons',icon:'🔣',ic:'#8e8e93',label:'Icons',desc:'TV-optimized icon sizes and style',sections:[
   ['Icon Sizes',[N('Small',24,'px'),N('Medium',32,'px'),N('Large',48,'px'),N('XL',64,'px')]],
   ['Icon Style',[SE('Icon Set','Material Symbols',['Material Symbols','Material Icons','Custom']),SE('Style','Line',['Line','Filled','Duotone']),C('Default Color','#a5a5ad'),C('Focused Color','#ffffff'),C('Active Color','#4f8ef7')]],
 ]},
 {after:'images',id:'details',icon:'🎬',ic:'#ff375f',label:'Details View',desc:'Content details screen layout',sections:[
   ['Layout',[SE('Hero Style','Backdrop',['Backdrop','Poster left','Split']),SL('Backdrop Height',55,30,80,'%'),N('Content Padding',56,'px'),SE('Poster Size','Medium',['Small','Medium','Large'])]],
   ['Text',[N('Title Size',48,'px'),N('Metadata Size',22,'px'),N('Description Size',24,'px'),N('Description Max Lines',3,''),C('Title Color','#ffffff'),C('Metadata Color','#a5a5ad')]],
   ['Actions Row',[SE('Primary Action','Play',['Play','Resume','Watch now']),TG('Show Trailer Button',true),TG('Show Watchlist Button',true),N('Action Button Height',56,'px')]],
   ['Related Content',[TG('Show Related Row',true),TX('Related Row Title','More Like This')]],
 ]},
 {after:'details',id:'playback',icon:'▶️',ic:'#ff2d55',label:'Playback Controls',desc:'Video player UI and transport controls',sections:[
   ['Transport Controls',[N('Control Icon Size',40,'px'),C('Icon Color','#ffffff'),C('Focused Icon Color','#4f8ef7'),SE('Controls','Play/Pause + Seek',['Play/Pause only','Play/Pause + Seek','Full (skip, subtitles, settings)']),TG('Show Time Remaining',true)]],
   ['Progress Bar',[N('Bar Height',8,'px'),C('Played Color','#4f8ef7'),C('Buffered Color','#5a5a61'),C('Track Color','#3d3d42'),C('Scrubber Color','#ffffff'),TG('Show Thumbnail Preview',true)]],
   ['Overlay & Auto-hide',[SL('Overlay Opacity',70,0,100,'%'),N('Auto-hide Delay',5000,'ms'),TG('Show Title While Playing',true),TG('Pause on Menu Open',true)]],
   ['Subtitles',[N('Subtitle Font Size',32,'px'),C('Subtitle Color','#ffffff'),C('Subtitle Background','#000000'),SL('Subtitle Background Opacity',60,0,100,'%')]],
 ]},
 {after:'popup',id:'progress',icon:'⏳',ic:'#ffd60a',label:'Progress & Loading',desc:'Progress bars, spinners and skeletons',sections:[
   ['Spinner',[SE('Style','Circular',['Circular','Dots','Pulse']),N('Size',48,'px'),C('Spinner Color','#4f8ef7'),N('Stroke Width',5,'px')]],
   ['Progress Bar',[N('Height',6,'px'),C('Fill Color','#4f8ef7'),C('Track Color','#3d3d42'),SL('Corner Radius',3,0,8,'px')]],
   ['Watch Progress',[TG('Show on Cards',true),N('Card Progress Height',4,'px'),C('Card Progress Color','#ff453a')]],
   ['Skeleton Loading',[TG('Use Skeletons',true),C('Skeleton Base','#26262a'),C('Skeleton Highlight','#323236'),N('Shimmer Duration',1200,'ms')]],
 ]},
 {after:'progress',id:'recommendations',icon:'✨',ic:'#af52de',label:'Recommendations & Rows',desc:'Content recommendation rows',sections:[
   ['Row Types',[TG('Continue Watching',true),TG('Trending Now',true),TG('Because You Watched',true),TG('New Releases',true)]],
   ['Row Appearance',[N('Row Title Size',28,'px'),C('Row Title Color','#f2f2f5'),SE('Card Style','Landscape',['Landscape','Poster','Square']),SL('Cards Per Row',5,3,8,'')]],
   ['Hero Recommendation',[TG('Show Hero Banner',true),SL('Hero Height',45,25,70,'%'),TG('Auto-rotate',true),N('Rotate Interval',8000,'ms')]],
 ]},
 {after:'alerts',id:'emptystates',icon:'🫙',ic:'#8e8e93',label:'Empty States',desc:'No content and error states',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Empty State',[SE('Illustration','Material Icon',['None','Material Icon','Custom image']),N('Icon Size',64,'px'),N('Title Size',28,'px'),N('Message Size',20,'px'),TG('Show Action Button',true),TX('Action Label','Browse Content')]],
   ['Empty State Colors',[C('Icon Color','#48484e'),C('Title Color','#f2f2f5'),C('Message Color','#a5a5ad'),C('Action Color','#4f8ef7')],'dark'],
   ['Empty State Colors',[C('Icon Color','#c6c6c8'),C('Title Color','#1d1d21'),C('Message Color','#74747c'),C('Action Color','#0a66f0')],'light'],
   ['Error States',[TX('Network Error Title','No connection'),TX('Generic Error Title','Something went wrong'),TG('Show Retry Button',true)]],
 ]},
 {after:'emptystates',id:'onboarding',icon:'👋',ic:'#5e5ce6',label:'Onboarding & Setup',desc:'First-time setup flow for TV',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Onboarding',[SE('Style','Paged',['Paged','Video']),TG('Skip Button',true),TG('Progress Dots',true),N('Title Size',40,'px'),N('Body Size',24,'px')]],
   ['Onboarding Colors',[C('Background Color','#0d0d0f'),C('Title Color','#f2f2f5'),C('Body Color','#c7c7ce'),C('Dot Active','#4f8ef7'),C('Dot Inactive','#48484e')],'dark'],
   ['Onboarding Colors',[C('Background Color','#ffffff'),C('Title Color','#1d1d21'),C('Body Color','#3a3a40'),C('Dot Active','#0a66f0'),C('Dot Inactive','#c6c6c8')],'light'],
   ['Setup Steps',[TG('Sign-in Step',true),TG('Pairing Code Sign-in',true,'sign in from phone via code'),TG('Profile Selection',true),TG('Content Preferences',false)]],
 ]},
 {after:'onboarding',id:'accessibility',icon:'♿',ic:'#34c759',label:'Accessibility',desc:'High contrast, TalkBack and focus management',sections:[
   ['Contrast & Text',[TG('High Contrast Mode',false),SL('Min Contrast Ratio',7,3,21,'',0.5),TG('Large Text Support',true),SL('Max Font Scale',200,100,300,'%',10)]],
   ['Screen Reader',[TG('TalkBack Support',true),TG('Announce Focus Changes',true),TG('Descriptive Labels',true)]],
   ['Focus Management',[TG('Always Visible Focus',true),TG('Prevent Focus Traps',true),N('Initial Focus Delay',100,'ms')]],
   ['Motion',[TG('Reduce Motion Support',true),TG('Disable Auto-play Option',true)]],
 ]},
 {after:'accessibility',id:'motion',icon:'💫',ic:'#0a84ff',label:'Motion & Focus',desc:'Focus animations and transitions',sections:[
   ['Focus Animation',[N('Focus Scale Duration',150,'ms'),SE('Focus Easing','Decelerate',['Linear','Decelerate','Spring']),TG('Focus Glow',true),SL('Glow Intensity',50,0,100,'%')]],
   ['Transitions',[N('Screen Transition',300,'ms'),SE('Transition Style','Fade',['None','Fade','Slide','Zoom']),TG('Shared Element Transitions',true)]],
   ['Row Scrolling',[N('Row Scroll Duration',250,'ms'),SE('Scroll Easing','Decelerate',['Linear','Decelerate']),TG('Smooth Scrolling',true)]],
 ]},
 {after:'motion',id:'gestures',icon:'🎮',ic:'#ff9500',label:'Gestures & D-pad',desc:'Directional navigation and click feedback',sections:[
   ['D-pad Behavior',[N('Key Repeat Delay',500,'ms'),N('Key Repeat Rate',50,'ms'),TG('Long-press Menus',true),TG('Loop Navigation',false)]],
   ['Click Feedback',[TG('Click Sound',true),TG('Click Animation',true),SL('Press Scale',95,80,100,'%')]],
   ['Back Button',[SE('Back Behavior','Step back',['Step back','Go home','Confirm exit']),TG('Double-press to Exit',true)]],
 ]},
 {after:'gestures',id:'assets',icon:'🎯',ic:'#ff2d55',label:'Branding & Assets',desc:'App icon, TV banner and store screenshots',sections:[
   ['App Identity',[TX('App Name','KDL TV'),{l:'App Icon',t:'file',v:''},{l:'TV Banner (320×180)',t:'file',v:''},{l:'Logo',t:'file',v:''}]],
   ['Launch Screen',[C('Background Color','#0d0d0f'),TG('Show Logo',true),SE('Logo Size','Medium',['Small','Medium','Large'])]],
   ['Store Listing',[{l:'Feature Graphic',t:'file',v:''},{l:'TV Screenshots (1920×1080)',t:'file',v:''}]],
 ]},
 {after:'assets',id:'customcomponents',icon:'🧱',ic:'#64d2ff',label:'Custom Components',desc:'Reusable TV components',sections:[
   ['Component Defaults',[SE('Base Style','Follow theme',['Follow theme','Independent']),SL('Corner Radius',10,0,24,'px'),N('Padding',24,'px'),C('Focus Ring Color','#4f8ef7')]],
   ['Registered Components',[TA('Component List','tv-channel-card\ntv-live-badge\ntv-epg-row','one component name per line')]],
 ]},
 {after:'customcomponents',id:'tokens',icon:'🧩',ic:'#8e8e93',label:'Design Tokens',desc:'All TV-specific tokens — spacing, radius, focus & motion',sections:[
   ['Spacing Scale',[N('XS',8,'px'),N('SM',16,'px'),N('MD',24,'px'),N('LG',32,'px'),N('XL',48,'px'),N('XXL',64,'px')]],
   ['Border Radius Scale',[N('None',0,'px'),N('Small',6,'px'),N('Medium',10,'px'),N('Large',16,'px'),N('XL',24,'px'),N('Pill',999,'px')]],
   ['Shadows',[SE('Buttons','Small',['None','Small','Medium','Large','XL']),SE('Cards','Medium',['None','Small','Medium','Large','XL']),SE('Floating Views','Large',['None','Small','Medium','Large','XL']),SE('Modal Sheets','XL',['None','Small','Medium','Large','XL'])]],
   ['Focus Tokens',[C('Focus Ring','#4f8ef7'),N('Focus Ring Width',4,'px'),SL('Focus Scale',110,100,130,'%'),N('Focus Duration',150,'ms')]],
   ['Motion Tokens',[N('Fast',150,'ms'),N('Standard',250,'ms'),N('Slow',400,'ms')]],
 ]},
 {after:'tokens',id:'leanback',icon:'📚',ic:'#30d158',label:'Leanback Guidelines',desc:'Android TV Leanback library rules',sections:[
   ['Leanback Compliance',[TG('BrowseSupportFragment Pattern',true),TG('Headers Fragment (Rail)',true),TG('Rows Fragment',true),TG('Guided Step for Settings',true)]],
   ['Card Presenter',[SE('Card Type','ImageCardView',['ImageCardView','Custom Presenter']),TG('Dim Unselected Cards',true),SL('Unselected Dim',30,0,60,'%')]],
   ['Reference',[TA('Notes','Follow Android TV Leanback guidance: browse rows, guided steps, playback glue.','free-form team notes')]],
 ]},
 {after:'leanback',id:'guidelines',icon:'📋',ic:'#e8554d',label:'TV Guidelines & Best Practices',desc:'10-foot UI rules and remote navigation',sections:[
   ['10-foot UI',[N('Min Body Text',24,'px','readable at 3 m'),N('Min Focus Target',48,'px'),SL('Max Content Width',90,60,100,'%'),TG('Avoid Pure White (#FFFFFF)',true),TG('Avoid Pure Black Text on White',true)]],
   ['Remote Navigation',[TG('Every Element D-pad Reachable',true),TG('No Hover-only Actions',true),TG('Visible Focus Always',true),N('Max Clicks to Content',3,'')]],
   ['Performance',[TG('Limit Simultaneous Animations',true),N('Target FPS',60,''),TG('Preload Next Row',true)]],
 ]},
 {after:'guidelines',id:'androidtv',icon:'🤖',ic:'#3ddc84',label:'Android TV / Google TV',desc:'Material Design for TV — Google TV style guide',sections:[
   ['Platform',[TG('Enable Android TV Build',true),SE('Min OS Version','Android 10',['Android 8 (Oreo)','Android 9','Android 10','Android 12','Android 14']),SE('Launcher Target','Google TV',['Android TV','Google TV'])]],
   ['Style Guide',[SE('Design Language','Material for TV',['Material for TV','Custom']),SE('Font','Roboto',FONTS),N('Base Grid Unit',8,'px'),SL('Card Corner Radius',12,0,28,'px'),C('Brand Accent','#3ddc84')]],
   ['Focus Style',[SE('Focus Treatment','Scale + Border',['Scale','Border','Scale + Border','Glow']),SL('Focus Scale',110,100,130,'%'),C('Focus Border Color','#ffffff'),N('Focus Animation',150,'ms')]],
   ['Home Screen Integration',[TG('Watch Next Channel',true),TG('Custom Channels',true),SE('Channel Card Ratio','16:9',['16:9','4:3','2:3','1:1']),TG('Play Next on Launcher',true)]],
   ['Remote & Input',[TG('D-pad Only Operation',true),TG('Google Assistant Voice',true),TG('HDMI-CEC Wake',true)]],
 ]},
 {after:'androidtv',id:'tvos',icon:'🍎',ic:'#0a84ff',label:'Apple tvOS',desc:'Apple TV — Human Interface Guidelines',sections:[
   ['Platform',[TG('Enable tvOS Build',false),SE('Min tvOS Version','tvOS 16',['tvOS 15','tvOS 16','tvOS 17','tvOS 18'])]],
   ['Style Guide',[SE('Font','SF Pro',FONTS),SE('Focus Model','Parallax',['Parallax','Lift','Custom']),SL('Parallax Tilt',8,0,20,''),TG('Focus Lift & Shadow',true),SL('Focused Card Scale',115,100,130,'%')]],
   ['Layered Images',[TG('Use Layered Images (.lsr)',true),SE('Poster Ratio','2:3',['16:9','2:3','1:1']),TG('Dim Unfocused Content',true)]],
   ['Top Shelf',[TG('Top Shelf Extension',true),SE('Top Shelf Style','Carousel',['Sectioned Content','Carousel']),TG('Auto-play Preview',false)]],
   ['Siri Remote',[TG('Touchpad Swipe Navigation',true),TG('Play/Pause Actions',true),TG('Siri Voice Search',true),TG('Click-pad Edge Clicks',true)]],
 ]},
 {after:'tvos',id:'firetv',icon:'🔥',ic:'#ff9500',label:'Amazon Fire TV',desc:'Fire TV design and UX guidelines',sections:[
   ['Platform',[TG('Enable Fire TV Build',false),SE('Min Fire OS','Fire OS 7',['Fire OS 5','Fire OS 6','Fire OS 7','Fire OS 8'])]],
   ['Style Guide',[SE('Font','Amazon Ember',['Amazon Ember','Roboto','Custom']),C('Highlight Color','#ff9900'),SL('Card Corner Radius',8,0,24,'px'),SE('Focus Treatment','Scale + Outline',['Scale','Outline','Scale + Outline'])]],
   ['Catalog & Home',[TG('Amazon Catalog Integration',true),TG('Featured Rotator Assets',true),TG('In-app Purchasing (IAP)',false)]],
   ['Alexa Remote',[TG('Alexa Voice Control',true),TG('Voice Deep Links',true),TG('Menu Button Context Actions',true)]],
 ]},
 {after:'firetv',id:'roku',icon:'🟪',ic:'#662d91',label:'Roku OS',desc:'Roku SceneGraph design guidelines',sections:[
   ['Platform',[TG('Enable Roku Channel',false),SE('SDK','SceneGraph',['SceneGraph','Direct Publisher'])]],
   ['Style Guide',[SE('Font','Gotham',['Gotham','Roboto','Custom']),C('Focus Highlight','#662d91'),SE('Grid Style','Standard rows',['Standard rows','Hero grid','Tile grid']),SL('Safe Zone Inset',5,0,10,'%',0.5)]],
   ['Artwork',[SE('Poster Ratio','16:9',['16:9','2:3','4:3']),TG('HD + FHD Artwork Sets',true),TG('Splash Screen Required',true)]],
   ['Remote',[TG('Instant Replay Button',true),TG('Options (*) Menu',true),TG('Back Exits to Home',false)]],
 ]},
 {after:'roku',id:'tizen',icon:'🟦',ic:'#1b9cfc',label:'Samsung Tizen',desc:'Samsung Smart TV (Tizen) UX guidelines',sections:[
   ['Platform',[TG('Enable Tizen Build',false),SE('Min Tizen Version','6.0',['4.0','5.5','6.0','7.0','8.0'])]],
   ['Style Guide',[SE('Font','SamsungOne',['SamsungOne','Roboto','Custom']),C('Focus Color','#1b9cfc'),SE('Focus Treatment','Border + Scale',['Border','Scale','Border + Scale']),SL('Card Corner Radius',8,0,24,'px')]],
   ['Smart Hub',[TG('Smart Hub Preview (Deep Links)',true),TG('Ambient Mode Assets',false),TG('Auto-launch on Boot',false)]],
   ['Remote & Input',[TG('Directional Remote',true),TG('Bixby Voice',true),TG('Number Key Shortcuts',false)]],
 ]},
 {after:'tizen',id:'webos',icon:'🪄',ic:'#a50034',label:'LG webOS',desc:'LG webOS TV — Enact / Sandstone guidelines',sections:[
   ['Platform',[TG('Enable webOS Build',false),SE('Min webOS Version','6.0',['4.x','5.x','6.0','22','23','24'])]],
   ['Style Guide',[SE('Design System','Enact Sandstone',['Enact Sandstone','Enact Moonstone','Custom']),SE('Font','LG Smart UI',['LG Smart UI','Roboto','Custom']),C('Focus Color','#a50034'),SL('Card Corner Radius',8,0,24,'px')]],
   ['Magic Remote',[TG('Pointer Support',true),N('Pointer Idle Timeout',5000,'ms'),TG('Scroll Wheel Support',true),TG('Voice (ThinQ AI)',true)]],
   ['Launcher & Home',[TG('Launcher Banner',true),TG('Content Preview Card',true),TG('Quick Start Deep Links',true)]],
 ]},
],
android:[
 {after:'typography',id:'tokens',icon:'🧩',ic:'#8e8e93',label:'Design Tokens',desc:'Spacing, radius, elevation, motion & accessibility',sections:[
   ['Spacing Scale',[N('XS',4,'px'),N('SM',8,'px'),N('MD',16,'px'),N('LG',24,'px'),N('XL',32,'px'),N('XXL',48,'px'),N('XXXL',64,'px')]],
   ['Border Radius Scale',[N('None',0,'px'),N('Small',4,'px'),N('Medium',8,'px'),N('Large',12,'px'),N('XL',16,'px'),N('XXL',24,'px'),N('Pill',999,'px')]],
   ['Elevation Scale',[N('Level 0',0,'px'),N('Level 1',1,'px'),N('Level 2',3,'px'),N('Level 3',6,'px'),N('Level 4',8,'px'),N('Level 5',12,'px')]],
   ['Motion',[N('Transition Duration',300,'ms'),SE('Easing','Emphasized',['Standard','Emphasized','Decelerated','Accelerated']),TG('Screen Transitions',true),TG('Component Animations',true),TG('Shared Element Transitions',true),SE('Loading Animation','Circular',['Circular','Linear','Skeleton'])]],
   ['Gestures',[TG('Ripple Effect',true),TG('Swipe Actions',true),TG('Long Press Menus',true),TG('Drag & Drop',false),TG('Pull to Refresh',true)]],
   ['Accessibility',[N('Min Touch Target',48,'px','48dp minimum'),SL('Min Contrast Ratio',4.5,3,7,'',0.1),TG('Font Scaling Support',true),TG('Screen Reader Labels',true)]],
 ]},
 {after:'navigation',id:'bottomnav',icon:'⬇️',ic:'#34c759',label:'Bottom Navigation',desc:'Bottom navigation bar — Material 3',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Bottom Navigation Bar',[N('Height',80,'px'),N('Icon Size',24,'px'),N('Label Font Size',12,'px'),N('Elevation',8,'px'),SE('Label Visibility','Always',['Always','Selected only','Never']),TG('Show Active Indicator',true),SL('Indicator Radius',16,0,28,'px'),TG('Hide on Scroll',false),TG('Ripple Effect',true)]],
   ['Bottom Bar Colors',[C('Background Color','#1A1A1C'),C('Active Icon Color','#82B1FF','primary'),C('Inactive Icon Color','#9E9E9E','grey'),C('Active Indicator Color','#1E3A5F'),C('Label Color','#C7C7CE')],'dark'],
   ['Bottom Bar Colors',[C('Background Color','#FFFFFF'),C('Active Icon Color','#0066FF','primary'),C('Inactive Icon Color','#9E9E9E','grey'),C('Active Indicator Color','#DCE8FF'),C('Label Color','#616161')],'light'],
   ['Badges',[TG('Show Badges',true),C('Badge Color','#D32F2F'),N('Badge Font Size',10,'px')]],
 ]},
 {after:'buttons',id:'fab',icon:'➕',ic:'#ff2d55',label:'FAB',desc:'Floating action button — Material 3',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Floating Action Button (FAB)',[SE('Size','Normal (56px)',['Mini (40px)','Normal (56px)','Large (96px)']),SE('Shape','Circle',['Circle','Rounded','Square'],'corner radius: circular'),SE('Position','Bottom right',['Bottom right','Bottom center','Bottom left']),N('Icon Size',24,'px'),N('Elevation',6,'px'),TG('Extended (with label)',false),TX('Label','Create')]],
   ['FAB Colors',[C('Background Color','#82B1FF'),C('Icon Color','#0A2540'),C('Ripple Color','#ffffff')],'dark'],
   ['FAB Colors',[C('Background Color','#0066FF','primary'),C('Icon Color','#FFFFFF'),C('Ripple Color','#000000')],'light'],
   ['FAB Behavior',[TG('Hide on Scroll',false),TG('Ripple Effect',true),N('Margin',16,'px')]],
 ]},
 {after:'forms',id:'chips',icon:'🏷️',ic:'#af52de',label:'Chips',desc:'Chips — assist, filter, input, suggestion (Material 3)',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Chips',[N('Height',32,'px'),SL('Corner Radius',16,0,24,'px'),N('Font Size',14,'px'),TX('Padding','0 12px'),TG('Show Checkmark',true)]],
   ['Chip Colors',[C('Selected Background','#1E3A5F'),C('Selected Text','#82B1FF','primary'),C('Unselected Background','#26262A'),C('Unselected Text','#9E9E9E','grey'),C('Border Color','#3A3A3C')],'dark'],
   ['Chip Colors',[C('Selected Background','#0066FF','primary'),C('Selected Text','#FFFFFF'),C('Unselected Background','#FFFFFF'),C('Unselected Text','#616161','grey'),C('Border Color','#E0E0E0')],'light'],
   ['Chip Types',[TG('Assist',true),TG('Filter',true),TG('Input',true),TG('Suggestion',false)]],
 ]},
 {after:'navigation',id:'appbar',icon:'🔝',ic:'#ff9500',label:'App Bar',desc:'Top app bar (toolbar) — Material 3',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['App Bar (Toolbar)',[SE('Component','Top App Bar',['Top App Bar','Center-aligned','Collapsing']),SE('Style','Small',['Small','Medium','Large']),N('Height',64,'px','standard'),SE('Title Font','Roboto',FONTS,'Roboto Medium'),SE('Title Font Weight','500',WEIGHTS,'Medium'),N('Title Font Size',20,'px','20sp'),N('Navigation Icon',24,'px','back / menu'),N('Action Icons',24,'px','search, notification'),N('Shadow',4,'px','optional'),N('Elevation',2,'px','Material 3'),TG('Show Navigation Icon',true),TG('Elevate on Scroll',true)]],
   ['App Bar Colors',[C('Background Color','#1E1E20'),C('Title Color','#E6E6E6','on-primary'),C('Icon Color','#C7C7CE'),C('Action Icon Color','#C7C7CE'),C('Status Bar Color','#121212')],'dark'],
   ['App Bar Colors',[C('Background Color','#0066FF','primary — theme color'),C('Title Color','#FFFFFF','on primary — white'),C('Icon Color','#FFFFFF'),C('Action Icon Color','#FFFFFF'),C('Status Bar Color','#0052CC')],'light'],
   ['Search & Filtering',[SE('Search Style','Search Bar',['Search Bar','Search View (full screen)']),SL('Search Bar Radius',28,0,28,'px'),TG('Filter Chips',true)]],
   ['Behavior',[TG('Back Button',true),TG('Show Search Action',true),TG('Show Notification Action',true),TG('Collapse on Scroll',false)]],
 ]},
 {after:'appbar',id:'tabs',icon:'📑',ic:'#0a84ff',label:'Tabs',desc:'Top tabs — fixed, scrollable, secondary (Material 3)',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Tabs',[SE('Type','Fixed',['Fixed','Scrollable','Secondary']),N('Height',48,'px'),TG('Show Icons',false),SE('Indicator','Underline',['Underline','Rounded pill']),N('Indicator Height',3,'px'),TG('Ripple Effect',true)]],
   ['Tab Colors',[C('Background Color','#1E1E20'),C('Active Color','#82B1FF'),C('Inactive Color','#9E9E9E'),C('Indicator Color','#82B1FF')],'dark'],
   ['Tab Colors',[C('Background Color','#FFFFFF'),C('Active Color','#0066FF'),C('Inactive Color','#616161'),C('Indicator Color','#0066FF')],'light'],
 ]},
 {after:'alerts',id:'emptystates',icon:'🫙',ic:'#8e8e93',label:'Empty States',desc:'Empty state illustration, copy & action (Material 3)',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Empty State',[SE('Illustration','Material Icon',['None','Material Icon','Custom image']),N('Icon Size',48,'px'),N('Title Size',18,'px'),N('Message Size',14,'px'),TG('Show Action Button',true),TX('Action Label','Get Started')]],
   ['Empty State Colors',[C('Icon Color','#48484E'),C('Title Color','#E6E6E6'),C('Message Color','#9E9E9E'),C('Action Color','#82B1FF')],'dark'],
   ['Empty State Colors',[C('Icon Color','#C6C6C8'),C('Title Color','#212121'),C('Message Color','#616161'),C('Action Color','#0066FF')],'light'],
 ]},
 {after:'emptystates',id:'onboarding',icon:'👋',ic:'#5e5ce6',label:'Onboarding',desc:'Onboarding flow, tooltips & feature discovery (Material 3)',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Onboarding',[SE('Style','Paged',['Paged','Stacked cards','Video']),TG('Skip Button',true),TG('Progress Dots',true),N('Title Size',28,'px'),N('Body Size',16,'px')]],
   ['Onboarding Colors',[C('Background Color','#121212'),C('Title Color','#E6E6E6'),C('Body Color','#C7C7CE'),C('Dot Active','#82B1FF'),C('Dot Inactive','#48484E')],'dark'],
   ['Onboarding Colors',[C('Background Color','#FFFFFF'),C('Title Color','#212121'),C('Body Color','#616161'),C('Dot Active','#0066FF'),C('Dot Inactive','#C6C6C8')],'light'],
   ['Tooltips',[TG('Feature Tooltips',true),TG('Feature Discovery',true),SL('Tooltip Radius',10,0,20,'px'),N('Tooltip Font Size',13,'px')]],
 ]},
 {after:'images',id:'assets',icon:'🎯',ic:'#ff2d55',label:'Branding & Assets',desc:'App icon, logo, launcher & splash screen',sections:[
   ['App Identity',[TX('App Name','KDL App'),{l:'App Icon',t:'file',v:''},{l:'Adaptive Icon (Foreground)',t:'file',v:''},{l:'Logo',t:'file',v:''}]],
   ['Splash Screen',[C('Background Color','#121212'),TG('Show Logo',true),SE('Logo Size','Medium',['Small','Medium','Large']),N('Exit Duration',300,'ms')]],
 ]},
],
ios:[
 {after:'navigation',id:'tabbar',icon:'⬇️',ic:'#34c759',label:'Tab Bar',desc:'Bottom tab bar — HIG',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Tab Bar',[N('Height',49,'px'),N('Icon Size',25,'px'),N('Label Font Size',10,'px'),TG('Translucent (Blur)',true),SE('Labels','Below icon',['Below icon','Hidden']),TG('Show Badges',true)]],
   ['Tab Bar Colors',[C('Background Color','#1c1c1e'),C('Active Tint','#0a84ff'),C('Inactive Tint','#8e8e93'),C('Badge Color','#ff453a')],'dark'],
   ['Tab Bar Colors',[C('Background Color','#f9f9f9'),C('Active Tint','#007aff'),C('Inactive Tint','#8e8e93'),C('Badge Color','#ff3b30')],'light'],
 ]},
 {after:'tabbar',id:'sidemenu',icon:'🗂️',ic:'#af52de',label:'Side Menu',desc:'Side menu / drawer — HIG (if used)',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Side Menu',[RA('Position','Left',['Left','Right']),SL('Width',320,240,400,'px'),N('Header Height',180,'px'),N('Row Height',50,'px'),N('Icon Size',24,'px'),TG('Show Dividers',true)]],
   ['Side Menu Colors',[C('Background Color','#1c1c1e'),C('Item Text Color','#ebebf5'),C('Icon Color','#8e8e93'),C('Active Color','#0a84ff'),C('Active Background','#16324f'),C('Divider Color','#38383a')],'dark'],
   ['Side Menu Colors',[C('Background Color','#ffffff'),C('Item Text Color','#3c3c43'),C('Icon Color','#8e8e93'),C('Active Color','#007aff'),C('Active Background','#dce9fd'),C('Divider Color','#c6c6c8')],'light'],
   ['Header',[SE('Header Style','Profile',['None','Logo','Profile']),TG('Show Avatar',true),TG('Show Name',true),TG('Show Email',true)]],
   ['Overlay',[C('Scrim Color','#000000'),SL('Scrim Opacity',40,0,100,'%'),TG('Edge Swipe to Open',true)]],
 ]},
 {after:'typography',id:'tokens',icon:'🧩',ic:'#8e8e93',label:'Design Tokens',desc:'Spacing, radius, shadows, accessibility, haptics & motion (HIG)',sections:[
   ['Spacing Scale',[N('XS',4,'px'),N('SM',8,'px'),N('MD',16,'px'),N('LG',24,'px'),N('XL',32,'px'),N('XXL',48,'px')]],
   ['Border Radius Scale',[N('None',0,'px'),N('Small',6,'px'),N('Medium',10,'px'),N('Large',12,'px'),N('XL',16,'px'),N('XXL',24,'px'),N('Pill',999,'px')]],
   ['Shadows',[SE('Buttons','Small',['None','Small','Medium','Large','XL']),SE('Cards','Medium',['None','Small','Medium','Large','XL']),SE('Floating Views','Large',['None','Small','Medium','Large','XL']),SE('Modal Sheets','XL',['None','Small','Medium','Large','XL'])]],
   ['Accessibility',[N('Min Touch Target',44,'px','44 × 44pt minimum'),TG('Dynamic Type',true),TG('VoiceOver Support',true),TG('High Contrast Support',true),TG('Reduce Motion Support',true)]],
   ['Haptics',[SE('Picker Changes','Selection',['None','Selection']),SE('Small Button','Impact Light',['None','Impact Light','Impact Medium','Impact Heavy']),SE('Card Action','Impact Medium',['None','Impact Light','Impact Medium','Impact Heavy']),SE('Important Action','Impact Heavy',['None','Impact Light','Impact Medium','Impact Heavy']),TG('Notification Haptics',true,'success / warning / error')]],
   ['Animations',[N('Button Press',180,'ms','0.15–0.20 sec'),N('Modal Presentation',300,'ms'),N('Fade',250,'ms'),SE('Navigation Push','System Default',['System Default','Custom']),SE('Loading','System Spinner',['System Spinner','Custom'])]],
 ]},
 {after:'tables',id:'collections',icon:'🧱',ic:'#ff9500',label:'Collection Views',desc:'Grids, carousels & compositional layouts (HIG)',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Grid',[SE('Columns','2',['1','2','3','4']),SL('Item Spacing',12,0,32,'px'),SL('Corner Radius',12,0,24,'px'),SE('Aspect Ratio','4:3',['1:1','4:3','16:9']),TG('Show Titles',true)]],
   ['Carousel',[TG('Paging Enabled',true),SL('Peek (next item)',24,0,60,'px'),TG('Page Indicator',true),N('Auto Scroll',0,'ms','0 = off')]],
   ['Collection Colors',[C('Item Background','#2c2c2e'),C('Title Color','#ffffff'),C('Page Dot Active','#0a84ff'),C('Page Dot Inactive','#48484a')],'dark'],
   ['Collection Colors',[C('Item Background','#ffffff'),C('Title Color','#000000'),C('Page Dot Active','#007aff'),C('Page Dot Inactive','#c6c6c8')],'light'],
 ]},
 {after:'alerts',id:'emptystates',icon:'🫙',ic:'#8e8e93',label:'Empty States',desc:'Empty state illustration, copy & action',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Empty State',[SE('Illustration','SF Symbol',['None','SF Symbol','Custom image']),N('Icon Size',48,'px'),N('Title Size',17,'px'),N('Message Size',14,'px'),TG('Show Action Button',true),TX('Action Label','Get Started')]],
   ['Empty State Colors',[C('Icon Color','#48484a'),C('Title Color','#ffffff'),C('Message Color','#8e8e93')],'dark'],
   ['Empty State Colors',[C('Icon Color','#c6c6c8'),C('Title Color','#000000'),C('Message Color','#8e8e93')],'light'],
 ]},
 {after:'emptystates',id:'onboarding',icon:'👋',ic:'#5e5ce6',label:'Onboarding',desc:'Onboarding screens, page dots & tooltips (HIG)',
  modes:[{id:'dark',label:'🌙 Dark Theme'},{id:'light',label:'☀️ Light Theme'}],sections:[
   ['Onboarding',[SE('Style','Paged',['Paged','Stacked cards','Video']),TG('Skip Button',true),TG('Progress Dots',true),N('Title Size',28,'px'),N('Body Size',16,'px')]],
   ['Onboarding Colors',[C('Background Color','#000000'),C('Title Color','#ffffff'),C('Body Color','#ebebf5'),C('Dot Active','#0a84ff'),C('Dot Inactive','#48484a')],'dark'],
   ['Onboarding Colors',[C('Background Color','#ffffff'),C('Title Color','#000000'),C('Body Color','#3c3c43'),C('Dot Active','#007aff'),C('Dot Inactive','#c6c6c8')],'light'],
   ['Tooltips',[TG('Feature Tooltips',true),SL('Tooltip Radius',10,0,20,'px'),N('Tooltip Font Size',13,'px')]],
 ]},
 {after:'images',id:'assets',icon:'🎯',ic:'#ff2d55',label:'Branding & Assets',desc:'App name, app icon, logo & launch screen',sections:[
   ['App Identity',[TX('App Name','KDL App'),{l:'App Icon',t:'file',v:''},{l:'Logo',t:'file',v:''},{l:'Logo (Dark Mode)',t:'file',v:''}]],
   ['Launch Screen',[C('Background Color','#000000'),TG('Show Logo',true),SE('Logo Size','Medium',['Small','Medium','Large'])]],
 ]},
],
};

// Build one settings tree per platform from the authored BASE_TABS + overrides.
const BASE_DEVICE_TAGS=['desktop','laptop','ipad','mobile'];
// Platforms flagged allDevices (TV) show the resolution sub-tabs on EVERY pane:
// untagged sections are duplicated per resolution with px values scaled, so
// 720p → 8K can hold different values. Theme-tagged (dark/light) and hidden
// (preview-edited) sections stay shared across resolutions.
const perDeviceAll=(p,nt)=>{
  if(!p.allDevices||nt.devices) return nt;
  nt.devices=p.devices.map(d=>({id:d.id,label:d.label}));
  const out=[];
  nt.sections.forEach(([sec,fields,tag,hide])=>{
    if(hide||tag){ out.push([sec,fields,tag,hide]); return; }
    p.devices.forEach(d=>out.push([sec,clone(fields).map(f=>scaleField(f,d.scale)),d.id,hide]));
  });
  nt.sections=out;
  return nt;
};
const PLAT_TABS={};
PLATFORMS.forEach(p=>{
  PLAT_TABS[p.id]=BASE_TABS.map(t=>{
    const ov=(PANE_OVERRIDES[p.id]||{})[t.id]||{};
    const nt={...t,sections:[]};
    if(ov.label) nt.label=ov.label;
    if(ov.desc) nt.desc=ov.desc;
    if('modes' in ov) nt.modes=ov.modes;
    if(t.devices) nt.devices=p.devices.map(d=>({id:d.id,label:d.label}));
    // Patches match by section name, or "name|tag" for one theme/device only.
    const applyPatch=(sec,tag,fs)=>{ const pv=ov.patch&&(ov.patch[sec+(tag?'|'+tag:'')]||ov.patch[sec]);
      if(pv) fs.forEach(f=>{ if(pv[f.l]!=null) f.v=pv[f.l]; }); return fs; };
    (ov.sections||t.sections).concat(ov.append||[]).forEach(([sec,fields,tag,hide])=>{
      if(!t.devices||!BASE_DEVICE_TAGS.includes(tag)){ nt.sections.push([sec,applyPatch(sec,tag,clone(fields)),tag,hide]); return; }
      p.devices.filter(d=>d.from===tag).forEach(d=>{
        nt.sections.push([sec,applyPatch(sec,tag,clone(fields).map(f=>scaleField(f,d.scale))),d.id,hide]);
      });
    });
    return perDeviceAll(p,nt);
  });
  // Splice in the platform's extra panes right after their anchor pane.
  (EXTRA_TABS[p.id]||[]).forEach(x=>{
    const nt=perDeviceAll(p,{...x,sections:x.sections.map(([sec,fields,tag,hide])=>[sec,clone(fields),tag,hide])});
    delete nt.after;
    const idx=PLAT_TABS[p.id].findIndex(t=>t.id===x.after);
    PLAT_TABS[p.id].splice(idx<0?PLAT_TABS[p.id].length:idx+1,0,nt);
  });
});

export {
  C, N, SL, SE, TG, TX, PW, RA, MS, FI, TA,
  FONTS, WEIGHTS, TYPO_SIZE_UNITS,
  BASE_TABS, PLATFORMS, PANE_OVERRIDES, EXTRA_TABS,
  BASE_DEVICE_TAGS,
  slug, clone, scalePx, scaleField, perDeviceAll,
  PLAT_TABS,
};
