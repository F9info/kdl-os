# F9tech design notes (source: f9tech_react/src scss/js)

## Global
- Colors: primary #2B74E2 (light #8fb6f0, dark #124187); secondary/navy #002E69 (MUI secondary red #DE3730, used for active business-model title); grey bg #EFF0FA (.bg-grey); text #212121; white #fff. .bg-primary/.bg-secondary force all text white.
- Fonts: body Nunito Sans 400 (300-700); headings Plus Jakarta Sans 700; Roboto Flex for stats/solutions text/buttons; MUI Roboto fallback. MUI default type scale (h1 6rem etc) unless noted.
- Layout: .container max-width 1440px (<=1550px), 1300px (<=1400px), padding 0 (15px <=991px), centered. Section vertical padding py:13 = 104px (MUI spacing 8). Breakpoints: 991px (mobile/tablet stack, centered text), 1400, 1550; MUI sm=600 for xs=12 grids.
- Links: no underline. Mobile .order1/.order2 force image first, text second.
- Page title (.page-title) = MUI h1 centered, page body py 104px.

## Header
- Transparent static AppBar, no shadow, hides on scroll-down (slide). header padding-top 30px (<=1550), 15px (<=991).
- Container xl, row space-between: logo (md 3 cols, max-width 250px, 200px <=991; image src/logo.svg) | nav (md 9, right aligned).
- Nav items (inline, margin-right 40px, 20px <=1400): Home / , Services /services, Solutions /solutions, About us /about, Blog https://medium.com/@f9tech (new tab), then contained primary button "Contact us" /contact (white text, padding 10px 25px, no text-transform). Links h6 weight 400 #212121, padding 5px 15px.
- Below md: nav hidden, hamburger IconButton opens temporary Drawer 240px containing same nav.

## Footer (bg #002E69 white text)
- footer-top: container, grid spacing 5, space-between, align end; margin-bottom -18px, top 18px (overlaps middle). Left (3 cols, hidden <=991) logo with white circle 150x150 behind (border-radius 70%) img width 100%; centre social list: 5 white circles 70x70 (padding 10, radius 70%), icon 30px, margin 0 10px; order LinkedIn, Facebook, Instagram, GitHub, YouTube (images/social/*.svg); right empty 2 cols. <=991: socials centered, circles 50px, icon 20px.
- footer-middle: py 104px, overflow hidden, decorative images/footer-link.svg 300x300 at left -150/-150 bottom and right -150 vertical center. 4 columns (xs3, 12 on mobile, centered on mobile): SERVICES (MOBILE APP DEVELOPMENT, WEB APP DEVELOPMENT, DIGITAL MARKETING, GRAPHIC DESIGNING, UI/UX DESIGN -> /services; BUSINESS SOLUTIONS /solutions); SOLUTIONS (F9 CRM, ASSOCIATION MANAGEMENT -> /solutions); QUICK LINKS (OPEN SOURCE https://github.com/F9info, FLUTTER CMS, PR CMS -> /solutions); contact column: phone +91 891 969 3567 (tel:+918919693567, 32px/700), email projects@f9tech.com (22px/500), address 16px mt 15px: "Vinayagar Heights, Sampath Vinayaka TempleRoad / Waltair Uplands, Opp. Kalyan Jewellers / Visakhapatnam – 530003, / Andhra Pradesh (INDIA)". Column titles 16px weight 800 mb 15px, uppercase text; list items 14px mb 7px, white.
- footer-bottom (mt 30px, 50px mobile): left logos (4 cols): KDL kalamdreamlabs.com, BNI bni-visakhapatnam.in/en-IN/index, CII partnershipsummit.com, VS vizagstartups.in (images/footer/kdl|bni|cii|vs.svg, max-height 50px, margin 0 7px); centre: "©2024 F9 Info Technologies Private Limited. All Rights Reserved" 12px centered, then inline links separated by 1px white vertical dividers: TERMS & CONDITIONS /terms, PRIVACY POLICY /privacy, SITEMAP /sitemap, BLOGS https://medium.com/@f9tech; right (3 cols): images/footer/drmca.svg (dmca.com), pro.svg (copyscape.com). All external links target _blank.

## F9Hero
- py 104px (0 <=991). Slick slider (dots, infinite, speed 500, one slide). 2 cols xs6 centered vertically: left text, right Lottie animation (components/hero/all.json, 1337x1000, 400px tall container, loops). Static fallback in JSON: images/laptop-phone.svg.
- lead is h1 53px/60px Nunito Sans 400; highlight is image idea.svg (width 550px, 400px <=1550, 300px <=991; JSON prop imageIdea) rendered under lead; text 24px/34px 400. <=991: pic first (bg #f9f9f9, centered), text centered, h1 40/50.

## F9Welcome
- Section padding-top 80px; pseudo bg #EFF0FA covering bottom 56% (80% mobile). Cols 4/8. Left figure: white circle 350x350 (radius 70%, padding 40px, top -50px), image 14-logo.svg (no counter text exists in source; counterValue/counterLabel empty). Title h3 Plus Jakarta 700 45px (40 <=1550, 28 mobile); text 24/32 (20/28, 18/24 mobile).

## Section title (all home sections)
- Row: h2 bold left + subtitle (text-primary blue #2B74E2, p) right, 1px black line through middle (z-index trick: both have white bg, grey bg in .bg-grey), margin 30px 0. Mobile: line hidden, both centered full width, h2 32px.

## F9ServiceCards (home, bg-grey)
- Grid 4 per row (xs3 of 12, spacing 3), 1 col <=600. Card radius 40px, shadow 0 0 7.5px rgba(0,0,0,.15), button padding 50px 30px; figure 170x170 circle bg images/service-circle.svg with icon 100px centered; title h4 min-height 90px, truncated to 24 chars; body grey text truncated 120 chars + "..." (source truncates; JSON has full text, bullets are not shown on home).

## F9Expertise
- White bg, centered flex grid spacing 5; each block min-width 180px (150 <=1400), centered: icon height 100px (80 / 50 mobile) grayscale(100%), label h5 p 400 #2E2727 pt 10px; links https://f9tech.com/ (_blank).

## F9Process (bg-grey)
- Left 5 cols figure development.svg; right 7 cols: 4 cards per row (xs3, spacing 3). Card radius 40px, padding 15px 25px, shadow 0 0 6.75px rgba(0,0,0,.15); icon tile 70x70 bg #EDF0FF radius 16px, icon 50px; title h5 (24 chars max), body 14px (truncated 62 chars). 1300-1400px: 30/70 split, min-height 300px.

## F9BusinessModel
- 2 cols (6/6, right hidden <=991). Left list: items with 3px #D3D3D3 left rule, padding-left 40px, mb 30px; title h4 #A59999, body #A6A6A6; active: 4px rule #2B74E2 animating height 0->100% (3.5s infinite), title #DE3730, body #000. Right: active item image only. Auto-rotates ~every 3s, click selects, pause on hover.

## F9LetsDiscuss
- pb 100px. Card max-width 850px centered, radius 42px, padding 40px 50px, shadow 0 0 6.75px rgba(0,0,0,.15), flex space-between. Heading 32/40 700 #2B74E2; subtitle grey; contained button 20px/26 Roboto Flex 500, padding 15px 40px, radius 30px. Stacked/centered <=991.

## F9Portfolio
- Full-width, overflow hidden, left 63% blue #2c74e2 panel. h2 "Portfolio" white 57px Plus Jakarta 700 pl 100px. Left (5 cols) slick text slider autoplay 10s: h3 45px/700 white, p 24/36 white, padding-left/top 100px; prev/next arrows under text (arrow_left_alt.svg/arrow_right_alt.svg 45x35 at 45%/55%). Right (7 cols, shifted right -15%): 860px tall frame bg laptop-phone.svg; web screenshot (img2 960x605 at left 143 top 26) and mobile screenshot (img1 291x625 radius 47px, phone.svg frame overlay 320x650). Scaled at <=1550 (775x409 etc) and <=991 (stacked, image first, max 300px). Items prop 5th field = mobile image (extra beyond spec); href empty.

## F9BlogTeasers
- py 104px; section title (eyebrow=h2, title=subtitle). 3 cards (xs4, spacing 5, pt 104px). Card radius 42px shadow 0 0 6.75px rgba(0,0,0,.15); image figure 280px tall cover, top radius 42px; content padding 40px 30px; title h5 32px/700 Plus Jakarta #4A3232 min-height 140px; body 16/26 min-height 140px mb 50px; "Read More" outlined small button 22px, padding 15px 35px, radius 30px, right aligned (button text not in JSON: "Read More"). No href in source.

## F9PageBanner (about / solutions top)
- pt 104px. About: 7/5 cols, text left h1 45/50 Plus Jakarta 700 #000 with second line (after " / ") block blue #2B74E2; p 24/32; image right (margin-left 100px). Solutions: 6/5 cols, h2 h3-variant, first part blue 45/50 700 (" / " split: first segment is the blue span, rest black), p 24/30 Roboto Flex; image solutions.png. Mobile: image first, centered.

## F9About
- Section bg images/about-bg.svg cover, padding 500px 0 100px (350 <=1550; solid #2B74E2 <=991). White cards radius 47px shadow 0 0 7.5px rgba(0,0,0,.15) padding 30 mb 50. Card1: text 7 cols (h5) + v-1.svg right; card2: v-2.svg left + text; card3: values list col 4 | v-3.svg centre (320px, 280 mobile) | list col 4, items 24/28 #000 with blue CheckBox icon (pl 50). Values lines 1-4 left column, 5-8 right. image2/image3 are extra props.

## F9Stats
- py 104px, 5 flex blocks space-between centered, left border 1px #ccc pl 50px (first none); label 24/28 Roboto Flex 400, value h6 45/50 700 #2B74E2. Mobile stacked, bottom border.

## F9Solutions
- bg #2B74E2 white text, py 104px. h1 "Solutions" centered mb 50. Rows mb 50, 6/6 cols; default row: image left, text right; even rows (reverse=true) text left. Content padding 0 50px; h3(h2 tag), p 24/34 Roboto Flex. Images offers/1-4.png.

## F9ServicesList
- py 104px, 2 per row (xs6, spacing 5). Card radius 20px, padding 50px, color white, bg #2B74E2, even cards #002E69; title h3 (truncated 24 chars in source); bullets with 10px white dots (pl 20, mb 5); icon 151-200px absolute bottom-right 15px (static on mobile).

## F9Contact
- py 104px, centered h1; 2 cols (Name, Email) md6, Subject and Description (multiline 4 rows) full width; MUI outlined fields, padding 0 30px; contained button centered 22/24 Plus Jakarta, padding 15px 35px, radius 30px; source label is "Contained" (placeholder).

## F9Legal / F9Sitemap
- container lg (1200px), py 104px; h1 centered mb 16; effective date centered, grey (text.secondary) mb 48. Section: h2 (h5) 600 #002E69 mb 12, body 1.8 line-height #444, Divider between sections (mt 32), mb 32. Sitemap: 3-col grid (md4/sm6/xs12, spacing 6); group h6 700 #002E69 uppercase letter-spacing 1px, 40x3 primary bar under, links 0.95rem #444 hover primary, external links _blank.
