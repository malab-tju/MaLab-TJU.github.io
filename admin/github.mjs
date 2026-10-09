import { validateContent, imagePaths } from './content.mjs';
const sessions = new WeakMap();
const API = 'https://api.github.com';
const API_VERSION = '2026-03-10';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const MAX_CONTENT = 1024 * 1024;
const MAX_IMAGE = 3 * 1024 * 1024;
export class EditorError extends Error { constructor(message, code = 'REQUEST_FAILED') { super(message); this.name = 'EditorError'; this.code = code; } }
const conflict = () => new EditorError('Another editor has updated the repository. Your draft is still here. Download it, reconnect to load the latest version, and reapply your changes.', 'CONFLICT');
const repoPath = state => `/repos/${encodeURIComponent(state.owner)}/${encodeURIComponent(state.repo)}`;
const branchPath = branch => branch.split('/').map(encodeURIComponent).join('/');
const sha = value => { if (!/^[a-f0-9]{40,64}$/.test(value || '')) throw new EditorError('GitHub returned an invalid commit reference.'); return value; };
function base64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(s); }
function unbase64(value) { const s = atob(value.replace(/\s/g, '')); return Uint8Array.from(s, c => c.charCodeAt(0)); }
async function api(state, suffix, method = 'GET', body) {
  let response;
  try {
    response = await fetch(API + repoPath(state) + suffix, {
      method, mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(30000),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${state.token}`, 'X-GitHub-Api-Version': API_VERSION, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch { throw new EditorError('Could not reach GitHub. Check your connection and keep this page open or download your draft.', 'NETWORK'); }
  if (!response.ok) {
    const messages = { 401: 'Your GitHub token has expired or is invalid. Reconnect with a valid token.', 403: 'GitHub denied this request. Check repository Write access, token Contents permission, organization approval, and branch rules.', 404: 'GitHub could not find the repository, branch, or content. Check the repository configuration and token access.', 409: 'GitHub reported a conflict. Keep your draft and reconnect to the latest version.', 422: 'GitHub rejected this change. Check branch rules, token permissions, or whether another editor has submitted changes.', 429: 'GitHub is temporarily limiting requests. Keep your draft and try again later.' };
    throw new EditorError(messages[response.status] || `GitHub could not complete this request (HTTP ${response.status}). Your draft has not been discarded.`, `HTTP_${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}
async function configuration() {
  let config;
  try { const response = await fetch(new URL('./config.json', import.meta.url), { cache: 'no-store', credentials: 'omit' }); if (!response.ok) throw new Error(); config = await response.json(); }
  catch { throw new EditorError('Editor configuration could not be loaded. Open this page through the website or the local preview server.'); }
  const root = new URL('../', import.meta.url);
  const match = root.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  if (config.inferFromPagesUrl && match) {
    config.owner = match[1];
    config.repo = root.pathname.split('/').filter(Boolean)[0] || `${match[1]}.github.io`;
  }
  if (!/^[a-z0-9-]{1,39}$/i.test(config.owner || '') || !/^[a-z0-9._-]{1,100}$/i.test(config.repo || '') || !/^[a-z0-9._/-]{1,200}$/i.test(config.branch || '') || config.branch.includes('..') || config.branch.includes('//')) throw new EditorError('Editor repository configuration is invalid.');
  return config;
}
export async function getRepositoryConfiguration() {
  const config = await configuration();
  return { owner: config.owner, repo: config.repo, branch: config.branch, repositoryUrl: `https://github.com/${config.owner}/${config.repo}` };
}
export async function loadPublicContent() {
  const response = await fetch(new URL('../data/site.json', import.meta.url), { cache: 'no-store', credentials: 'omit' });
  if (!response.ok) throw new EditorError('Website content could not be loaded. Start the local preview server or open the published editor.');
  const data = await response.json();
  const errors = validateContent(data); if (errors.length) throw new EditorError(errors.join('\n'), 'VALIDATION');
  return data;
}
export async function connectRepository(token) {
  if (typeof token !== 'string' || !token.trim() || /\s/.test(token.trim())) throw new EditorError('Enter your own GitHub access token.');
  const config = await configuration();
  const state = { owner: config.owner, repo: config.repo, branch: config.branch, token: token.trim(), busy: false };
  try {
    const repository = await api(state, '');
    if (repository.permissions?.push === false || repository.archived) throw new EditorError('This account does not have Write access to this repository. Ask the lab administrator to grant editor access.', 'NO_WRITE_ACCESS');
    const ref = await api(state, `/git/ref/heads/${branchPath(state.branch)}`);
    state.commitSha = sha(ref.object?.sha);
    const commit = await api(state, `/git/commits/${state.commitSha}`);
    state.treeSha = sha(commit.tree?.sha);
    const tree = await api(state, `/git/trees/${state.treeSha}?recursive=1`);
    if (tree.truncated) throw new EditorError('This repository is too large for the editor to check safely. Ask the administrator to review its image folders.');
    const file = tree.tree.find(item => item.path === 'data/site.json' && item.type === 'blob' && item.mode === '100644');
    if (!file) throw new EditorError('data/site.json is missing from this branch. Upload the website source first.');
    const blob = await api(state, `/git/blobs/${sha(file.sha)}`);
    if (blob.encoding !== 'base64' || blob.size > MAX_CONTENT) throw new EditorError('Website content is too large for this editor (maximum 1 MB).');
    const data = JSON.parse(decoder.decode(unbase64(blob.content)).replace(/^\uFEFF/, ''));
    state.assets = new Set(tree.tree.filter(item => item.type === 'blob' && item.mode === '100644' && item.path.startsWith('assets/images/')).map(item => item.path));
    const errors = validateContent(data, { knownAssets: state.assets });
    if (errors.length) throw new EditorError(errors.join('\n'), 'VALIDATION');
    state.canonical = JSON.stringify(data, null, 2) + '\n';
    const session = Object.freeze({ owner: state.owner, repo: state.repo, branch: state.branch, get commitSha() { return state.commitSha; } });
    sessions.set(session, state);
    return { data, session, repositoryUrl: `https://github.com/${state.owner}/${state.repo}` };
  } catch (error) {
    state.token = '';
    if (error instanceof EditorError) throw error;
    throw new EditorError('The repository content could not be read. Check data/site.json in GitHub.', 'INVALID_CONTENT');
  }
}
export function disconnectRepository(session) {
  const state = sessions.get(session); if (state) state.token = ''; sessions.delete(session);
}
function checkUpload(upload) {
  if (!/^assets\/images\/editor-[a-z0-9-]{6,100}\.(?:jpg|jpeg|png|webp)$/i.test(upload.path || '') || !(upload.bytes instanceof Uint8Array) || !upload.bytes.length || upload.bytes.length > MAX_IMAGE) throw new EditorError('Upload a JPEG, PNG, or WebP image up to 3 MB using a photo field.', 'INVALID_IMAGE');
  const b = upload.bytes;
  const jpeg = b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  const png = b.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => b[i] === v);
  const webp = b.length >= 12 && String.fromCharCode(...b.subarray(0,4)) === 'RIFF' && String.fromCharCode(...b.subarray(8,12)) === 'WEBP';
  const extension = upload.path.split('.').pop().toLowerCase();
  if (!((jpeg && ['jpg','jpeg'].includes(extension) && upload.mimeType === 'image/jpeg') || (png && extension === 'png' && upload.mimeType === 'image/png') || (webp && extension === 'webp' && upload.mimeType === 'image/webp'))) throw new EditorError('The uploaded file is not a supported image, or its extension does not match its contents.', 'INVALID_IMAGE');
}
export async function publishContent(session, data, uploads = [], message = 'Update website content') {
  const state = sessions.get(session);
  if (!state?.token) throw new EditorError('Connect to GitHub before submitting.', 'DISCONNECTED');
  if (state.busy) throw new EditorError('A submission is already in progress.');
  state.busy = true;
  try {
    if (!Array.isArray(uploads) || uploads.length > 30) throw new EditorError('Submit no more than 30 new images at a time.');
    const serialized = JSON.stringify(data, null, 2) + '\n';
    if (encoder.encode(serialized).length > MAX_CONTENT) throw new EditorError('Website content is too large (maximum 1 MB).');
    const available = new Set(state.assets);
    for (const upload of uploads) { checkUpload(upload); if (available.has(upload.path)) throw new EditorError('An upload image path already exists. Select the image again to use a new filename.'); available.add(upload.path); }
    const errors = validateContent(data, { knownAssets: available });
    if (errors.length) throw new EditorError(errors.join('\n'), 'VALIDATION');
    const used = new Set(imagePaths(data));
    const pending = uploads.filter(upload => used.has(upload.path));
    if (serialized === state.canonical && !pending.length) throw new EditorError('There are no content changes to submit.', 'NO_CHANGES');
    const current = await api(state, `/git/ref/heads/${branchPath(state.branch)}`);
    if (current.object?.sha !== state.commitSha) throw conflict();
    const entries = [{ path: 'data/site.json', mode: '100644', type: 'blob', content: serialized }];
    for (const upload of pending) {
      const blob = await api(state, '/git/blobs', 'POST', { content: base64(upload.bytes), encoding: 'base64' });
      entries.push({ path: upload.path, mode: '100644', type: 'blob', sha: sha(blob.sha) });
    }
    const tree = await api(state, '/git/trees', 'POST', { base_tree: state.treeSha, tree: entries });
    const commitMessage = (typeof message === 'string' ? message.trim() : '') || 'Update website content';
    const commit = await api(state, '/git/commits', 'POST', { message: commitMessage.slice(0,200), tree: sha(tree.sha), parents: [state.commitSha] });
    const newSha = sha(commit.sha);
    try {
      await api(state, `/git/refs/heads/${branchPath(state.branch)}`, 'PATCH', { sha: newSha, force: false });
    } catch (error) {
      // A lost response may still mean GitHub accepted the commit. Verify before reporting failure.
      let actual;
      try { actual = await api(state, `/git/ref/heads/${branchPath(state.branch)}`); } catch { throw new EditorError('Could not confirm the submission. Keep or download your draft and check GitHub commit history before trying again.', 'UNCERTAIN'); }
      if (actual.object?.sha !== newSha) {
        if (actual.object?.sha !== state.commitSha) {
          if (error.code === 'NETWORK') throw new EditorError('GitHub changed while the response was lost. Your change may already be committed. Keep or download your draft and check the commit history before retrying.', 'UNCERTAIN');
          throw conflict();
        }
        throw error;
      }
    }
    state.commitSha = newSha; state.treeSha = tree.sha; state.canonical = serialized;
    for (const upload of pending) state.assets.add(upload.path);
    const repositoryUrl = `https://github.com/${state.owner}/${state.repo}`;
    return { commitUrl: `${repositoryUrl}/commit/${newSha}`, repositoryUrl, actionsUrl: `${repositoryUrl}/actions` };
  } finally { state.busy = false; }
}
