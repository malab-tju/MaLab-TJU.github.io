import { loadPublicContent, getRepositoryConfiguration, connectRepository, disconnectRepository, publishContent } from './github.mjs';
import { validateContent, mergeContent } from './content.mjs';
import { renderWebsite } from './site-renderer.mjs';

const $ = id => document.getElementById(id);
const clone = value => structuredClone(value);
let content = null;
let baselineContent = null;
let session = null;
let dirty = false;
let busy = false;
let activeSection = 'site';
let fieldCounter = 0;
const expandedEntries = new Set();
const uploads = new Map();
const imagePreviews = new Map();
const sections = [
  ['site', 'Website basics', 'Identity, contact details, homepage image, and official links.'],
  ['home', 'Home', 'The introduction and recruitment message on the homepage.'],
  ['research', 'Research', 'Research areas in the order they appear on the homepage.'],
  ['news', 'News', 'News items in display order. Add recent news at the top.'],
  ['publications', 'Publications', 'Compact citations: author names, paper title, venue, and year. Select papers to include on the homepage.'],
  ['team', 'People', 'Faculty, Ph.D. students, master’s students, and research interns.'],
  ['join', 'Join Us', 'Open positions, application instructions, and recruitment information.'],
  ['contact', 'Contact', 'Collaboration and visiting information. The public email and institution are under Website basics.'],
  ['projects', 'Projects', 'Funded research projects displayed on the Publications page.']
];
const labels = {
  name: 'Name', subtitle: 'Header subtitle', mark: 'Browser icon initials', institution: 'Institution', description: 'Description',
  demo: 'Show example content notice', updated: 'Source information checked', email: 'Contact email', address: 'Visit location', postalCode: 'Postal code',
  image: 'Homepage image', imageAlt: 'Image description (accessibility)', imageCaption: 'Image caption', links: 'Links', label: 'Link label', url: 'URL',
  imagePortrait: 'Use portrait layout', imageWidth: 'Original image width', imageHeight: 'Original image height', imageSource: 'Image source URL',
  sourceUrl: 'Source URL', eyebrow: 'Small heading', heading: 'Main heading', paragraphs: 'Introduction paragraphs', recruitment: 'Recruitment message',
  number: 'Display number', title: 'Title', date: 'Date', category: 'Category', text: 'News text', id: 'Identifier', year: 'Publication year',
  authors: 'Authors', venue: 'Conference or journal', area: 'Research area', abstract: 'Research summary', selected: 'Feature on homepage', note: 'Additional note',
  intro: 'Introduction', teachers: 'Faculty', groups: 'Student groups', emptyMessage: 'Message when no members are listed', members: 'Members',
  role: 'Role or research focus', initials: 'Initials (used without a photo)', photo: 'Profile photo', bio: 'Biography', experience: 'Experience',
  education: 'Education', period: 'Period', detail: 'Details', positions: 'Open positions', application: 'Application steps', subject: 'Suggested email subject',
  cultureTitle: 'Recruitment section title', culture: 'Recruitment information', visit: 'Visiting instructions', directions: 'Official links introduction',
  funding: 'Funding organization', amount: 'Funding amount', english: 'Alternative title', englishName: 'Alternative name', englishTitle: 'Alternative paper title',
  cultureEnglish: 'Alternative recruitment title', titleLang: 'Paper title language'
};
const helps = {
  updated: 'Date of the most recent content verification, in YYYY-MM-DD format.',
  imageAlt: 'Describe the image for visitors who use screen readers.',
  imageWidth: 'The original image width in pixels. Automatically detected when you upload a new homepage image.',
  imageHeight: 'The original image height in pixels. Automatically detected for uploaded homepage images.',
  imagePortrait: 'Enable for a portrait; disable for a wider image.',
  imageSource: 'Optional link to the original photo source.',
  selected: 'Selected papers also appear on the homepage.',
  id: 'Created automatically for new papers. Keep existing identifiers unchanged so saved links keep working.',
  authors: 'Author names exactly as they should appear in the citation.',
  venue: 'Conference or journal name, including volume and pages if available. The year is added if needed.',
  abstract: 'Stored for reference; not displayed in the compact publication list.',
  area: 'Stored as research metadata; not displayed in the compact citation.',
  note: 'Additional context for editors. Publication notes are not displayed in the compact list.',
  photo: 'Enter an existing image path or upload a photo below.',
  image: 'Enter an existing image path or upload an image below.',
  year: 'Four digits, for example 2026.',
  date: 'Use YYYY.MM.DD, for example 2026.10.06.',
  emptyMessage: 'This text is shown only when the group has no member profiles.',
  amount: 'Include the currency, for example CNY 300,000.',
  url: 'Use an https:// link or a mailto: email link.',
  demo: 'Turn off for the published research group website.'
};
const longKeys = new Set(['description', 'bio', 'abstract', 'recruitment', 'text', 'intro', 'culture', 'visit', 'directions', 'imageAlt', 'note', 'address']);
const wideKeys = new Set([...longKeys, 'title', 'heading', 'institution', 'venue', 'subject', 'image', 'photo', 'sourceUrl', 'imageSource', 'url', 'funding']);
const legacyKeys = new Set(['english', 'englishName', 'englishTitle', 'cultureEnglish', 'titleLang']);
const allowedImages = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const maxImageBytes = 3 * 1024 * 1024;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}
function button(text, className, action) {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function getAt(path) { return path.reduce((value, key) => value?.[key], content); }
function initialsFor(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
}
function setAt(path, value) {
  const parent = getAt(path.slice(0, -1));
  const key = path.at(-1);
  if (key === 'name' && parent.englishName === parent.name) parent.englishName = value;
  if (key === 'name' && Object.hasOwn(parent, 'initials') && (!parent.initials || parent.initials === initialsFor(parent.name))) {
    parent.initials = initialsFor(value);
    const fieldPath = path.slice(0, -1).concat('initials').join('.');
    const input = [...document.querySelectorAll('input[data-field-path]')].find(node => node.dataset.fieldPath === fieldPath);
    if (input) input.value = parent.initials;
  }
  if (key === 'title' && parent.english === parent.title) parent.english = value;
  if (key === 'title' && parent.englishTitle === parent.title) parent.englishTitle = value;
  parent[key] = value;
  markDirty();
  if (path[0] === 'publications' && typeof path[1] === 'number') refreshCitation(path[1]);
  if (['title', 'name', 'label', 'institution'].includes(key)) {
    const entryPath = path.slice(0, -1).join('.');
    const card = [...document.querySelectorAll('[data-entry-path]')].find(node => node.dataset.entryPath === entryPath);
    const heading = card?.querySelector(':scope > .entry-header h4');
    if (heading) heading.textContent = entryLabel(parent, path.at(-2));
  }
}
function labelFor(key) { return labels[key] || String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase()); }
function displayRepositoryTarget(configuration) {
  $('target-repository').href = configuration.repositoryUrl || `https://github.com/${configuration.owner}/${configuration.repo}`;
  $('target-repository').textContent = `${configuration.owner}/${configuration.repo}`;
  $('target-branch').textContent = configuration.branch;
}
function setStatus(message, working = false) { $('status').textContent = message; $('status').classList.toggle('busy', working); }
function errorSection(message) {
  const prefix = String(message).toLowerCase();
  if (/^(site|website)\b/.test(prefix)) return 'site';
  if (/^home\b/.test(prefix)) return 'home';
  if (/^research interns?\b/.test(prefix)) return 'team';
  if (/^research\b/.test(prefix)) return 'research';
  if (/^news\b/.test(prefix)) return 'news';
  if (/^(paper|publications?)\b/.test(prefix)) return 'publications';
  if (/^(faculty|student|people|team|ph\.d|master|research intern)\b/.test(prefix)) return 'team';
  if (/^(join|open positions?|positions?|application|recruitment)\b/.test(prefix)) return 'join';
  if (/^contact\b/.test(prefix)) return 'contact';
  if (/^projects?\b/.test(prefix)) return 'projects';
  return null;
}
function showErrors(errors = []) {
  $('error-list').replaceChildren(...errors.map(message => {
    const item = element('li'); item.append(element('span', '', message));
    const section = errorSection(message);
    if (section && content) item.append(button('Open section', 'error-section-link', () => {
      activeSection = section; render();
      $('content-panel').scrollIntoView({ block: 'start' });
      $('content-panel').querySelector('.panel-heading h2')?.focus({ preventScroll: true });
    }));
    return item;
  }));
  $('error-box').hidden = errors.length === 0;
}
function updateState() {
  updateOverview();
  $('preview-button').disabled = !content || busy;
  document.querySelectorAll('[data-quick-add], #section-nav button').forEach(button => { button.disabled = !content || busy; });
  $('draft-state').classList.toggle('dirty', dirty);
  $('draft-label').textContent = dirty ? 'Unsaved changes in this tab' : 'No unsaved changes';
  $('submit-button').disabled = !session || !content || !dirty || busy;
  $('download-draft').disabled = !content || busy;
  $('import-draft').disabled = busy;
  $('connect-button').disabled = busy;
  $('github-token').disabled = busy;
  $('disconnect-button').disabled = busy;
  $('content-panel').inert = busy;
  document.body.classList.toggle('busy-mode', busy);
  $('content-panel').setAttribute('aria-busy', String(busy || !content));
}
function updateOverview() {
  const counts = {
    'count-publications': content?.publications?.length || 0,
    'count-faculty': content?.team?.teachers?.length || 0,
    'count-students': (content?.team?.groups || []).reduce((sum, group) => sum + (group.members?.length || 0), 0),
    'count-news': content?.news?.length || 0
  };
  for (const [id, count] of Object.entries(counts)) $(id).textContent = content ? String(count) : '—';
}
function markDirty() {
  dirty = !baselineContent || JSON.stringify(content) !== JSON.stringify(baselineContent) || activeUploads().length > 0;
  $('publish-result').hidden = true;
  updateState();
}
function setBusy(value) { busy = value; updateState(); }
function resetImages() {
  for (const url of imagePreviews.values()) URL.revokeObjectURL(url);
  imagePreviews.clear();
  uploads.clear();
}
function replaceContent(data, { baseline = data, preserveImages = false, hasChanges = false } = {}) {
  content = clone(data);
  baselineContent = baseline ? clone(baseline) : null;
  dirty = hasChanges;
  if (!preserveImages) resetImages();
  render();
  updateState();
}
function choice(title, message, options, cancelValue = false) {
  return new Promise(resolve => {
    const dialog = $('choice-dialog');
    $('dialog-title').textContent = title;
    $('dialog-message').textContent = message;
    const finish = value => { dialog.removeEventListener('cancel', cancel); dialog.close(); resolve(value); };
    const cancel = event => { event.preventDefault(); finish(cancelValue); };
    $('dialog-buttons').replaceChildren(...options.map(option => button(option.label, option.className || '', () => finish(option.value))));
    dialog.addEventListener('cancel', cancel);
    dialog.showModal();
  });
}

function defaultEntry(path, currentArray) {
  const key = path.at(-1);
  if (['paragraphs', 'application'].includes(key)) return '';
  if (key === 'links') return { label: '', url: '' };
  if (key === 'research' || path[0] === 'research' && path.length === 1) return { number: String(currentArray.length + 1).padStart(2, '0'), title: '', english: '', description: '' };
  if (key === 'news') return { date: new Date().toLocaleDateString('en-CA').replaceAll('-', '.'), category: 'News', text: '', url: '' };
  if (key === 'publications') return { id: 'paper-' + crypto.randomUUID(), year: String(new Date().getFullYear()), title: '', englishTitle: '', titleLang: 'en', authors: '', venue: '', area: '', abstract: '', selected: false, links: [], note: '' };
  if (key === 'teachers') return { name: '', englishName: '', role: '', initials: '', photo: '', bio: '', links: [], experience: [], education: [] };
  if (key === 'members') return { name: '', englishName: '', role: '', initials: '', photo: '', url: '' };
  if (['experience', 'education'].includes(key)) return { period: '', institution: '', detail: '' };
  if (key === 'positions') return { title: '', english: '', description: '', note: '' };
  if (key === 'projects') return { title: '', period: '', funding: '', role: '', amount: '' };
  const example = currentArray[0];
  if (example && typeof example === 'object' && !Array.isArray(example)) return Object.fromEntries(Object.entries(example).map(([entryKey, value]) => [entryKey, typeof value === 'boolean' ? false : typeof value === 'number' ? 0 : Array.isArray(value) ? [] : typeof value === 'object' && value ? {} : '']));
  return '';
}
function findArrayBlock(path) { return [...document.querySelectorAll('[data-array-path]')].find(node => node.dataset.arrayPath === path.join('.')); }
function focusEntry(path, index, mode = 'input') {
  const block = findArrayBlock(path);
  const card = [...(block?.querySelector(':scope > .entry-list')?.children || [])][index];
  if (card?.tagName === 'DETAILS') card.open = true;
  const target = mode === 'input'
    ? (card?.querySelector('input[data-field-path$=".title"], textarea[data-field-path$=".title"]') || card?.querySelector('input[data-field-path$=".name"]') || card?.querySelector('input, textarea'))
    : card?.querySelector('.entry-actions button:nth-child(' + (mode === 'up' ? 1 : 2) + ')');
  if (target && !target.disabled) target.focus(); else block?.querySelector('.array-heading button')?.focus();
}
function addEntry(path) {
  if (!content || busy) return;
  const values = getAt(path);
  if (!Array.isArray(values)) return;
  const prepend = path.length === 1 && ['news', 'publications'].includes(path[0]);
  const entry = defaultEntry(path, values);
  if (prepend) values.unshift(entry); else values.push(entry);
  const index = prepend ? 0 : values.length - 1;
  expandedEntries.add(path.concat(index).join('.'));
  activeSection = path[0];
  markDirty(); render(); focusEntry(path, index);
  setStatus('Added ' + singularFor(path.at(-1)) + ' to your draft. Complete the fields, preview, then submit.');
}
function citationText(paper) {
  const sentence = value => {
    const text = String(value || '').trim();
    return text && !/[.!?]$/.test(text) ? text + '.' : text;
  };
  const hasYear = String(paper.venue || '').match(/\b\d{4}\b/g)?.includes(paper.year);
  const venue = hasYear ? paper.venue : [paper.venue, paper.year].filter(Boolean).join(', ');
  return [sentence(paper.authors || 'Author names'), sentence(paper.title || 'Paper title'), sentence(venue)].filter(Boolean).join(' ');
}
function refreshCitation(index) {
  const card = [...document.querySelectorAll('[data-entry-path]')].find(node => node.dataset.entryPath === 'publications.' + index);
  const preview = card?.querySelector('.citation-preview-text');
  if (preview) preview.textContent = citationText(content.publications[index]);
}
function entryLabel(value, index) {
  if (typeof value === 'string') return `Item ${index + 1}`;
  return value?.title || value?.name || value?.label || value?.institution || `Entry ${index + 1}`;
}
function singularFor(key) {
  return ({ teachers: 'faculty member', members: 'member', publications: 'publication', research: 'research area', news: 'news item', projects: 'project', links: 'link', experience: 'experience', education: 'education', positions: 'position', paragraphs: 'paragraph', application: 'step' })[key] || 'entry';
}
function renderArray(path, title = labelFor(path.at(-1))) {
  const values = getAt(path);
  const key = path.at(-1);
  const singular = singularFor(key);
  const collapsible = path.length === 1 || ['teachers', 'members'].includes(key);
  const block = element('section', 'array-block');
  const heading = element('div', 'array-heading');
  const headingText = element('div');
  headingText.append(element('h3', '', title));
  headingText.append(element('p', 'help', collapsible ? 'Click a title to edit. Use the arrows to change the order.' : 'Use the arrows to change the display order.'));
  heading.append(headingText, button('+ Add ' + singular, 'button-secondary', () => addEntry(path)));
  block.append(heading);
  block.dataset.arrayPath = path.join('.');
  if (!values.length) block.append(element('p', 'empty-list', `No ${title.toLowerCase()} listed. Add an entry to get started.`));
  const list = element('div', 'entry-list');
  values.forEach((value, index) => {
    const card = element(collapsible ? 'details' : 'article', typeof value === 'string' ? 'entry-card string-entry' : 'entry-card');
    card.dataset.entryPath = path.concat(index).join('.');
    if (collapsible) {
      card.open = expandedEntries.has(card.dataset.entryPath);
      card.addEventListener('toggle', () => {
        if (card.open) expandedEntries.add(card.dataset.entryPath); else expandedEntries.delete(card.dataset.entryPath);
      });
    }
    const header = element(collapsible ? 'summary' : 'div', 'entry-header');
    header.append(element('h4', '', entryLabel(value, index)));
    const actions = element('div', 'entry-actions');
    const up = button('↑', 'button-secondary move-button', () => {
      [values[index - 1], values[index]] = [values[index], values[index - 1]];
      markDirty(); render(); focusEntry(path, index - 1, 'up'); setStatus(`Moved ${singular} up.`);
    });
    up.setAttribute('aria-label', `Move ${singular} ${index + 1} up`); up.disabled = index === 0;
    const down = button('↓', 'button-secondary move-button', () => {
      [values[index + 1], values[index]] = [values[index], values[index + 1]];
      markDirty(); render(); focusEntry(path, index + 1, 'down'); setStatus(`Moved ${singular} down.`);
    });
    down.setAttribute('aria-label', `Move ${singular} ${index + 1} down`); down.disabled = index === values.length - 1;
    const remove = button('Remove', 'button-danger', async () => {
      const confirmed = await choice(`Remove this ${singular}?`, `“${entryLabel(value, index)}” will be removed from your draft. The published website will change only after you submit.`, [
        { label: 'Cancel', value: false, className: 'button-secondary' },
        { label: 'Remove', value: true, className: 'button-danger' }
      ]);
      if (confirmed) { values.splice(index, 1); markDirty(); render(); focusEntry(path, Math.min(index, values.length - 1)); setStatus(`Removed ${singular} from the draft.`); }
    });
    remove.setAttribute('aria-label', `Remove ${singular} ${index + 1}`);
    actions.append(up, down, remove); header.append(actions); card.append(header);
    if (key === 'publications') {
      const preview = element('div', 'citation-preview');
      preview.append(element('p', 'help', 'Citation on the public website'), element('p', 'citation-preview-text', citationText(value)));
      card.append(preview);
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) card.append(renderObject([...path, index]));
    else card.append(renderField([...path, index], typeof value === 'string' ? value : JSON.stringify(value), `${singular[0].toUpperCase()}${singular.slice(1)}`, true));
    list.append(card);
  });
  block.append(list);
  return block;
}
function isAdvancedField(path, key) {
  if (path.length === 1 && path[0] === 'site') return ['mark', 'demo', 'updated', 'imageWidth', 'imageHeight', 'imageSource', 'sourceUrl'].includes(key);
  if (path.length === 1 && path[0] === 'home') return key === 'eyebrow';
  if (path[0] === 'research') return key === 'number';
  if (path[0] === 'news') return key === 'category';
  if (path[0] === 'publications') return ['id', 'area', 'abstract', 'note'].includes(key);
  return path[0] === 'team' && key === 'initials';
}
function renderObject(path, omitted = []) {
  const object = getAt(path);
  const fields = element('div', 'object-fields');
  const additional = [];
  const advanced = [];
  for (const [key, value] of Object.entries(object || {})) {
    if (omitted.includes(key)) continue;
    if (legacyKeys.has(key)) {
      const equivalent = key === 'englishName' ? object.name : key === 'cultureEnglish' ? object.cultureTitle : object.title;
      if (value && value !== equivalent && !(key === 'titleLang' && value === 'en')) additional.push(renderField([...path, key], value));
      continue;
    }
    let field;
    if (Array.isArray(value)) field = renderArray([...path, key]);
    else if (value && typeof value === 'object') {
      field = element('section', 'array-block');
      field.append(element('h3', '', labelFor(key)), renderObject([...path, key]));
    } else field = renderField([...path, key], value);
    if (isAdvancedField(path, key)) advanced.push(field); else fields.append(field);
  }
  for (const [title, entries] of [['Advanced settings and metadata', advanced], ['Alternative labels', additional]]) {
    if (!entries.length) continue;
    const details = element('details', 'extra-fields');
    details.append(element('summary', '', title));
    const extra = element('div', 'object-fields'); extra.append(...entries); details.append(extra); fields.append(details);
  }
  return fields;
}
function renderField(path, value, customLabel, forceLong = false) {
  const key = path.at(-1);
  const label = customLabel || labelFor(key);
  const field = element('div', 'field');
  if (wideKeys.has(key) || forceLong) field.classList.add('wide');
  const id = `field-${++fieldCounter}`;
  const fieldLabel = element('label', '', label); fieldLabel.htmlFor = id;
  if (typeof value === 'boolean') {
    field.className = 'field checkbox-field';
    const input = element('input'); input.id = id; input.type = 'checkbox'; input.checked = value;
    input.dataset.fieldPath = path.join('.');
    input.addEventListener('change', () => setAt(path, input.checked));
    field.append(input, fieldLabel);
    return field;
  }
  const long = forceLong || longKeys.has(key) || String(value ?? '').length > 160;
  const input = element(long ? 'textarea' : 'input');
  input.id = id;
  input.dataset.fieldPath = path.join('.');
  if (!long) input.type = typeof value === 'number' ? 'number' : key === 'email' ? 'email' : key === 'updated' ? 'date' : 'text';
  if (typeof value === 'number') { input.min = '1'; input.step = '1'; }
  if (key === 'id') { input.pattern = '[a-z0-9-]+'; input.spellcheck = false; }
  if (['url', 'sourceUrl', 'imageSource', 'photo', 'image', 'email'].includes(key)) { input.spellcheck = false; input.autocapitalize = 'none'; }
  input.value = value ?? '';
  input.addEventListener('input', () => {
    setAt(path, typeof value === 'number' ? input.value === '' ? 0 : Number(input.value) : input.value);
    if (['photo', 'image'].includes(key)) refreshImagePreview(field, input.value);
  });
  field.append(fieldLabel, input);
  if (helps[key]) {
    const help = element('p', 'help', helps[key]); help.id = `${id}-help`; input.setAttribute('aria-describedby', help.id); field.append(help);
  }
  if (['photo', 'image'].includes(key)) addImageUpload(field, path, input);
  return field;
}
function imageUrl(path) {
  if (imagePreviews.has(path)) return imagePreviews.get(path);
  if (/^https:\/\//i.test(path)) return path;
  if (/^assets\/images\/[a-zA-Z0-9._/-]+$/.test(path) && !path.includes('..')) return `../${path}`;
  return null;
}
function refreshImagePreview(field, path) {
  const preview = field.querySelector('.image-preview');
  if (!preview) return;
  const url = imageUrl(path);
  preview.hidden = !url;
  if (url) preview.src = url;
  else preview.removeAttribute('src');
  const pending = field.querySelector('.image-pending');
  pending.hidden = !uploads.has(path);
}
function addImageUpload(field, path, input) {
  const controls = element('div', 'image-controls');
  const preview = element('img', 'image-preview'); preview.alt = 'Current image preview'; preview.addEventListener('error', () => { preview.hidden = true; });
  const uploadBox = element('div', 'image-upload');
  const file = element('input'); file.type = 'file'; file.accept = 'image/jpeg,image/png,image/webp'; file.setAttribute('aria-label', `Upload ${labelFor(path.at(-1)).toLowerCase()}`);
  uploadBox.append(file, element('p', 'help', 'JPEG, PNG, or WebP · up to 3 MB. Uploaded with your content when you submit.'));
  const pending = element('p', 'image-pending', 'New image ready to publish'); pending.hidden = true; uploadBox.append(pending);
  file.addEventListener('change', async () => {
    const image = file.files?.[0]; file.value = '';
    if (!image || busy) return;
    if (!allowedImages[image.type]) { showErrors(['Choose a JPEG, PNG, or WebP image.']); return; }
    if (image.size > maxImageBytes || image.size === 0) { showErrors(['Each image must be larger than 0 bytes and no larger than 3 MB.']); return; }
    setBusy(true); setStatus('Reading the selected image…', true);
    try {
      const bitmap = await createImageBitmap(image);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 16000 || dimensions.height > 16000) throw new Error('Image dimensions must be between 1 and 16,000 pixels.');
      const bytes = new Uint8Array(await image.arrayBuffer());
      const assetPath = `assets/images/editor-${crypto.randomUUID()}.${allowedImages[image.type]}`;
      const blobUrl = URL.createObjectURL(image);
      uploads.set(assetPath, { path: assetPath, bytes, mimeType: image.type }); imagePreviews.set(assetPath, blobUrl);
      setAt(path, assetPath); input.value = assetPath; refreshImagePreview(field, assetPath);
      if (path.length === 2 && path[0] === 'site' && path[1] === 'image') {
        content.site.imageWidth = dimensions.width; content.site.imageHeight = dimensions.height;
        markDirty(); render();
      }
      showErrors(); setStatus('Image added to your draft. Submit changes to upload it.');
    } catch (error) { showErrors([`Could not read this image: ${error.message}`]); setStatus('Image not added. Your other changes are preserved.'); }
    finally { setBusy(false); }
  });
  controls.append(preview, uploadBox); field.append(controls); refreshImagePreview(field, input.value);
}
function renderPeople() {
  const fragment = document.createDocumentFragment();
  fragment.append(renderObject(['team'], ['teachers', 'groups']));
  const faculty = element('section', 'people-group'); faculty.append(renderArray(['team', 'teachers'], 'Faculty')); fragment.append(faculty);
  content.team.groups.forEach((group, index) => {
    const block = element('section', 'people-group');
    block.append(element('h3', '', ({ phd: 'Ph.D. Students', masters: 'Master’s Students', interns: 'Research Interns' })[group.id] || group.title));
    block.append(renderObject(['team', 'groups', index], ['id', 'members']));
    block.append(renderArray(['team', 'groups', index, 'members'], `${group.title} — members`));
    fragment.append(block);
  });
  return fragment;
}
function render() {
  if (!content) return;
  fieldCounter = 0;
  const nav = $('section-nav');
  nav.replaceChildren(...sections.map(([key, title]) => {
    const item = button(title, '', () => { activeSection = key; render(); $('content-panel').scrollIntoView({ block: 'start', behavior: 'auto' }); });
    if (key === activeSection) item.setAttribute('aria-current', 'page');
    return item;
  }));
  const [, title, description] = sections.find(([key]) => key === activeSection);
  const heading = element('div', 'panel-heading'); const headingTitle = element('h2', '', title); headingTitle.tabIndex = -1; heading.append(headingTitle, element('p', '', description));
  const fields = activeSection === 'team' ? renderPeople() : Array.isArray(content[activeSection]) ? renderArray([activeSection], title) : renderObject([activeSection]);
  $('content-panel').replaceChildren(heading, fields);
  updateState();
}
function collectStrings(value, strings = new Set()) {
  if (typeof value === 'string') strings.add(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, strings));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectStrings(item, strings));
  return strings;
}
function activeUploads() { const used = collectStrings(content); return [...uploads.values()].filter(item => used.has(item.path)); }
function validateDraft(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The draft must contain a website content object.');
  for (const key of ['site', 'home', 'team', 'join', 'contact']) if (!data[key] || typeof data[key] !== 'object' || Array.isArray(data[key])) throw new Error(`The draft is missing the ${key} section.`);
  for (const key of ['research', 'news', 'publications', 'projects']) if (!Array.isArray(data[key])) throw new Error(`The draft must include a ${key} list.`);
  if (!Array.isArray(data.team.teachers) || !Array.isArray(data.team.groups)) throw new Error('The draft must contain faculty and student groups.');
  const ids = data.team.groups.map(group => group?.id);
  if (ids.join(',') !== 'phd,masters,interns' || data.team.groups.some(group => !Array.isArray(group.members))) throw new Error('Keep the Ph.D., master’s, and intern groups in your draft.');
}
function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

$('connect-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const token = $('github-token').value.trim(); $('github-token').value = '';
  if (!token) { showErrors(['Paste a GitHub personal access token to connect.']); return; }
  setBusy(true); showErrors(); setStatus('Checking repository permissions and loading the latest content…', true);
  try {
    const result = await connectRepository(token);
    session = result.session;
    displayRepositoryTarget({ ...session, repositoryUrl: result.repositoryUrl });
    $('repository-link').href = result.repositoryUrl;
    $('repository-link').textContent = `${session.owner}/${session.repo}`;
    $('connect-form').hidden = true; $('connected-state').hidden = false;
    let replacingEntireContent = false;
    if (dirty) {
      if (baselineContent) {
        const merged = mergeContent(baselineContent, content, result.data);
        if (merged.conflicts.length) {
          disconnectCurrentSession();
          showErrors(merged.conflicts.map(path => `${path}: both your draft and the repository changed this content. Arrays are checked as a complete list.`));
          setStatus('Changes overlap with another edit. Your draft is preserved and GitHub is disconnected. Download it, reload the latest website, and reapply the conflicting changes.');
          await choice('Another editor changed the same content', 'Your draft has been preserved. Save it before continuing. To resolve the conflict, you can download this draft and start with the latest repository content, then reapply the changes you want.', [
            { label: 'Keep draft and disconnect', value: 'keep', className: 'button-secondary' },
            { label: 'Download draft and load latest', value: 'latest' }
          ]).then(action => {
            if (action === 'latest') {
              downloadDraft(); replaceContent(result.data); showErrors();
              setStatus('Your draft was downloaded. The latest repository content is loaded; reconnect and reapply your changes.');
            }
          });
          return;
        }
        const action = await choice('Use your changes with the latest website?', 'Changes made by other editors in fields you did not edit will be preserved. Your own edits will be applied on top of the latest repository version.', [
          { label: 'Cancel', value: 'cancel', className: 'button-secondary' },
          { label: 'Load latest content', value: 'latest', className: 'button-secondary' },
          { label: 'Keep my changes', value: 'merge' }
        ], 'cancel');
        if (action === 'cancel') { disconnectCurrentSession(); setStatus('Connection cancelled. Your draft is preserved.'); return; }
        if (action === 'latest') replaceContent(result.data);
        else {
          replaceContent(merged.data, { baseline: result.data, preserveImages: true });
          markDirty();
        }
      } else {
        const action = await choice('Replace the entire website content?', 'This imported draft has no original version to compare. Submitting it would replace all current website content, including updates made by other editors. Only choose Replace entire content if this is intentional.', [
          { label: 'Cancel', value: 'cancel', className: 'button-secondary' },
          { label: 'Load latest content', value: 'latest', className: 'button-secondary' },
          { label: 'Replace entire content', value: 'replace', className: 'button-danger' }
        ], 'cancel');
        if (action === 'cancel') { disconnectCurrentSession(); setStatus('Connection cancelled. Your imported draft is preserved.'); return; }
        if (action === 'latest') replaceContent(result.data);
        else { baselineContent = clone(result.data); replacingEntireContent = true; markDirty(); }
      }
    } else replaceContent(result.data);
    setStatus(dirty ? replacingEntireContent ? 'Connected. You approved replacing the entire current website content with this imported draft.' : 'Connected. Your changes are ready to submit, and updates in unedited fields are preserved.' : 'Connected. You are editing the latest repository content.');
  } catch (error) {
    if (session) disconnectRepository(session);
    session = null; $('connect-form').hidden = false; $('connected-state').hidden = true;
    showErrors([error.message || 'Could not connect to GitHub.']);
    setStatus('Connection unsuccessful. Your draft is still available.');
  } finally { setBusy(false); }
});
function disconnectCurrentSession() {
  if (session) disconnectRepository(session);
  session = null; $('connect-form').hidden = false; $('connected-state').hidden = true;
  $('repository-link').removeAttribute('href'); $('repository-link').textContent = ''; $('github-token').value = '';
  updateState();
}
$('disconnect-button').addEventListener('click', () => {
  disconnectCurrentSession();
  setStatus('Disconnected. Your draft remains in this tab. Connect again to publish.');
});
$('submit-button').addEventListener('click', async () => {
  if (!session || !content || busy || !dirty) return;
  const newImages = activeUploads();
  const errors = validateContent(content);
  if (errors.length) { showErrors(errors); setStatus('Your draft is preserved. Open the indicated sections, correct the listed fields, and submit again.'); $('error-box').scrollIntoView({ block: 'center' }); return; }
  setBusy(true); showErrors(); $('publish-result').hidden = true;
  setStatus('Submitting the content and images to GitHub…', true);
  try {
    const submitted = clone(content);
    const result = await publishContent(session, submitted, newImages, 'Update research group website content');
    baselineContent = clone(submitted);
    uploads.clear();
    dirty = JSON.stringify(content) !== JSON.stringify(baselineContent);
    $('commit-link').href = result.commitUrl;
    $('actions-link').href = result.actionsUrl || `${result.repositoryUrl || $('repository-link').href}/actions`;
    $('publish-result').hidden = false;
    setStatus('Changes committed successfully. GitHub Pages deployment is in progress.');
    render();
    $('publish-result').scrollIntoView({ block: 'center' });
  } catch (error) {
    showErrors([error.message || 'Could not submit changes.']);
    setStatus('Your draft has been preserved. Download it to keep a copy before retrying.');
  } finally { setBusy(false); }
});
function downloadDraft() {
  if (!content) return;
  const draft = { format: 'malab-content-draft', version: 1, content: clone(content), baseline: baselineContent ? clone(baselineContent) : null, images: activeUploads().map(item => ({ path: item.path, mimeType: item.mimeType, base64: bytesToBase64(item.bytes) })) };
  const blob = new Blob([JSON.stringify(draft, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = element('a'); link.href = url; link.download = `malab-draft-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus('Draft downloaded, including the original version and any new images. Import this file to continue editing later.');
}
$('download-draft').addEventListener('click', downloadDraft);
$('import-draft').addEventListener('click', () => $('draft-file').click());
$('draft-file').addEventListener('change', async () => {
  const file = $('draft-file').files?.[0]; $('draft-file').value = '';
  if (!file || busy) return;
  setBusy(true);
  try {
    if (file.size > 128 * 1024 * 1024) throw new Error('This draft is too large. Choose a JSON file smaller than 128 MB.');
    const parsed = JSON.parse(await file.text());
    const data = parsed.format === 'malab-content-draft' ? parsed.content : parsed;
    validateDraft(data);
    const baseline = parsed.format === 'malab-content-draft' && parsed.baseline ? parsed.baseline : null;
    if (baseline) validateDraft(baseline);
    const importedImages = [];
    if (parsed.format === 'malab-content-draft') {
      if (parsed.version !== 1 || !Array.isArray(parsed.images) || parsed.images.length > 30) throw new Error('This draft format is not supported.');
      const seen = new Set();
      for (const item of parsed.images) {
        if (!item || !/^assets\/images\/editor-[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(item.path) || !allowedImages[item.mimeType] || typeof item.base64 !== 'string' || item.base64.length > 4 * 1024 * 1024 + 20 || seen.has(item.path)) throw new Error('The draft contains an unsupported image entry.');
        const bytes = base64ToBytes(item.base64);
        if (!bytes.length || bytes.length > maxImageBytes) throw new Error('Each draft image must be no larger than 3 MB.');
        seen.add(item.path); importedImages.push({ path: item.path, bytes, mimeType: item.mimeType });
      }
    }
    if (dirty && !await choice('Replace your current draft?', 'Importing will replace the unfinished edits in this tab. Download the current draft first if you want to keep it.', [
      { label: 'Cancel', value: false, className: 'button-secondary' }, { label: 'Import draft', value: true }
    ])) return;
    disconnectCurrentSession();
    replaceContent(data, { baseline });
    for (const item of importedImages) { uploads.set(item.path, item); imagePreviews.set(item.path, URL.createObjectURL(new Blob([item.bytes], { type: item.mimeType }))); }
    markDirty(); render();
    const errors = validateContent(content); showErrors(errors);
    setStatus(errors.length ? 'Draft imported with fields to correct. Your edits are preserved; fix the listed fields before submitting.' : baseline ? 'Draft imported with its original version. Connect GitHub to combine your changes with the latest content.' : 'Draft imported without an original version. Connecting will ask before replacing the entire current website content.');
  } catch (error) { showErrors([`Could not import this draft: ${error.message}`]); }
  finally { setBusy(false); }
});

const quickAddPaths = {
  publication: () => ['publications'],
  news: () => ['news'],
  faculty: () => ['team', 'teachers'],
  phd: () => ['team', 'groups', content.team.groups.findIndex(group => group.id === 'phd'), 'members'],
  masters: () => ['team', 'groups', content.team.groups.findIndex(group => group.id === 'masters'), 'members'],
  interns: () => ['team', 'groups', content.team.groups.findIndex(group => group.id === 'interns'), 'members']
};
document.querySelectorAll('[data-quick-add]').forEach(control => control.addEventListener('click', () => {
  if (content && !busy) addEntry(quickAddPaths[control.dataset.quickAdd]());
}));

let previewDialog = null;
let previewFrame = null;
let previewPages = null;
const previewPageNames = {
  'index.html': 'Home', 'publications.html': 'Publications', 'team.html': 'People', 'join.html': 'Join Us', 'contact.html': 'Contact'
};
function scrollPreviewTarget(frameDocument, hash) {
  let id = hash.replace(/^#/, '');
  try { id = decodeURIComponent(id); } catch {}
  const target = frameDocument.getElementById(id);
  target?.scrollIntoView();
  target?.focus({ preventScroll: true });
}
function showPreviewPage(filename, hash = '') {
  if (!Object.hasOwn(previewPages, filename)) return;
  previewDialog.querySelectorAll('[data-preview-page]').forEach(control => {
    if (control.dataset.previewPage === filename) control.setAttribute('aria-current', 'page');
    else control.removeAttribute('aria-current');
  });
  const documentCopy = new DOMParser().parseFromString(previewPages[filename], 'text/html');
  const base = document.createElement('base');
  base.href = new URL('../', location.href).href;
  documentCopy.head.prepend(base);
  previewFrame.onload = () => {
    const frameDocument = previewFrame.contentDocument;
    if (!frameDocument) return;
    frameDocument.querySelectorAll('a[href]').forEach(link => link.addEventListener('click', event => {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) {
        event.preventDefault(); scrollPreviewTarget(frameDocument, href); return;
      }
      const target = new URL(href, frameDocument.baseURI);
      const targetFile = target.pathname.split('/').pop() || 'index.html';
      const root = new URL('../', location.href);
      const currentSitePath = target.pathname === new URL(targetFile, root).pathname || (targetFile === 'index.html' && target.pathname === root.pathname);
      if (target.origin === location.origin && currentSitePath && Object.hasOwn(previewPages, targetFile)) {
        event.preventDefault();
        showPreviewPage(targetFile, target.hash);
      } else if (target.origin === location.origin && target.hash && target.pathname === new URL('../' + filename, location.href).pathname) {
        event.preventDefault();
        scrollPreviewTarget(frameDocument, target.hash);
      } else {
        link.target = '_blank'; link.rel = 'noopener noreferrer';
      }
    }));
    if (hash) scrollPreviewTarget(frameDocument, hash);
  };
  previewFrame.srcdoc = '<!doctype html>\n' + documentCopy.documentElement.outerHTML;
}
function openPreview() {
  if (!content || busy) return;
  const errors = validateContent(content);
  if (errors.length) {
    showErrors(errors);
    setStatus('Complete the listed fields before previewing. Your draft is preserved.');
    $('error-box').scrollIntoView({ block: 'center' });
    return;
  }
  showErrors();
  try { previewPages = renderWebsite(clone(content), { imageUrl: path => imagePreviews.get(path) }); }
  catch (error) { showErrors([error.message || 'Could not preview this draft.']); return; }
  if (!previewDialog) {
    previewDialog = element('dialog', 'preview-dialog'); previewDialog.id = 'preview-dialog';
    previewDialog.setAttribute('aria-labelledby', 'preview-title');
    const header = element('div', 'preview-header');
    const description = element('div');
    const title = element('h2', '', 'Preview changes'); title.id = 'preview-title';
    description.append(title, element('p', 'help', 'Unpublished preview. Close this window to continue editing.'));
    header.append(description, button('Close preview', 'button-secondary', () => previewDialog.close()));
    const nav = element('nav', 'preview-nav'); nav.setAttribute('aria-label', 'Preview pages');
    nav.append(...Object.entries(previewPageNames).map(([filename, label]) => {
      const control = button(label, 'button-secondary', () => showPreviewPage(filename));
      control.dataset.previewPage = filename; return control;
    }));
    previewFrame = element('iframe', 'preview-frame');
    previewFrame.title = 'Unpublished website preview';
    previewFrame.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    previewDialog.append(header, nav, previewFrame); document.body.append(previewDialog);
  }
  const initial = ({ publications: 'publications.html', projects: 'publications.html', team: 'team.html', join: 'join.html', contact: 'contact.html' })[activeSection] || 'index.html';
  showPreviewPage(initial);
  previewDialog.showModal();
}
$('preview-button').addEventListener('click', openPreview);

window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

getRepositoryConfiguration().then(configuration => {
  if (!session) displayRepositoryTarget(configuration);
}).catch(error => {
  if (session) return;
  $('target-repository').textContent = 'Configuration unavailable';
  $('target-repository').removeAttribute('href');
  $('target-branch').textContent = 'Unavailable';
  showErrors([error.message || 'Could not load the editor repository configuration.']);
});

try {
  const data = await loadPublicContent();
  if (!content && !dirty && !session && !busy) { replaceContent(data); setStatus('Try the editor below. Connect GitHub when you are ready to publish.'); }
} catch (error) {
  if (!content && !busy) {
    $('content-panel').replaceChildren(element('p', 'loading', 'Connect GitHub or import a draft to start editing.'));
    showErrors([`Could not load the public website content: ${error.message}`]);
    setStatus('You can still connect to GitHub to load the latest repository content.');
  }
}
updateState();
