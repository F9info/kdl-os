// Content of "KDL OS - Complete Installation & Setup Guide". Plain HTML strings, one entry per chapter.
// Every screenshot in img/ is a real capture from a fresh install (docs/guide/capture notes in README.md).
// Nothing here is an illustrative mockup. Things that are not built yet are listed in chapter 10.
const fig = (name, cap, cls = '') =>
  `<figure class="${cls}"><img src="img/${name}.png" alt="${cap}"><figcaption>${cap}</figcaption></figure>`
const note = (t) => `<div class="note"><b>Note.</b> ${t}</div>`
const tip = (t) => `<div class="tip"><b>Tip.</b> ${t}</div>`
const warn = (t) => `<div class="warn"><b>Important.</b> ${t}</div>`
const steps = (...s) => `<ol class="steps">${s.map((x) => `<li>${x}</li>`).join('')}</ol>`

export const META = {
  title: 'KDL OS – Complete Installation & Setup Guide',
  version: '1.0',
  date: '12 November 2026',
}

export const CHAPTERS = [
  {
    id: 'start',
    title: 'Before you start',
    html: `
<p>KDL OS is a modular platform. You start with a small, safe core (the admin) and switch on only the parts you need, such as a website, landing pages or memberships.</p>
<p>The first time you open KDL OS, a short <b>Setup Wizard</b> asks three things: who you are (company), what you want to create (application type), and then it sets everything up for you. This guide walks you through every screen, then shows what to do after you sign in.</p>
<h3>What you need</h3>
<ul>
<li>KDL OS running on your computer or server, with the database set up. If you are not sure, ask your developer to follow the <b>Installation</b> guide in this Documents list first.</li>
<li>The database <b>seed</b> must have been run once (<code>npm run db:seed</code>). It creates the Super Admin account that you will use to sign in at the end.</li>
<li>Your company <b>logo</b> as a PNG, JPEG or WebP image, 2 MB or smaller.</li>
<li>Your <b>company name</b>. Phone number and email are optional.</li>
</ul>
<h3>Opening KDL OS for the first time</h3>
${steps(
  'Open your browser and go to the KDL OS address, for example <code>http://localhost:3001</code>.',
  'Go to the sign-in page (<code>/login</code>). On a new installation you will not see a sign-in form. KDL OS takes you to the Setup Wizard at <code>/install</code> instead.',
  'Follow the three screens in the next chapters.'
)}
<h3>Why does the wizard appear before login?</h3>
<p>A new KDL OS has no company details and no website yet. The wizard collects them once, so every part of the system (login page, admin menu, website, emails) shows the right name and logo from the very first minute.</p>
<p>Signing in is <b>locked until the wizard is finished</b>. This is checked on the server, not only in your browser, so nobody can skip it by mistake.</p>
${note('If you refresh the page or close the browser halfway, nothing is lost. KDL OS remembers the steps you already saved and opens the wizard where you stopped.')}
${note('If KDL OS was already in use before the wizard existed (somebody has signed in before), it is treated as installed and opens the sign-in page directly. You will not see the wizard.')}
`,
  },
  {
    id: 'screen1',
    title: 'Screen 1 – Basic company details',
    html: `
<p>This is <b>Step 1 of 3</b>. It tells KDL OS who you are. The details are saved once, in the central <b>Application Identity</b> settings, and every module reads them from there.</p>
${fig('i1-empty', 'Step 1 when the wizard opens. The two required items are the company logo and the company name.')}
<h3>What to enter</h3>
<table>
<tr><th>Field</th><th>Required?</th><th>Example</th></tr>
<tr><td>Company logo</td><td><b>Yes</b></td><td>The ABC Technologies logo (PNG, JPEG or WebP, up to 2 MB)</td></tr>
<tr><td>Company name</td><td><b>Yes</b></td><td>ABC Technologies</td></tr>
<tr><td>Phone number</td><td>No</td><td>+91 9876543210</td></tr>
<tr><td>Email address</td><td>No</td><td>info@example.com</td></tr>
</table>
${note('Only the <b>logo</b> and the <b>company name</b> are mandatory. You can leave phone number and email empty and still go to the next step.')}
<h3>Step by step</h3>
${steps(
  '<b>Upload the logo.</b> Click the dashed box that says &ldquo;Click to upload your logo&rdquo; and choose your logo file. A preview appears. To change it, click <b>Replace logo</b>.',
  '<b>Type the company name</b> in the Company name box. Example: <code>ABC Technologies</code>.',
  '<b>Optional:</b> type your phone number and email address.',
  'Click <b>Next</b>.'
)}
${fig('i1-filled', 'Step 1 filled in with the example company. This is sample data used only for this guide.')}
<h3>If something is missing</h3>
<p>If you click Next without a logo or a company name, KDL OS shows a message under the field and stays on this step. A wrong email address (for example <code>info@</code>) is also pointed out. A logo that is not PNG, JPEG or WebP, or is bigger than 2 MB, is refused.</p>
${fig('i1-errors', 'Messages shown when the logo and company name are missing.')}
${tip('SVG logos are not accepted in the wizard, because an SVG file can carry hidden scripts. Export your logo as PNG instead. A transparent PNG works best.')}
`,
  },
  {
    id: 'screen2',
    title: 'Screen 2 – Choose your application type',
    html: `
<p>This is <b>Step 2 of 3</b>. Choose what you want to create with KDL OS. KDL OS then works out which optional modules are needed and shows them to you <b>before</b> you continue.</p>
${fig('i2-types', 'Step 2: six cards. Click one to select it. The modules that will be set up are listed below the cards.')}
${note('This choice is only your <b>starting point</b>. It does not lock your project. After sign-in you can change it (see chapter 9) without reinstalling.')}
<h3>The six options at a glance</h3>
<table>
<tr><th>Option</th><th>Choose it when</th><th>Optional modules KDL OS adds</th></tr>
<tr><td><b>Landing Page</b></td><td>You want one or a few pages to promote a product, service or campaign.</td><td>Frontend (with FAQ, Gallery, Testimonials, Team, Catalog, Work, Sectors, Projects Content, Website, Landing Pages, Forms)</td></tr>
<tr><td><b>Static Website</b></td><td>You want a normal multi-page website that you design once and can host anywhere.</td><td>The same Frontend set</td></tr>
<tr><td><b>Web Application</b></td><td>You are building a business application that collects data, not a public website.</td><td>Forms</td></tr>
<tr><td><b>Admin + Frontend Web Application</b></td><td>You want a public website and the admin that runs it, together.</td><td>The Frontend set and Forms</td></tr>
<tr><td><b>Multiple Websites / Landing Pages</b></td><td>You manage several sites or many campaign pages from one admin.</td><td>The Frontend set, plus Page Editor UI and Themes</td></tr>
<tr><td><b>Admin Only</b></td><td>You only need the admin: users, roles, settings and media.</td><td>None</td></tr>
</table>
<p>The seven <b>core modules</b> (Dashboard, Users, Modules, Admin Settings, Media, Access Control, Settings) are always on, whatever you choose. KDL OS never installs unrelated optional modules.</p>
<h3>Example: Landing Page</h3>
${fig('i2-landing', 'Landing Page selected. The panel lists what will be set up.')}
<p>When you choose Landing Page and launch, KDL OS does all of this by itself. You do not create anything by hand:</p>
<ul>
<li>The <b>Frontend</b> module is installed and switched on, together with the modules it needs.</li>
<li>A <b>demo website</b> is created, with Home, About, Services, Contact, FAQ and more.</li>
<li><b>Four landing pages</b> are created: Business / Corporate, SaaS / Technology, Agency / Portfolio and Startup / Product launch.</li>
<li>Every landing-page section comes in <b>four different designs</b>, ready to choose from.</li>
<li>The <b>Page Builder</b> and the <b>Section Builder</b> are ready to use.</li>
<li>Website menus, public page addresses (for example <code>/p/startup</code>) and default settings are registered.</li>
</ul>
<h3>Example: Admin Only</h3>
${fig('i2-admin-only', 'Admin Only selected: no extra modules. The Frontend is not installed.')}
<p>Nothing extra is installed. You get the clean admin. If you need a website later, change the application type (chapter 9) or install the Frontend module yourself (chapter 6).</p>
<h3>The other options</h3>
${fig('i2-static', 'Static Website: the same Frontend set as Landing Page.', 'half')}
${fig('i2-web-app', 'Web Application: only Forms is added.', 'half')}
${fig('i2-admin-frontend', 'Admin + Frontend: the Frontend set and Forms.', 'half')}
${fig('i2-multi', 'Multiple Websites / Landing Pages: Frontend set, Page Editor UI and Themes.', 'half')}
<p>After you select a type, click <b>Next</b>. Use <b>Back</b> if you want to change your company details.</p>
`,
  },
  {
    id: 'screen3',
    title: 'Screen 3 – Launch KDL OS',
    html: `
<p>This is <b>Step 3 of 3</b>. It shows a summary of everything you chose. Nothing is installed until you click <b>Launch KDL OS</b>.</p>
${fig('i3-summary', 'The installation summary for the example company with Landing Page selected.')}
<h3>What the summary shows</h3>
<ul>
<li><b>Company:</b> your logo, name, phone number and email (phone and email appear only if you entered them).</li>
<li><b>Application type:</b> the type you selected, for example Landing Page.</li>
<li><b>Always included:</b> the seven core modules.</li>
<li><b>Added for you:</b> the optional modules this type needs.</li>
<li><b>Your website:</b> shown for website types. It lists the demo website, the four landing pages and the builders.</li>
</ul>
<h3>Launch</h3>
${steps(
  'Check the summary. Use <b>Back</b> if anything is wrong.',
  'Click <b>Launch KDL OS</b>. The button changes to &ldquo;Setting things up…&rdquo;. This can take about a minute. <b>Keep the page open.</b>',
  'When everything is ready, KDL OS opens the <b>sign-in page</b> automatically.'
)}
${fig('i3-launching', 'While launching: KDL OS installs the modules and creates the demo website.')}
<h3>What happens behind the scenes</h3>
<ol>
<li>Your company details and application type are checked again on the server.</li>
<li>Each required module is installed and enabled with the normal module process, including its database tables and starting data.</li>
<li>Only after <b>every</b> step has worked, KDL OS marks the installation as <b>completed</b>.</li>
</ol>
${warn('If any step fails, KDL OS shows a clear message and the installation stays <b>open</b>. Nothing is marked complete. Fix the problem and click Launch again. Modules that were already installed are not installed twice, so nothing is duplicated.')}
<h3>Signing in</h3>
${fig('login', 'The sign-in page after installation. It now shows your own logo.')}
<p>Sign in with the <b>Super Admin</b> account created by the database seed. The default email is <code>admin@kdl.com</code> and the password is the one your developer set when running the seed. KDL OS may ask you to change the password on first sign-in. Do that and choose a strong password.</p>
<p>KDL OS does not sign you in automatically after launching. You always sign in yourself.</p>
${note('The wizard cannot be opened again after installation. It is closed on the server. To change your logo, company name, phone, email or application type later, use the settings pages in chapter 9.')}
`,
  },
  {
    id: 'dashboard',
    title: 'Your Admin Dashboard',
    html: `
<p>After sign-in you arrive at the <b>Dashboard</b>. The logo and name in the top-left corner are the ones you entered in Step 1.</p>
${fig('dashboard', 'The Admin Dashboard of the example installation (Landing Page type).')}
<h3>The seven core menu items</h3>
<p>These seven are always present. They cannot be switched off.</p>
<table>
<tr><th>Menu item</th><th>What it is for</th></tr>
<tr><td><b>Dashboard</b></td><td>A summary: users, settings, media files, your projects and shortcuts.</td></tr>
<tr><td><b>Users</b></td><td>Add, edit, suspend and remove people who can sign in to the admin.</td></tr>
<tr><td><b>Modules</b></td><td>Install, enable, disable and re-enable optional modules (chapter 6).</td></tr>
<tr><td><b>Admin Settings</b></td><td>Your Identity (name, logo, contact details) and SEO settings.</td></tr>
<tr><td><b>Media</b></td><td>The library for images and files, plus AI providers and cloud imports.</td></tr>
<tr><td><b>Access Control</b></td><td>Roles, permissions and the Activity Log (who changed what, and when).</td></tr>
<tr><td><b>Settings</b></td><td>Field Types, Field Categories, Custom Fields and Storage.</td></tr>
</table>
${note('You will also see <b>Documents</b> and <b>Projects</b> in the menu, and a <b>Frontend</b> group when the Frontend module is on. These are not part of the seven, but they are normal items in the current version. Documents is where this guide lives.')}
<h3>Who can see what</h3>
<p><b>Super Admin</b> has full access to everything. <b>Developer</b> has nearly full access: all seven core modules and the optional modules (the only exceptions are deleting roles and deleting permissions). The <b>Admin</b> role runs content and people. The <b>User</b> role has no admin access. You can see and change roles under <b>Access Control &gt; Roles</b>.</p>
${fig('roles', 'Access Control > Roles.', 'half')}
${fig('users', 'Users.', 'half')}
`,
  },
  {
    id: 'modules',
    title: 'Managing modules',
    html: `
<p>Optional features come as <b>modules</b>. You can add or remove them whenever you like, without reinstalling KDL OS.</p>
${fig('modules-membership-available', 'Modules. Each card shows the module name, its state and the action you can take.')}
<h3>The states of a module</h3>
<table>
<tr><th>State</th><th>Meaning</th><th>Button</th></tr>
<tr><td><b>Available</b></td><td>Part of KDL OS, not installed yet.</td><td>Install</td></tr>
<tr><td><b>Installed</b></td><td>Installed with its starting data, but not switched on.</td><td>Enable</td></tr>
<tr><td><b>Enabled</b></td><td>Running. Its menu items and pages are available.</td><td>Disable</td></tr>
<tr><td><b>Disabled</b></td><td>Switched off. Its data is kept.</td><td>Enable</td></tr>
</table>
<p>Core modules show a small lock and cannot be disabled.</p>
<h3>Install and enable a module (example: Membership)</h3>
${steps(
  'Open <b>Modules</b> in the left menu. Use the search box or the filters to find the module.',
  'On the <b>Membership</b> card click <b>Install</b>. A box asks you to confirm. Click <b>Install</b> again.',
  'The card now says <b>Installed</b>. Click <b>Enable</b>.',
  'The card says <b>Enabled</b>. The new <b>Membership</b> group appears in the left menu.'
)}
${fig('modules-membership-installed', 'Membership after installing: the card shows Enable.')}
${fig('modules-membership-enabled', 'Membership enabled. Its menu and screens are now available.')}
<h3>What happens when you install a module</h3>
<ul>
<li>Its database tables are ready and its <b>starting data</b> is added (for example, Membership gets three sample plans and its message templates).</li>
<li>Modules it depends on are installed and enabled for you.</li>
<li>Its <b>permissions</b> are created and given to Super Admin and Developer.</li>
<li>Its <b>admin menu</b> appears, and its website pages and backend functions become available when it is enabled.</li>
</ul>
<h3>Disable and enable again, safely</h3>
<p>Disabling a module hides its menu and pages. <b>Your data is not deleted.</b> When you enable it again, everything comes back and nothing is duplicated. A module cannot be disabled while another enabled module depends on it. KDL OS tells you which one.</p>
${tip('If you are unsure, <b>Disable</b> is always safe. Only use Uninstall if your developer has told you to.')}
`,
  },
  {
    id: 'frontend',
    title: 'The Frontend module',
    html: `
<p>The <b>Frontend</b> module is the website part of KDL OS. If you chose a website type in the wizard, it is already installed and enabled. If not, install it from <b>Modules</b> (chapter 6).</p>
${fig('sidebar-expanded', 'The Frontend group in the left menu: FAQ, Gallery, Testimonials, Team, Catalog, Work, Sectors, Case Studies, Brands, Website Details, Color Palette, Navigation, Layouts and more.', 'half')}
<h3>What you get automatically</h3>
<ul>
<li>A <b>demo website</b> (about 12 pages) with sample content, so you can see a finished site on day one.</li>
<li><b>Four landing pages</b>: Business / Corporate, SaaS / Technology, Agency / Portfolio, Startup / Product launch.</li>
<li><b>Four designs for every landing-page section</b> (hero, services, pricing, team, FAQ and more).</li>
<li>The <b>Page Builder</b> and <b>Section Builder</b>.</li>
</ul>
${fig('landing-pages', 'Landing Pages: the four ready-made pages. Use Edit to change one, or New to create your own.')}
<h3>Edit a landing page</h3>
${steps(
  'Open <b>Frontend &gt; Landing Pages</b> (or <code>/admin/landing-pages</code>).',
  'Click <b>Edit</b> on a page. The Page Builder opens, with the page on the right and tools on the left.',
  'Click any text, button or image on the page. Its settings open in the left panel. Type to <b>change the content</b>.',
  'Use the <b>Style</b> tab to change colours, fonts and spacing. Use the image field to <b>change an image</b>.',
  'Click <b>Preview</b> to see the page like a visitor, then <b>Save</b> to publish your changes.'
)}
${fig('builder', 'The Page Builder. The left panel lists the sections you can add; the page is on the right.')}
<h3>Add a section and choose one of four designs</h3>
${steps(
  'In the left panel, under <b>Add a section</b>, click the section you want (for example <b>Services</b>).',
  'A window opens with the <b>four designs</b> of that section. Click the one you like. It is added to the page.',
  'Use the <b>Reorder</b> tab to move sections up or down.'
)}
${fig('builder-designs', 'Four designs of the Services section. Choose one to add it to your page.')}
<h3>The Section Builder</h3>
<p>Open <b>Frontend &gt; Sections</b> to build your own reusable sections (for example a custom header, footer or call to action) and use them on any page.</p>
${fig('section-builder', 'Section Builder: pick the kind of section you want to build.')}
<h3>Create a new landing page</h3>
${steps(
  'On <b>Landing Pages</b>, click <b>New landing page</b>.',
  'Choose one of the starter templates, or start blank.',
  'Give the page a name. The address (slug) is filled in for you and can be changed.',
  'Click <b>Create and edit</b>, then build the page as shown above.'
)}
<h3>Preview, publish and settings</h3>
<ul>
<li><b>Preview</b> opens the page as visitors see it. Published pages are available at <code>/p/&lt;page-address&gt;</code>.</li>
<li><b>Save</b> publishes your changes.</li>
<li><b>Website Details</b>, <b>Color Palette</b>, <b>Navigation</b> and <b>Layouts</b> (all under Frontend) change the details, colours, menus and page layouts of the whole site. Company name, logo, phone and email come from <b>Admin Settings &gt; Identity</b>, so they are never typed twice.</li>
</ul>
${fig('website-details', 'Website Details.', 'half')}
`,
  },
  {
    id: 'membership',
    title: 'The Membership module',
    html: `
<p>Membership lets you sell or give plans to people, take payments, issue invoices and keep members informed. Install and enable it from <b>Modules</b> as shown in chapter 6.</p>
${fig('sidebar-membership', 'The Membership group in the left menu once the module is enabled.', 'half')}
<h3>What is added automatically</h3>
<ul>
<li>Three sample plans: <b>Free</b>, <b>Silver</b> and <b>Gold</b>, with benefits.</li>
<li>Membership settings, a <b>Member</b> role (website members only, no admin access) and all permissions.</li>
<li><b>132 message templates</b> for in-app notifications, email and WhatsApp, covering the member journey.</li>
<li>Two payment methods: <b>Razorpay</b> (as a draft) and <b>Bank transfer</b> (published).</li>
<li>Member pages on your website (sign up, account, checkout), registered in the website menus.</li>
</ul>
<h3>Admin screens</h3>
<table>
<tr><th>Screen</th><th>What you do there</th></tr>
<tr><td><b>Overview</b></td><td>See active members, revenue, renewals due and approvals at a glance.</td></tr>
<tr><td><b>Plans</b></td><td>Create and edit plans, prices (monthly, yearly) and benefits.</td></tr>
<tr><td><b>Members</b></td><td>Add members, see their plan and status, and manage their subscription.</td></tr>
<tr><td><b>Approvals</b></td><td>Approve or reject new members when approval is required.</td></tr>
<tr><td><b>Payments</b></td><td>See every payment, confirm bank transfers and issue refunds.</td></tr>
<tr><td><b>Coupons</b></td><td>Create discount codes, by percentage or fixed amount, with limits.</td></tr>
<tr><td><b>Payment methods</b></td><td>Choose which providers members can pay with.</td></tr>
<tr><td><b>Communication</b></td><td>Control which messages go out on which channel, and edit the templates.</td></tr>
<tr><td><b>Invoices</b></td><td>GST invoices created for payments.</td></tr>
<tr><td><b>Access rules</b></td><td>Make pages or content members-only.</td></tr>
<tr><td><b>Settings</b> and <b>Social login</b></td><td>Renewal reminders, grace period and other rules, and sign-in with social accounts.</td></tr>
</table>
${fig('m-overview', 'Membership Overview.')}
${fig('m-plans', 'Plans: Free, Silver and Gold, created automatically.')}
<h3>Payment gateways: what is built in and what you must configure</h3>
${fig('m-methods', 'Payment methods. Razorpay is built in but is a Draft in Test mode until you add your own keys and publish it.')}
<table>
<tr><th>Provider</th><th>Status in KDL OS</th></tr>
<tr><td><b>Bank transfer</b></td><td>Works immediately. The member pays by NEFT, IMPS or UPI and sends the reference number. You confirm it.</td></tr>
<tr><td><b>Razorpay</b></td><td>Built in, <b>but no credentials are included</b>. It stays a Draft until you enter <b>your own</b> Razorpay keys (test first) and click <b>Publish</b>.</td></tr>
<tr><td>Stripe, Cashfree, PayU, PayPal, PhonePe, CCAvenue</td><td><b>Not available yet.</b> They can be listed but cannot take payments until their drivers are built.</td></tr>
</table>
${warn('KDL OS never ships with payment credentials. The built-in provider entries are only definitions. Real money can move only after you add your own keys. Keys are stored encrypted and are never shown in full. Re-installing or re-seeding never changes keys you saved.')}
<h3>Notifications, email and WhatsApp</h3>
<p>Under <b>Communication</b>, every member event (welcome, payment received, renewal reminder, expiry, cancellation and more) can be sent in-app, by email and by WhatsApp. In-app notifications work straight away. <b>Email and WhatsApp need a provider</b>: set one up under the <b>Integrations</b> module first. WhatsApp also needs an approved template name from your WhatsApp provider.</p>
${fig('m-comm', 'Communication: events and the channels they use.')}
<h3>Renewals and cancellation</h3>
<p>Under <b>Settings</b> you set the renewal reminders (by default 30, 15, 7, 3 and 1 days before a plan ends) and the grace period after expiry (7 days by default). Members can cancel from their own account page, and members can pay again at checkout to renew or change plan. You can also cancel for a member under <b>Members</b>. A daily check (10:00 IST by default) expires old subscriptions and sends the reminders.</p>
${fig('m-settings', 'Membership Settings.', 'half')}
${fig('m-coupons', 'Coupons.', 'half')}
`,
  },
  {
    id: 'change',
    title: 'Changing your installation settings later',
    html: `
<p>Nothing you chose in the wizard is permanent. Super Admin and Developer can change it at any time, <b>without reinstalling</b> KDL OS and without losing pages, websites or users.</p>
<h3>Company logo, name, phone and email</h3>
${steps(
  'Open <b>Admin Settings &gt; Identity</b>.',
  'Change the <b>Application name</b> and <b>Company name</b>, and the <b>Application logo</b>. Phone and email are under the Contact section.',
  'Click <b>Save</b>. The new details show immediately in the admin menu, the sign-in page, the website and in emails.'
)}
${fig('identity', 'Admin Settings > Identity: the one place to change company details and the logo.')}
<p>The <b>Advanced</b> section on the same page lets you use a different logo for the website. If you leave it empty, the website uses your main logo.</p>
<h3>Application type</h3>
${steps(
  'Open <b>Admin Settings &gt; Identity</b> and click the <b>Application type</b> link at the top (or go to <code>/admin/settings/application</code>).',
  'Click another card, for example <b>Static Website</b>. The modules it needs are listed.',
  'Click <b>Apply change</b>.'
)}
${fig('application', 'Application: change the application type at any time.')}
<h3>What a change does, and does not do</h3>
<table>
<tr><th>It does</th><th>It never does</th></tr>
<tr><td>Installs and enables modules the new type needs, using their own starting data.</td><td>Reset or delete your pages, websites or users.</td></tr>
<tr><td>Records the new type.</td><td>Create a second copy of the demo website or templates.</td></tr>
<tr><td>Keeps all existing content.</td><td>Switch off a module you already use, even if the new type does not need it.</td></tr>
</table>
<p>Example: you started with <b>Landing Page</b> and later choose <b>Admin + Frontend Web Application</b>. KDL OS adds Forms, and keeps your four landing pages and every edit you made.</p>
${note('Changing the application type is a configuration change, not a new installation. To remove a module you no longer need, disable it on the Modules page.')}
<h3>Who can do this</h3>
<p>Super Admin and Developer. Other roles do not see these changes unless you give them the Settings and Modules permissions.</p>
`,
  },
  {
    id: 'ref',
    title: 'Quick reference and what is not built yet',
    html: `
<h3>Quick reference</h3>
<table>
<tr><th>I want to…</th><th>Go to</th></tr>
<tr><td>Change logo, company name, phone, email</td><td>Admin Settings &gt; Identity</td></tr>
<tr><td>Change application type</td><td>Admin Settings &gt; Identity &gt; Application type (<code>/admin/settings/application</code>)</td></tr>
<tr><td>Install or enable a module</td><td>Modules</td></tr>
<tr><td>Edit a landing page</td><td>Frontend &gt; Landing Pages &gt; Edit</td></tr>
<tr><td>Build a reusable section</td><td>Frontend &gt; Sections</td></tr>
<tr><td>Add a person who can sign in</td><td>Users</td></tr>
<tr><td>Change what a role may do</td><td>Access Control &gt; Roles</td></tr>
<tr><td>See who changed what</td><td>Access Control &gt; Activity Log</td></tr>
<tr><td>Manage plans, members and payments</td><td>Membership (after enabling it)</td></tr>
<tr><td>Read other guides</td><td>Documents</td></tr>
</table>
<h3>Not built yet, or limited</h3>
<p>This guide only describes what works today. These items are known gaps:</p>
<ul>
<li><b>SVG logos</b> cannot be uploaded in the Setup Wizard (PNG, JPEG and WebP only).</li>
<li><b>Stripe, Cashfree, PayU, PayPal, PhonePe and CCAvenue</b> payments are not implemented. Only <b>Razorpay</b> and <b>Bank transfer</b> work, and Razorpay needs your own keys.</li>
<li><b>Email and WhatsApp messages</b> are sent only after you configure a provider in the Integrations module.</li>
<li>The <b>Setup Wizard</b> creates no Super Admin account. The account comes from the database seed.</li>
<li>The wizard's <b>Web Application</b> type adds only Forms for now. More application modules can be added to that type later.</li>
</ul>
<h3>About the screenshots</h3>
<p>All screenshots in this guide are real captures of KDL OS taken on a fresh installation. The company name, phone number, email address and logo (ABC Technologies) are sample data created only for this guide. There are no illustrative mockups.</p>
<h3>Need help?</h3>
<p>Ask your KDL OS developer or administrator. Mention the page name and what you clicked, and share a screenshot.</p>
`,
  },
]
