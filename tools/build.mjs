import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8').replace(/^\uFEFF/, ''));
const { site, home, research, news, publications, team, join, contact, projects = [] } = data;
const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = value => /^(https?:\/\/|mailto:|\.\/|assets\/|#)/i.test(value || '') ? value : '';
const relativeAsset = value => {
  if (!value) return '';
  if (!value.startsWith('assets/') || value.includes('..') || value.includes('\\')) throw new Error(`Image paths must be inside assets/: ${value}`);
  if (!fs.existsSync(path.join(root, value))) throw new Error(`Image not found: ${value}`);
  return value.split('/').map(encodeURIComponent).join('/');
};
const links = (items = [], className = 'inline-links') => {
  const valid = items.filter(item => safeUrl(item.url));
  return valid.length ? `<div class="${className}">${valid.map(item => `<a href="${escape(item.url)}"${/^https?:/i.test(item.url) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(item.label)}</a>`).join('')}</div>` : '';
};
const example = site.demo ? '<span class="sample-label">Example</span>' : '';
const email = () => site.demo ? `<span class="email">${escape(site.email)}</span>${example}` : `<a class="email" href="mailto:${escape(site.email)}">${escape(site.email)}</a>`;
const sectionTitle = (title, english, action = '') => `<div class="section-heading"><h2>${title}</h2>${action}</div>`;
const pageHeading = (title, english, intro) => `<header class="page-heading"><p class="eyebrow" lang="en">${english}</p><h1>${title}</h1><p>${escape(intro)}</p></header>`;
const avatar = (person, lead = false) => person.photo ? `<img class="avatar" src="${escape(relativeAsset(person.photo))}" alt="${escape(person.name)}" width="${lead ? 164 : 86}" height="${lead ? 164 : 86}" loading="lazy">` : `<div class="avatar" aria-hidden="true">${escape(person.initials)}</div>`;

if (!site.name || !site.description || !/^\d{4}-\d{2}-\d{2}$/.test(site.updated)) throw new Error('Set the group name, description, and an update date in YYYY-MM-DD format.');
for (const paper of publications) {
  if (!/^[a-z0-9-]+$/.test(paper.id) || !/^\d{4}$/.test(paper.year)) throw new Error('Paper IDs must use lowercase letters, digits, and hyphens; years must have four digits.');
}
if (new Set(publications.map(p => p.id)).size !== publications.length) throw new Error('Paper IDs must be unique.');

function publication(paper, detailed = false) {
  return `<article class="publication" id="${escape(paper.id)}">
    <div class="pub-index"><strong>${escape(paper.year)}</strong><span>${escape(paper.area)}</span></div>
    <div><h3${paper.titleLang ? ` lang="${escape(paper.titleLang)}"` : ''}>${detailed ? escape(paper.title) : `<a href="./publications.html#${escape(paper.id)}">${escape(paper.title)}</a>`}${example}</h3>
    ${paper.englishTitle ? `<p class="pub-english" lang="en">${escape(paper.englishTitle)}</p>` : ''}<p>${escape(paper.authors)}</p><p class="venue">${escape(paper.venue)}</p>
    ${detailed && paper.note ? `<p class="publication-note">${escape(paper.note)}</p>` : ''}${links(paper.links)}${detailed && paper.abstract ? `<details><summary>Research overview</summary><p class="abstract">${escape(paper.abstract)}</p></details>` : ''}</div></article>`;
}

const nav = [ ['index.html', 'Home'], ['publications.html', 'Publications'], ['team.html', 'People'], ['join.html', 'Join Us'], ['contact.html', 'Contact'] ];
const year = site.updated.slice(0, 4);
function layout(filename, title, content) {
  const fullTitle = filename === 'index.html' ? site.name : `${title} | ${site.name}`;
  const favicon = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="4" fill="#174e65"/><text x="24" y="32" fill="white" text-anchor="middle" font-family="Georgia,serif" font-size="25">${escape(site.mark)}</text></svg>`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(site.description)}">
  <meta name="theme-color" content="#174e65">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(fullTitle)}">
  <meta property="og:description" content="${escape(site.description)}">
  <title>${escape(fullTitle)}</title>
  <link rel="icon" type="image/svg+xml" href="${escape(favicon)}">
  <link rel="stylesheet" href="./assets/css/style.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<div class="container">
  <header class="site-header">
    <div class="header-top">
      <a class="brand" href="./index.html" aria-label="${escape(site.name)} home"><span class="brand-mark" aria-hidden="true">${escape(site.mark)}</span><div><div class="brand-name">${escape(site.name)}</div>${site.subtitle ? `<span class="brand-english">${escape(site.subtitle)}</span>` : ''}</div></a>
      <div class="header-aside"><p>${escape(site.institution)}</p>${links(site.links, 'header-links')}</div>
    </div>
    <nav class="navigation" aria-label="Main navigation">${nav.map(([file, label]) => `<a href="./${file}"${file === filename ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    ${site.demo ? '<p class="demo-note"><span>Example site</span>Names, members, and publications are examples. Replace them before publishing.</p>' : ''}
  </header>
  <main id="main" tabindex="-1">${content}</main>
  <footer class="site-footer"><div><p>© ${year} ${escape(site.name)}</p>${safeUrl(site.sourceUrl) ? `<p>Source: <a href="${escape(site.sourceUrl)}" target="_blank" rel="noopener noreferrer">Official faculty profile</a></p>` : ''}</div><div class="footer-right"><p>Source information checked: <time datetime="${escape(site.updated)}">${escape(site.updated)}</time></p><a href="#main">Back to top ↑</a></div></footer>
</div>
</body>
</html>
`;
}

const homeContent = `<section class="intro${site.imagePortrait ? ' intro-portrait' : ''}" aria-labelledby="intro-title">
  <figure class="lab-figure"><img class="lab-photo${site.imagePortrait ? ' portrait-photo' : ''}" src="${escape(relativeAsset(site.image))}" alt="${escape(site.imageAlt)}" width="${Number(site.imageWidth) || 800}" height="${Number(site.imageHeight) || 600}" fetchpriority="high"><figcaption>${escape(site.imageCaption)}${safeUrl(site.imageSource) ? `<br><a href="${escape(site.imageSource)}" target="_blank" rel="noopener noreferrer">Photo: official faculty directory</a>` : ''}</figcaption></figure>
  <div><p class="eyebrow" lang="en">${escape(home.eyebrow)}</p><h1 id="intro-title">${escape(home.heading)}</h1>${home.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}<div class="recruit-note"><p>${escape(home.recruitment)}</p><a class="text-link" href="./join.html">Join our group →</a></div></div>
</section>
<section class="section" aria-label="Research">${sectionTitle('Research', 'Research')}<div class="research-grid">${research.map(item => `<article class="research-item"><span class="number">${escape(item.number)}</span><h3>${escape(item.title)}</h3>${item.english && item.english !== item.title ? `<p class="english-label">${escape(item.english)}</p>` : ''}<p>${escape(item.description)}</p></article>`).join('')}</div></section>
<section class="section" aria-label="News">${sectionTitle('News', 'News')}<ul class="news-list">${news.map(item => `<li><time datetime="${escape(item.date.replaceAll('.', '-'))}">${escape(item.date)}</time><span class="news-tag">${escape(item.category)}</span><p>${safeUrl(item.url) ? `<a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.text)}</a>` : escape(item.text)}</p></li>`).join('')}</ul></section>
<section class="section" aria-label="Selected Publications">${sectionTitle('Selected Publications', 'Selected Publications', '<a href="./publications.html">View all →</a>')}<div>${publications.filter(p => p.selected).map(p => publication(p)).join('') || '<p class="empty">Publications will be added soon.</p>'}</div></section>`;

const years = [...new Set(publications.map(p => p.year))].sort((a, b) => Number(b) - Number(a));
const publicationsContent = pageHeading('Publications', 'PUBLICATIONS & PROJECTS', 'Selected papers and research projects, with links to publications and open resources.') + (years.map(y => `<section class="year-group" aria-label="${escape(y)} publications"><h2 class="year-title">${escape(y)}</h2><div>${publications.filter(p => p.year === y).map(p => publication(p, true)).join('')}</div></section>`).join('') || '<p class="empty">Publications will be added soon.</p>') + (projects.length ? `<section class="section">${sectionTitle('Research Projects', 'Research Projects')}<div class="project-list">${projects.map(project => `<article><p class="project-period">${escape(project.period)}</p><div><h3>${escape(project.title)}</h3><p>${escape(project.funding)} · ${escape(project.role)} · ${escape(project.amount)}</p></div></article>`).join('')}</div>${links([{ label: 'Project information: Official faculty profile', url: site.sourceUrl }])}</section>` : '');

const timeline = (items = []) => `<ol class="timeline">${items.map(item => `<li><span>${escape(item.period)}</span><div><strong>${escape(item.institution)}</strong><p>${escape(item.detail)}</p></div></li>`).join('')}</ol>`;
const teacherProfile = person => `<article class="teacher">
  <div class="lead-profile">${avatar(person, true)}<div><h3>${escape(person.name)}${example}</h3>${person.englishName && person.englishName !== person.name ? `<p class="person-english">${escape(person.englishName)}</p>` : ''}<p class="person-role">${escape(person.role)}</p><p class="bio">${escape(person.bio)}</p>${links(person.links)}</div></div>
  ${person.experience?.length || person.education?.length ? `<details class="faculty-history"><summary>Education and experience</summary>${person.experience?.length ? `<div class="history-section"><h4>Experience</h4>${timeline(person.experience)}</div>` : ''}${person.education?.length ? `<div class="history-section"><h4>Education</h4>${timeline(person.education)}</div>` : ''}</details>` : ''}
</article>`;
const memberCard = person => `<article class="member">${avatar(person)}<div><h3>${safeUrl(person.url) ? `<a href="${escape(person.url)}" target="_blank" rel="noopener noreferrer">${escape(person.name)}</a>` : escape(person.name)}</h3>${person.englishName && person.englishName !== person.name ? `<p class="person-english">${escape(person.englishName)}</p>` : ''}<p class="person-role">${escape(person.role)}</p></div></article>`;
const teamContent = pageHeading('People', 'OUR PEOPLE', team.intro)
  + `<section class="team-group" id="faculty">${sectionTitle('Faculty', 'Faculty')}${team.teachers.map(teacherProfile).join('')}</section>`
  + team.groups.map(group => `<section class="team-group"${group.id ? ` id="${escape(group.id)}"` : ''}>${sectionTitle(escape(group.title), escape(group.english))}${group.members.length ? `<div class="members">${group.members.map(memberCard).join('')}</div>` : `<p class="group-empty">${escape(group.emptyMessage || 'Member information will be added soon.')}</p>`}</section>`).join('');

const joinContent = pageHeading('Join Us', 'JOIN OUR GROUP', join.intro) + `<div class="opportunities">${join.positions.map(position => `<section class="opportunity"><h2>${escape(position.title)}</h2>${position.english && position.english !== position.title ? `<p class="english-label">${escape(position.english)}</p>` : ''}<p>${escape(position.description)}</p><p class="note">${escape(position.note)}</p></section>`).join('')}</div><section class="application"><div><h2>How to Apply</h2><ul>${join.application.map(item => `<li>${escape(item)}</li>`).join('')}</ul></div><div><p class="contact-label">Contact email</p>${email()}<p class="subject">Email subject format:<br>${escape(join.subject)}</p></div></section><section class="section">${sectionTitle(escape(join.cultureTitle || 'Research Together'), escape(join.cultureEnglish || 'Our Culture'))}<p>${escape(join.culture)}</p>${links([{ label: 'Recruitment details on the faculty profile', url: join.sourceUrl }])}</section>`;

const contactContent = pageHeading('Contact', 'GET IN TOUCH', contact.intro) + `<div class="contact-layout"><dl class="contact-list"><div><dt>Email</dt><dd>${email()}</dd></div><div><dt>Institution</dt><dd>${escape(site.institution)}</dd></div><div><dt>Visits</dt><dd>${escape(site.address)}</dd></div>${site.postalCode ? `<div><dt>Postal code</dt><dd>${escape(site.postalCode)}</dd></div>` : ''}</dl><aside class="contact-aside"><h2>Visiting the Group</h2><p>${escape(contact.visit)}</p><p class="muted">${escape(contact.directions)}</p><a href="./join.html">Student applications and research internships →</a>${links(site.links)}</aside></div>`;

const pages = { 'index.html': ['Home', homeContent], 'publications.html': ['Publications', publicationsContent], 'team.html': ['People', teamContent], 'join.html': ['Join Us', joinContent], 'contact.html': ['Contact', contactContent] };
// Generate all pages before writing, so invalid content does not leave a half-updated site.
const rendered = Object.entries(pages).map(([file, [title, content]]) => [file, layout(file, title, content)]);
for (const [file, html] of rendered) fs.writeFileSync(path.join(root, file), html, 'utf8');
console.log(`Updated ${rendered.length} pages. Open index.html to preview, or run npm start.`);
