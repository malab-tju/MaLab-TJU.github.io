const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function imagePaths(data) {
  return [data?.site?.image, ...(data?.team?.teachers || []).map(p => p.photo), ...(data?.team?.groups || []).flatMap(g => (g.members || []).map(p => p.photo))].filter(Boolean);
}
export function validateContent(data, { knownAssets } = {}) {
  const errors = [];
  const fail = text => { if (errors.length < 50) errors.push(text); };
  const text = (value, name, required = false) => {
    if (value == null && !required) return;
    if (typeof value !== 'string') { fail(`${name} must be text.`); return; }
    if (required && !value.trim()) fail(`${name} is required.`);
    if (value.length > 16000) fail(`${name} is too long (maximum 16,000 characters).`);
  };
  const record = (value, name) => { if (!object(value)) { fail(`${name} must be an object.`); return {}; } return value; };
  const list = (value, name) => { if (!Array.isArray(value)) { fail(`${name} must be a list.`); return []; } if (value.length > 300) fail(`${name} has too many entries (maximum 300).`); return value.slice(0, 300); };
  const fields = (value, name, keys, required = []) => { const item = record(value, name); for (const key of keys) text(item[key], `${name}: ${key}`, required.includes(key)); return item; };
  const url = (value, name) => {
    text(value, name);
    if (typeof value === 'string' && value && !/^(https?:\/\/[^\s]+|mailto:[^\s]+|\.\/[^\s]+|assets\/[^\s]+|#[^\s]+)$/i.test(value)) fail(`${name} must be an http(s), email, or relative link.`);
    if (typeof value === 'string' && /[\u0000-\u001f\u007f\\]/.test(value)) fail(`${name} contains an invalid character.`);
  };
  const links = (value, name) => list(value, name).forEach((item, i) => { item = fields(item, `${name} ${i+1}`, ['label', 'url'], ['label', 'url']); url(item.url, `${name} ${i+1}: URL`); });
  const photos = (value, name) => {
    text(value, name);
    if (!value || typeof value !== 'string') return;
    if (!/^assets\/images\/[a-zA-Z0-9._/-]+\.(?:jpe?g|png|webp|gif)$/i.test(value) || value.includes('..') || value.includes('//')) fail(`${name} must be a local image path inside assets/images/.`);
    else if (knownAssets && !knownAssets.has(value)) fail(`${name}: image not found. Upload it using the photo field.`);
  };
  const timeline = (value, name) => list(value, name).forEach((item, i) => fields(item, `${name} ${i+1}`, ['period', 'institution', 'detail'], ['period', 'institution', 'detail']));
  const person = (value, name, faculty = false) => {
    const item = fields(value, name, ['name','englishName','role','initials','photo', ...(faculty ? ['bio'] : ['url'])], ['name','role']);
    photos(item.photo, `${name}: photo`);
    if (!item.photo && !item.initials) fail(`${name}: add a photo or initials.`);
    if (faculty) { links(item.links, `${name}: links`); timeline(item.experience, `${name}: experience`); timeline(item.education, `${name}: education`); }
    else url(item.url, `${name}: profile URL`);
  };
  if (!object(data)) return ['Content must be a JSON object.'];
  const site = fields(data.site, 'Site', ['name','englishName','mark','institution','description','updated','email','address','postalCode','image','imageAlt','imageCaption','imageSource','sourceUrl','subtitle'], ['name','mark','institution','description','updated','email','image','imageAlt']);
  if (!validDate(site.updated)) fail('Site: source-check date must be a valid YYYY-MM-DD date.');
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(site.email || '')) fail('Site: enter a valid email address.');
  if (typeof site.demo !== 'boolean' || typeof site.imagePortrait !== 'boolean') fail('Site: example mode and portrait layout must be true or false.');
  for (const key of ['imageWidth','imageHeight']) if (!Number.isInteger(site[key]) || site[key] < 1 || site[key] > 16000) fail(`Site: ${key} must be a positive image dimension.`);
  photos(site.image, 'Site: main image'); url(site.imageSource, 'Site: image source'); url(site.sourceUrl, 'Site: official source'); links(site.links, 'Site links');
  const home = fields(data.home, 'Home', ['eyebrow','heading','recruitment'], ['heading']);
  list(home.paragraphs, 'Home paragraphs').forEach((p,i) => text(p, `Home paragraph ${i+1}`, true));
  list(data.research, 'Research').forEach((p,i) => fields(p, `Research ${i+1}`, ['number','title','english','description'], ['number','title','description']));
  list(data.news, 'News').forEach((p,i) => { p = fields(p, `News ${i+1}`, ['date','category','text','url'], ['date','text']); if (typeof p.date !== 'string' || !/^\d{4}\.\d{2}\.\d{2}$/.test(p.date) || !validDate(p.date.replaceAll('.', '-'))) fail(`News ${i+1}: date must use YYYY.MM.DD.`); url(p.url, `News ${i+1}: source`); });
  const paperIDs = new Set();
  list(data.publications, 'Publications').forEach((p,i) => {
    p = fields(p, `Paper ${i+1}`, ['id','year','title','englishTitle','titleLang','authors','venue','area','abstract','note'], ['id','year','title','authors','venue']);
    if (!/^[a-z0-9-]+$/.test(p.id || '') || p.id === 'main' || paperIDs.has(p.id)) fail(`Paper ${i+1}: use a unique lowercase ID with letters, digits, and hyphens.`);
    paperIDs.add(p.id); if (!/^\d{4}$/.test(p.year || '')) fail(`Paper ${i+1}: enter a four-digit year.`);
    if (p.titleLang && p.titleLang !== 'en') fail(`Paper ${i+1}: title language must be en.`);
    if (typeof p.selected !== 'boolean') fail(`Paper ${i+1}: selected must be true or false.`);
    links(p.links, `Paper ${i+1} links`);
  });
  const team = fields(data.team, 'People', ['intro']);
  list(team.teachers, 'Faculty').forEach((p,i) => person(p, `Faculty ${i+1}`, true));
  const groups = list(team.groups, 'Student groups');
  if (groups.length !== 3 || groups.map(g => g?.id).join(',') !== 'phd,masters,interns') fail('Keep the three student groups in order: phd, masters, interns.');
  groups.forEach((g,i) => { g = fields(g, `Student group ${i+1}`, ['id','title','english','emptyMessage'], ['id','title']); list(g.members, `${g.title || 'Group'} members`).forEach((p,j) => person(p, `${g.title || 'Group'} member ${j+1}`)); });
  const join = fields(data.join, 'Join Us', ['intro','subject','cultureTitle','cultureEnglish','culture','sourceUrl'], ['intro','subject']);
  list(join.positions, 'Open positions').forEach((p,i) => fields(p, `Position ${i+1}`, ['title','english','description','note'], ['title','description']));
  list(join.application, 'Application instructions').forEach((p,i) => text(p, `Application instruction ${i+1}`, true)); url(join.sourceUrl, 'Recruitment source');
  fields(data.contact, 'Contact', ['intro','visit','directions'], ['intro']);
  list(data.projects ?? [], 'Projects').forEach((p,i) => fields(p, `Project ${i+1}`, ['title','period','funding','role','amount'], ['title','period']));
  const scan = (value, path = '') => { if (typeof value === 'string' && /[\u3400-\u9fff]/.test(value)) fail(`${path}: use English text for this English website.`); else if (Array.isArray(value)) value.forEach((v,i) => scan(v, `${path} ${i+1}`)); else if (object(value)) Object.entries(value).forEach(([k,v]) => { if (['__proto__','constructor','prototype'].includes(k)) fail(`${path}: unsupported field name.`); else scan(v, path ? `${path}: ${k}` : k); }); };
  scan(data);
  return errors;
}

// Apply only the editor's changes to the latest content; never guess when both sides changed a list.
export function mergeContent(baseline, draft, remote) {
  const conflicts = [];
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const copy = value => value === undefined ? undefined : structuredClone(value);
  const merge = (base, local, latest, path) => {
    if (equal(local,base)) return copy(latest);
    if (equal(latest,base) || equal(local,latest)) return copy(local);
    if (object(base) && object(local) && object(latest)) {
      const result = Object.create(null);
      for (const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(latest)])) {
        if (['__proto__','constructor','prototype'].includes(key)) { conflicts.push(path ? `${path}.${key}` : key); continue; }
        const value = merge(Object.hasOwn(base,key) ? base[key] : undefined, Object.hasOwn(local,key) ? local[key] : undefined, Object.hasOwn(latest,key) ? latest[key] : undefined, path ? `${path}.${key}` : key);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    conflicts.push(path || 'Content');
    return copy(latest);
  };
  return { data: merge(baseline,draft,remote,''), conflicts };
}
