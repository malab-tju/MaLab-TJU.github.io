/**
 * Render the same five public pages for the static build and the draft preview.
 * imageUrl receives a validated assets/ path. Return a blob or http(s) URL to
 * override it, or an empty value to keep the encoded relative asset path.
 * This module has no filesystem, Node.js, or DOM dependencies.
 */
export function renderWebsite(data, { imageUrl } = {}) {
if (imageUrl !== undefined && typeof imageUrl !== 'function') throw new TypeError('imageUrl must be a function.');
const { site, home, research, news, publications, team, join, contact, projects = [] } = data;
const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = value => /^(https?:\/\/|mailto:|\.\/|assets\/|#)/i.test(value || '') ? value : '';
const relativeAsset = value => {
  if (!value) return '';
  if (typeof value !== 'string' || !value.startsWith('assets/') || value.includes('..') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(`Image paths must be inside assets/: ${value}`);
  const relative = value.split('/').map(encodeURIComponent).join('/');
  const mapped = imageUrl?.(value);
  if (mapped == null || mapped === '' || mapped === value) return relative;
  if (typeof mapped !== 'string' || !/^(https?:\/\/|blob:)/i.test(mapped) || /[\u0000-\u0020\u007f]/.test(mapped)) throw new Error('Preview image URLs must use blob, http, or https.');
  return mapped;
};
const links = (items = [], className = 'inline-links') => {
  const valid = items.filter(item => safeUrl(item.url));
  return valid.length ? `<div class="${className}">${valid.map(item => `<a href="${escape(item.url)}"${/^https?:/i.test(item.url) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escape(item.label)}</a>`).join('')}</div>` : '';
};
const example = site.demo ? '<span class="sample-label">Example</span>' : '';
const email = () => site.demo ? `<span class="email">${escape(site.email)}</span>${example}` : `<a class="email" href="mailto:${escape(site.email)}">${escape(site.email)}</a>`;
const sectionTitle = (title, action = '') => `<div class="section-heading"><h2>${title}</h2>${action}</div>`;
const pageHeading = (title, intro) => `<header class="page-heading"><h1>${title}</h1>${intro ? `<p>${escape(intro)}</p>` : ''}</header>`;
const avatar = (person, lead = false) => person.photo ? `<img class="avatar" src="${escape(relativeAsset(person.photo))}" alt="${escape(person.name)}" width="${lead ? 164 : 86}" height="${lead ? 164 : 86}" loading="lazy">` : `<div class="avatar" aria-hidden="true">${escape(person.initials)}</div>`;

if (!site.name || !site.description || !/^\d{4}-\d{2}-\d{2}$/.test(site.updated)) throw new Error('Set the group name, description, and an update date in YYYY-MM-DD format.');
for (const paper of publications) {
  if (!/^[a-z0-9-]+$/.test(paper.id) || !/^\d{4}$/.test(paper.year)) throw new Error('Paper IDs must use lowercase letters, digits, and hyphens; years must have four digits.');
}
if (new Set(publications.map(p => p.id)).size !== publications.length) throw new Error('Paper IDs must be unique.');

const sentence = value => {
  const text = String(value || '').trim();
  return text && !/[.!?]$/.test(text) ? text + '.' : text;
};
function publication(paper) {
  const resources = paper.links.filter(item => safeUrl(item.url));
  const resource = resources.find(item => /^(pdf|doi|arxiv|paper|publication record)$/i.test(item.label)) || resources[0];
  const title = `<span${paper.titleLang ? ` lang="${escape(paper.titleLang)}"` : ''}>${escape(sentence(paper.title))}</span>`;
  const linkedTitle = resource ? `<a href="${escape(resource.url)}"${/^https?:/i.test(resource.url) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${title}</a>` : title;
  const hasYear = paper.venue.match(/\b\d{4}\b/g)?.includes(paper.year);
  const venue = hasYear ? paper.venue : [paper.venue, paper.year].filter(Boolean).join(', ');
  return `<li class="publication" id="${escape(paper.id)}">${escape(sentence(paper.authors))} ${linkedTitle} <cite>${escape(sentence(venue))}</cite>${example}</li>`;
}
const publicationList = papers => papers.length ? `<ol class="publication-list">${papers.map(publication).join('')}</ol>` : '<p class="empty">No publications listed.</p>';

const nav = [ ['index.html', 'Home'], ['publications.html', 'Publications'], ['team.html', 'People'], ['join.html', 'Join Us'], ['contact.html', 'Contact'] ];
const year = site.updated.slice(0, 4);
function layout(filename, title, content) {
  const fullTitle = filename === 'index.html' ? site.name : `${title} | ${site.name}`;
  const favicon = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="4" fill="#174b7a"/><text x="24" y="32" fill="white" text-anchor="middle" font-family="Georgia,serif" font-size="25">${escape(site.mark)}</text></svg>`);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escape(site.description)}">
  <meta name="content-verified" content="${escape(site.updated)}">
  <meta name="theme-color" content="#174b7a">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(fullTitle)}">
  <meta property="og:description" content="${escape(site.description)}">
  <title>${escape(fullTitle)}</title>
  <link rel="icon" type="image/svg+xml" href="${escape(favicon)}">
  <link rel="stylesheet" href="./assets/css/style.css">
</head>
<body class="page-${filename === 'index.html' ? 'home' : filename.replace('.html', '')}">
<a class="skip-link" href="#main">Skip to content</a>
<div class="container">
  <header class="site-header">
    <div class="header-top">
      <div class="site-identity"><a class="brand" href="./index.html" aria-label="${escape(site.name)} home">${escape(site.name)}</a>${site.subtitle ? `<p class="site-subtitle">${escape(site.subtitle)}</p>` : ''}</div>
      <div class="header-aside"><p class="site-institution">${escape(site.institution)}</p>${links(site.links, 'header-links')}</div>
    </div>
    <nav class="navigation" aria-label="Main navigation">${nav.map(([file, label]) => `<a href="./${file}"${file === filename ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    ${site.demo ? '<p class="demo-note"><span>Example site</span>Names, members, and publications are examples. Replace them before publishing.</p>' : ''}
  </header>
  <main id="main" tabindex="-1">${content}</main>
<footer class="site-footer"><p>© ${year} ${escape(site.name)}</p><div class="footer-right">${safeUrl(site.sourceUrl) ? `<a href="${escape(site.sourceUrl)}" target="_blank" rel="noopener noreferrer">Faculty profile</a><span aria-hidden="true"> · </span>` : ''}<a href="./admin/">Edit website</a></div></footer>
</div>
</body>
</html>
`;
}

const homeContent = `<section class="intro${site.imagePortrait ? ' intro-portrait' : ''}" aria-labelledby="intro-title">
  <div class="intro-copy">${home.eyebrow ? `<p class="eyebrow">${escape(home.eyebrow)}</p>` : ''}<h1 id="intro-title">${escape(home.heading)}</h1>${home.paragraphs.map((p, index) => `<p${index === 0 ? ' class="intro-lead"' : ''}>${escape(p)}</p>`).join('')}<div class="recruit-note"><p>${escape(home.recruitment)} <a href="./join.html">Open positions</a>.</p></div></div>
  <figure class="lab-figure"><img class="lab-photo${site.imagePortrait ? ' portrait-photo' : ''}" src="${escape(relativeAsset(site.image))}" alt="${escape(site.imageAlt)}" width="${Number(site.imageWidth) || 800}" height="${Number(site.imageHeight) || 600}" fetchpriority="high"><figcaption><span class="photo-caption">${escape(site.imageCaption).replaceAll(' · ', '<br>')}</span>${safeUrl(site.imageSource) ? `<a class="photo-credit" href="${escape(site.imageSource)}" target="_blank" rel="noopener noreferrer">Faculty directory</a>` : ''}</figcaption></figure>
</section>
<section class="section" aria-label="Research">${sectionTitle('Research')}<dl class="research-list">${research.map(item => `<div class="research-item"><dt>${escape(item.title)}</dt><dd>${escape(item.description)}</dd></div>`).join('')}</dl></section>
<section class="section" aria-label="Selected Publications">${sectionTitle('Selected publications', '<a href="./publications.html">All publications</a>')}${publicationList(publications.filter(p => p.selected))}</section>
<section class="section" aria-label="News">${sectionTitle('News')}<ul class="news-list">${news.map(item => `<li><time datetime="${escape(item.date.replaceAll('.', '-'))}">${escape(item.date)}</time><p>${safeUrl(item.url) ? `<a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.text)}</a>` : escape(item.text)}</p></li>`).join('')}</ul></section>`;

const sortedPublications = [...publications].sort((a, b) => Number(b.year) - Number(a.year));
const publicationsContent = pageHeading('Publications', '') + publicationList(sortedPublications) + (projects.length ? `<section class="section">${sectionTitle('Research projects')}<div class="project-list">${projects.map(project => `<article><p class="project-period">${escape(project.period)}</p><div><h3>${escape(project.title)}</h3><p>${escape(project.funding)} · ${escape(project.role)} · ${escape(project.amount)}</p></div></article>`).join('')}</div>${links([{ label: 'Project details on the faculty profile', url: site.sourceUrl }])}</section>` : '');

const timeline = (items = []) => `<ol class="timeline">${items.map(item => `<li><span>${escape(item.period)}</span><div><strong>${escape(item.institution)}</strong><p>${escape(item.detail)}</p></div></li>`).join('')}</ol>`;
const teacherProfile = person => `<article class="teacher">
  <div class="lead-profile">${avatar(person, true)}<div><h3>${escape(person.name)}${example}</h3>${person.englishName && person.englishName !== person.name ? `<p class="person-english">${escape(person.englishName)}</p>` : ''}<p class="person-role">${escape(person.role)}</p><p class="bio">${escape(person.bio)}</p>${links(person.links)}</div></div>
  ${person.experience?.length || person.education?.length ? `<details class="faculty-history"><summary>Education and experience</summary>${person.experience?.length ? `<div class="history-section"><h4>Experience</h4>${timeline(person.experience)}</div>` : ''}${person.education?.length ? `<div class="history-section"><h4>Education</h4>${timeline(person.education)}</div>` : ''}</details>` : ''}
</article>`;
const memberCard = person => `<article class="member">${avatar(person)}<div><h3>${safeUrl(person.url) ? `<a href="${escape(person.url)}" target="_blank" rel="noopener noreferrer">${escape(person.name)}</a>` : escape(person.name)}</h3>${person.englishName && person.englishName !== person.name ? `<p class="person-english">${escape(person.englishName)}</p>` : ''}<p class="person-role">${escape(person.role)}</p></div></article>`;
const teamContent = pageHeading('People', team.intro)
  + `<section class="team-group" id="faculty">${sectionTitle('Faculty')}${team.teachers.map(teacherProfile).join('')}</section>`
  + team.groups.map(group => `<section class="team-group"${group.id ? ` id="${escape(group.id)}"` : ''}>${sectionTitle(escape(group.title))}${group.members.length ? `<div class="members">${group.members.map(memberCard).join('')}</div>` : `<p class="group-empty">${escape(group.emptyMessage || 'Member information will be added soon.')}</p>`}</section>`).join('');

const joinContent = pageHeading('Join Us', join.intro) + `<div class="opportunities">${join.positions.map(position => `<section class="opportunity"><h2>${escape(position.title)}</h2>${position.english && position.english !== position.title ? `<p class="english-label">${escape(position.english)}</p>` : ''}<p>${escape(position.description)}</p><p class="note">${escape(position.note)}</p></section>`).join('')}</div><section class="application"><div><h2>How to apply</h2><ul>${join.application.map(item => `<li>${escape(item)}</li>`).join('')}</ul></div><div><p class="contact-label">Contact email</p>${email()}<p class="subject">Email subject format:<br>${escape(join.subject)}</p></div></section><section class="section">${sectionTitle(escape(join.cultureTitle || 'Recruitment'))}<p>${escape(join.culture)}</p>${links([{ label: 'Recruitment details on the faculty profile', url: join.sourceUrl }])}</section>`;

const contactContent = pageHeading('Contact', contact.intro) + `<div class="contact-layout"><dl class="contact-list"><div><dt>Email</dt><dd>${email()}</dd></div><div><dt>Institution</dt><dd>${escape(site.institution)}</dd></div><div><dt>Visits</dt><dd>${escape(site.address)}</dd></div>${site.postalCode ? `<div><dt>Postal code</dt><dd>${escape(site.postalCode)}</dd></div>` : ''}</dl><aside class="contact-aside"><h2>Visits</h2><p>${escape(contact.visit)}</p><p class="muted">${escape(contact.directions)}</p><a href="./join.html">Applications and internships</a>${links(site.links)}</aside></div>`;

const pages = { 'index.html': ['Home', homeContent], 'publications.html': ['Publications', publicationsContent], 'team.html': ['People', teamContent], 'join.html': ['Join Us', joinContent], 'contact.html': ['Contact', contactContent] };
// Keep literal HTML whitespace identical for published pages and previews.
return Object.fromEntries(Object.entries(pages).map(([file, [title, content]]) => [file, layout(file, title, content)]));
}
