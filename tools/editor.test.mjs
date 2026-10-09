import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { connectRepository, disconnectRepository, publishContent, loadPublicContent } from '../admin/github.mjs';
import { validateContent, imagePaths, mergeContent } from '../admin/content.mjs';

// This suite never uses a real GitHub token or network. The mock stores Git objects
// and advances a virtual branch so tests exercise the editor's complete workflow.
const source = JSON.parse(fs.readFileSync(new URL('./fixtures/editor-site.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const config = { owner: 'example-lab', repo: 'example-lab.github.io', branch: 'main', inferFromPagesUrl: false };
const TOKEN = 'synthetic-test-token-never-use-for-github';
const hash = value => createHash('sha1').update(String(value)).digest('hex');
const copy = value => structuredClone(value);
const canonical = value => JSON.stringify(value, null, 2) + '\n';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64'));
const photo = (suffix = '000001') => ({ path: `assets/images/editor-test-photo-${suffix}.png`, bytes: png.slice(), mimeType: 'image/png' });

function virtualRepository(options = {}) {
  const calls = [];
  const blobs = new Map();
  const trees = new Map();
  const commits = new Map();
  let counter = 0;
  const addBlob = bytes => { const value = Uint8Array.from(bytes); const id = hash(Buffer.from(value).toString('base64')); blobs.set(id, value); return id; };
  const contentSha = addBlob(new TextEncoder().encode(canonical(source)));
  const initialTree = new Map([
    ['data/site.json', { path: 'data/site.json', type: 'blob', mode: '100644', sha: contentSha }],
    ['README.md', { path: 'README.md', type: 'blob', mode: '100644', sha: addBlob(new TextEncoder().encode('Unrelated documentation must survive.')) }],
    ['.github/workflows/pages.yml', { path: '.github/workflows/pages.yml', type: 'blob', mode: '100644', sha: addBlob(new TextEncoder().encode('Untouched deployment workflow')) }],
    ...[...new Set(imagePaths(source))].map(path => [path, { path, type: 'blob', mode: '100644', sha: addBlob(png) }])
  ]);
  const initialTreeSha = hash('initial-tree');
  const initialHead = hash('initial-commit');
  trees.set(initialTreeSha, initialTree);
  commits.set(initialHead, { sha: initialHead, tree: { sha: initialTreeSha }, parents: [] });
  let head = initialHead;
  let patchCalled = false;
  const result = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  const prefix = `/repos/${config.owner}/${config.repo}`;
  const server = {
    calls, blobs, trees, commits, initialHead, initialTreeSha,
    get head() { return head; },
    get writeCalls() { return calls.filter(c => c.method !== 'GET'); },
    set patchMode(value) { options.patchMode = value; },
    advanceHead() {
      const id = hash(`another-editor-${++counter}`);
      commits.set(id, { sha: id, tree: commits.get(head).tree, parents: [head] });
      head = id;
      return id;
    },
    contentAtHead() {
      const tree = trees.get(commits.get(head).tree.sha);
      return JSON.parse(new TextDecoder().decode(blobs.get(tree.get('data/site.json').sha)));
    },
    async fetch(input, init = {}) {
      const url = new URL(String(input));
      if (url.protocol === 'file:' && url.pathname.endsWith('/admin/config.json')) return result(config);
      if (url.protocol === 'file:' && url.pathname.endsWith('/data/site.json')) return result(source);
      assert.equal(url.origin, 'https://api.github.com', 'No requests may be sent to another host.');
      assert.ok(url.pathname.startsWith(prefix), 'Only the configured repository may be requested.');
      const method = init.method || 'GET';
      const body = init.body ? JSON.parse(init.body) : undefined;
      calls.push({ url: url.href, method, body, headers: init.headers, credentials: init.credentials, redirect: init.redirect });
      assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
      assert.equal(init.headers['X-GitHub-Api-Version'], '2026-03-10');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'error');
      assert.ok(!url.href.includes(TOKEN), 'Tokens must never enter request URLs.');
      assert.ok(!(JSON.stringify(body) || '').includes(TOKEN), 'Tokens must never enter Git commit payloads.');
      const route = url.pathname.slice(prefix.length);
      if (method === 'GET' && route === '') {
        if (options.authStatus) return result({ message: 'Denied' }, options.authStatus);
        return result({ permissions: { push: options.canWrite ?? true }, archived: options.archived ?? false });
      }
      if (method === 'GET' && route === '/git/ref/heads/main') {
        if (patchCalled && options.refReadFailsAfterPatch) throw new TypeError('Simulated network interruption');
        return result({ ref: 'refs/heads/main', object: { type: 'commit', sha: head } });
      }
      if (method === 'GET' && route.startsWith('/git/commits/')) return result(commits.get(route.split('/').pop()));
      if (method === 'GET' && route.startsWith('/git/trees/')) {
        const id = route.split('/').pop();
        return result({ sha: id, tree: [...trees.get(id).values()], truncated: false });
      }
      if (method === 'GET' && route.startsWith('/git/blobs/')) {
        const id = route.split('/').pop();
        const bytes = blobs.get(id);
        return result({ sha: id, encoding: 'base64', size: bytes.length, content: Buffer.from(bytes).toString('base64') });
      }
      if (options.denyWrites && method !== 'GET') return result({ message: 'Read-only token' }, 403);
      if (method === 'POST' && route === '/git/blobs') {
        assert.equal(body.encoding, 'base64');
        return result({ sha: addBlob(Buffer.from(body.content, 'base64')) }, 201);
      }
      if (method === 'POST' && route === '/git/trees') {
        assert.ok(trees.has(body.base_tree), 'A tree must be based on an existing tree.');
        const next = new Map(trees.get(body.base_tree));
        for (const entry of body.tree) {
          assert.equal(entry.mode, '100644');
          assert.equal(entry.type, 'blob');
          assert.ok(entry.sha || typeof entry.content === 'string');
          assert.ok(!(entry.sha && entry.content), 'Use either blob SHA or content, never both.');
          const id = entry.sha || addBlob(new TextEncoder().encode(entry.content));
          next.set(entry.path, { path: entry.path, mode: entry.mode, type: entry.type, sha: id });
        }
        const id = hash(`new-tree-${++counter}`);
        trees.set(id, next);
        return result({ sha: id }, 201);
      }
      if (method === 'POST' && route === '/git/commits') {
        assert.ok(trees.has(body.tree));
        assert.equal(body.parents.length, 1);
        assert.ok(commits.has(body.parents[0]));
        const id = hash(`new-commit-${++counter}`);
        commits.set(id, { sha: id, tree: { sha: body.tree }, parents: body.parents });
        return result({ sha: id }, 201);
      }
      if (method === 'PATCH' && route === '/git/refs/heads/main') {
        patchCalled = true;
        assert.equal(body.force, false, 'The editor must never force push.');
        if (options.patchMode === 'conflict') { options.patchMode = ''; server.advanceHead(); }
        const commit = commits.get(body.sha);
        if (!commit.parents.includes(head)) return result({ message: 'Reference update is not a fast-forward.' }, 422);
        if (options.patchMode === 'reject') return result({ message: 'Protected branch rejected the update.' }, 403);
        if (options.patchMode === 'lose-unaccepted') throw new TypeError('Request did not reach GitHub');
        head = body.sha;
        if (options.patchMode === 'lose-accepted-then-updated') { options.patchMode = ''; server.advanceHead(); throw new TypeError('Accepted, response lost, then another editor committed'); }
        if (options.patchMode === 'lose-accepted') { options.patchMode = ''; throw new TypeError('Accepted, but response was lost'); }
        return result({ object: { type: 'commit', sha: head } });
      }
      assert.fail(`Unexpected mock endpoint: ${method} ${route}`);
    }
  };
  return server;
}

async function withRepository(options, run) {
  const original = globalThis.fetch;
  const server = virtualRepository(options);
  globalThis.fetch = server.fetch;
  try { return await run(server); } finally { globalThis.fetch = original; }
}
const codeIs = code => error => { assert.equal(error.code, code); return true; };
const change = data => { const draft = copy(data); draft.home.heading = 'Robotics Research — Updated Ω'; return draft; };

await test('Website editor complete GitHub workflow (all requests mocked)', async t => {
  await t.test('public content loads without asking GitHub for credentials', async () => withRepository({}, async server => {
    assert.deepEqual(await loadPublicContent(), source);
    assert.equal(server.calls.length, 0);
  }));

  await t.test('publishes JSON and a referenced photo atomically while preserving unrelated files', async () => withRepository({}, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const sessionJSON = JSON.stringify(session);
    assert.ok(!sessionJSON.includes(TOKEN));
    assert.ok(!Object.keys(session).includes('token'));
    const draft = change(data);
    const upload = photo();
    const unused = photo('000002');
    draft.site.image = upload.path;
    const outcome = await publishContent(session, draft, [upload, unused], 'Update home and portrait');
    assert.equal(session.commitSha, server.head);
    assert.equal(outcome.commitUrl, `https://github.com/${config.owner}/${config.repo}/commit/${server.head}`);
    assert.deepEqual(server.contentAtHead(), draft);
    const writes = server.writeCalls;
    assert.deepEqual(writes.map(c => c.method), ['POST', 'POST', 'POST', 'PATCH']);
    const treeCalls = writes.filter(c => c.url.endsWith('/git/trees'));
    assert.equal(treeCalls.length, 1);
    assert.equal(treeCalls[0].body.base_tree, server.initialTreeSha);
    assert.deepEqual(treeCalls[0].body.tree.map(e => e.path).sort(), ['data/site.json', upload.path].sort());
    const visibleTree = server.trees.get(server.commits.get(server.head).tree.sha);
    const beforeTree = server.trees.get(server.initialTreeSha);
    for (const path of ['README.md', '.github/workflows/pages.yml']) assert.deepEqual(visibleTree.get(path), beforeTree.get(path));
    assert.ok(!visibleTree.has(unused.path));
    assert.deepEqual(server.blobs.get(visibleTree.get(upload.path).sha), png);
    const commit = writes.find(c => c.url.endsWith('/git/commits')).body;
    assert.deepEqual(commit.parents, [server.initialHead]);
    assert.equal(commit.message, 'Update home and portrait');
    assert.ok(!JSON.stringify(writes.map(c => c.body)).includes(TOKEN));
    disconnectRepository(session);
  }));

  await t.test('second submission uses the previous successful commit and tree as its baseline', async () => withRepository({}, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const first = change(data);
    await publishContent(session, first);
    const firstHead = server.head;
    const firstTree = server.commits.get(firstHead).tree.sha;
    const second = copy(first);
    second.contact.intro = 'Please contact our group for collaborations.';
    await publishContent(session, second);
    const treeCalls = server.writeCalls.filter(c => c.url.endsWith('/git/trees'));
    const commits = server.writeCalls.filter(c => c.url.endsWith('/git/commits'));
    assert.equal(treeCalls[1].body.base_tree, firstTree);
    assert.deepEqual(commits[1].body.parents, [firstHead]);
    assert.deepEqual(server.contentAtHead(), second);
    assert.equal(session.commitSha, server.head);
    disconnectRepository(session);
  }));

  await t.test('concurrent changes detected before any write keep the draft and original baseline', async () => withRepository({}, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const draft = change(data);
    const expectedDraft = copy(draft);
    const baseline = session.commitSha;
    server.advanceHead();
    await assert.rejects(publishContent(session, draft, [photo()]), codeIs('CONFLICT'));
    assert.equal(server.writeCalls.length, 0);
    assert.equal(session.commitSha, baseline);
    assert.deepEqual(draft, expectedDraft);
    disconnectRepository(session);
  }));

  await t.test('a branch race during saving cannot overwrite the other editor or update the baseline', async () => withRepository({ patchMode: 'conflict' }, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const draft = change(data);
    const baseline = session.commitSha;
    await assert.rejects(publishContent(session, draft), codeIs('CONFLICT'));
    assert.notEqual(server.head, baseline);
    assert.equal(session.commitSha, baseline);
    assert.deepEqual(server.contentAtHead(), data);
    const attemptedCommit = server.writeCalls.find(c => c.url.endsWith('/git/commits')).body;
    assert.deepEqual(attemptedCommit.parents, [baseline]);
    const writeCount = server.writeCalls.length;
    await assert.rejects(publishContent(session, draft), codeIs('CONFLICT'));
    assert.equal(server.writeCalls.length, writeCount, 'Retrying the stale draft must not write another commit.');
    disconnectRepository(session);
  }));

  await t.test('accepted PATCH with a lost response is verified as success without duplicate commits', async () => withRepository({ patchMode: 'lose-accepted' }, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const draft = change(data);
    const outcome = await publishContent(session, draft);
    assert.equal(session.commitSha, server.head);
    assert.ok(outcome.commitUrl.endsWith(server.head));
    assert.deepEqual(server.contentAtHead(), draft);
    assert.equal(server.writeCalls.filter(c => c.method === 'PATCH').length, 1);
    assert.equal(server.writeCalls.filter(c => c.url.endsWith('/git/commits')).length, 1);
    await assert.rejects(publishContent(session, draft), codeIs('NO_CHANGES'));
    disconnectRepository(session);
  }));

  await t.test('unconfirmed reference update retains the old baseline and draft', async () => withRepository({ patchMode: 'lose-unaccepted', refReadFailsAfterPatch: true }, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const draft = change(data);
    const baseline = session.commitSha;
    await assert.rejects(publishContent(session, draft), codeIs('UNCERTAIN'));
    assert.equal(session.commitSha, baseline);
    assert.equal(server.head, baseline);
    assert.equal(draft.home.heading, 'Robotics Research — Updated Ω');
    disconnectRepository(session);
  }));

  for (const status of [401, 403]) await t.test(`authentication HTTP ${status} rejects connection without writes`, async () => withRepository({ authStatus: status }, async server => {
    await assert.rejects(connectRepository(TOKEN), codeIs(`HTTP_${status}`));
    assert.equal(server.writeCalls.length, 0);
  }));

  await t.test('an account without repository Write permission is refused before loading content', async () => withRepository({ canWrite: false }, async server => {
    await assert.rejects(connectRepository(TOKEN), codeIs('NO_WRITE_ACCESS'));
    assert.equal(server.calls.length, 1);
    assert.equal(server.writeCalls.length, 0);
  }));

  await t.test('a token lacking Contents write permission does not report success or move the baseline', async () => withRepository({ denyWrites: true }, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const baseline = session.commitSha;
    await assert.rejects(publishContent(session, change(data)), codeIs('HTTP_403'));
    assert.equal(session.commitSha, baseline);
    assert.equal(server.head, baseline);
    assert.equal(server.writeCalls.length, 1);
    assert.ok(server.writeCalls[0].url.endsWith('/git/trees'));
    disconnectRepository(session);
  }));

  await t.test('a protected branch rejection cannot be mistaken for successful publishing', async () => withRepository({ patchMode: 'reject' }, async server => {
    const { data, session } = await connectRepository(TOKEN);
    await assert.rejects(publishContent(session, change(data)), codeIs('HTTP_403'));
    assert.equal(session.commitSha, server.initialHead);
    assert.equal(server.head, server.initialHead);
    disconnectRepository(session);
  }));

  await t.test('a copied or fabricated session object has no authority and makes no requests', async () => withRepository({}, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const callCount = server.calls.length;
    await assert.rejects(publishContent({ ...session }, change(data)), codeIs('DISCONNECTED'));
    assert.equal(server.calls.length, callCount);
    disconnectRepository(session);
    await assert.rejects(publishContent(session, change(data)), codeIs('DISCONNECTED'));
    assert.equal(server.calls.length, callCount);
  }));

  const invalidCases = [
    ['impossible news date', draft => { draft.news[0].date = '2026.02.30'; }, [], 'VALIDATION'],
    ['unsafe image path', draft => { draft.site.image = 'assets/images/../../admin/config.json'; }, [], 'VALIDATION'],
    ['missing image', draft => { draft.site.image = 'assets/images/nonexistent.png'; }, [], 'VALIDATION'],
    ['JavaScript link', draft => { draft.site.links[0].url = 'javascript:alert(document.cookie)'; }, [], 'VALIDATION'],
    ['duplicate paper IDs', draft => { draft.publications[1].id = draft.publications[0].id; }, [], 'VALIDATION'],
    ['malformed top-level content', () => null, [], 'VALIDATION'],
    ['upload outside image directory', () => {}, [{ ...photo(), path: 'admin/overwrite.png' }], 'INVALID_IMAGE'],
    ['upload traversal', () => {}, [{ ...photo(), path: 'assets/images/editor-../../evil.png' }], 'INVALID_IMAGE'],
    ['SVG disguised as PNG', () => {}, [{ ...photo(), bytes: new TextEncoder().encode('<svg onload="alert(1)"></svg>') }], 'INVALID_IMAGE']
  ];
  for (const [label, mutate, uploads, code] of invalidCases) await t.test(`${label} is rejected before any GitHub request`, async () => withRepository({}, async server => {
    const { data, session } = await connectRepository(TOKEN);
    let draft = change(data);
    const replaced = mutate(draft);
    if (replaced === null) draft = null;
    const count = server.calls.length;
    await assert.rejects(publishContent(session, draft, uploads), codeIs(code));
    assert.equal(server.calls.length, count);
    assert.equal(server.writeCalls.length, 0);
    assert.equal(session.commitSha, server.initialHead);
    disconnectRepository(session);
  }));

  await t.test('unchanged content cannot trigger a deployment', async () => withRepository({}, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const count = server.calls.length;
    await assert.rejects(publishContent(session, data), codeIs('NO_CHANGES'));
    assert.equal(server.calls.length, count);
    assert.equal(server.writeCalls.length, 0);
    disconnectRepository(session);
  }));

  await t.test('the fixture is valid and invalid content reports specific validation errors', () => {
    assert.deepEqual(validateContent(source, { knownAssets: new Set(imagePaths(source)) }), []);
    const draft = copy(source);
    draft.site.updated = '2026-02-30';
    draft.publications[1].id = draft.publications[0].id;
    assert.match(validateContent(draft).join('\n'), /valid YYYY-MM-DD/);
    assert.match(validateContent(draft).join('\n'), /unique lowercase ID/);
  });
});

await test('Draft reconnect and three-way content merge', async t => {
  const normalize = value => JSON.parse(JSON.stringify(value));
  const inputsRemain = (before, ...after) => after.forEach((value, i) => assert.deepEqual(value, before[i], 'Merging must not mutate any original draft or source.'));

  await t.test('an unchanged draft preserves unknown fields newly added by another editor', () => {
    const baseline = copy(source);
    const draft = copy(baseline);
    const remote = copy(baseline);
    remote.site.newMetadata = { editor: 'Another member', note: 'Added through the repository' };
    const before = [copy(baseline), copy(draft), copy(remote)];
    const merged = mergeContent(baseline, draft, remote);
    assert.deepEqual(merged.conflicts, []);
    assert.deepEqual(normalize(merged.data), remote);
    merged.data.site.newMetadata.note = 'Changed after merge';
    inputsRemain(before, baseline, draft, remote);
  });

  await t.test('different edited fields merge while preserving both editors and untouched content', () => {
    const baseline = copy(source);
    const draft = copy(baseline);
    const remote = copy(baseline);
    draft.home.heading = 'Local robotics heading';
    remote.contact.intro = 'Remote collaboration contact';
    const expected = copy(remote);
    expected.home.heading = draft.home.heading;
    const before = [copy(baseline), copy(draft), copy(remote)];
    const merged = mergeContent(baseline, draft, remote);
    assert.deepEqual(merged.conflicts, []);
    assert.deepEqual(normalize(merged.data), expected);
    inputsRemain(before, baseline, draft, remote);
  });

  await t.test('the same edit made independently is accepted without a conflict', () => {
    const baseline = copy(source);
    const draft = copy(baseline);
    const remote = copy(baseline);
    draft.home.heading = remote.home.heading = 'The same agreed group heading';
    const merged = mergeContent(baseline, draft, remote);
    assert.deepEqual(merged.conflicts, []);
    assert.deepEqual(normalize(merged.data), remote);
  });

  await t.test('different edits to the same field identify that field and preserve the original draft', () => {
    const baseline = copy(source);
    const draft = copy(baseline);
    const remote = copy(baseline);
    draft.home.heading = 'My draft heading';
    remote.home.heading = 'Another editor heading';
    const before = [copy(baseline), copy(draft), copy(remote)];
    const merged = mergeContent(baseline, draft, remote);
    assert.deepEqual(merged.conflicts, ['home.heading']);
    assert.equal(merged.data.home.heading, remote.home.heading);
    inputsRemain(before, baseline, draft, remote);
  });

  await t.test('lists edited by both people report a conflict instead of guessing a combined order', () => {
    const baseline = copy(source);
    const draft = copy(baseline);
    const remote = copy(baseline);
    draft.news[0].text = 'Local changes to the first news item';
    remote.news[1].text = 'Remote changes to the second news item';
    const before = [copy(baseline), copy(draft), copy(remote)];
    const merged = mergeContent(baseline, draft, remote);
    assert.deepEqual(merged.conflicts, ['news']);
    assert.deepEqual(normalize(merged.data.news), remote.news);
    inputsRemain(before, baseline, draft, remote);
  });

  await t.test('a local field deletion and an unrelated remote field addition are both preserved', () => {
    const baseline = copy(source);
    baseline.site.legacyMetadata = 'No longer needed';
    const draft = copy(baseline);
    delete draft.site.legacyMetadata;
    const remote = copy(baseline);
    remote.site.newMetadata = 'A new remote field';
    const expected = copy(remote);
    delete expected.site.legacyMetadata;
    const merged = mergeContent(baseline, draft, remote);
    assert.deepEqual(merged.conflicts, []);
    assert.ok(!Object.hasOwn(merged.data.site, 'legacyMetadata'));
    assert.equal(merged.data.site.newMetadata, 'A new remote field');
    assert.deepEqual(normalize(merged.data), expected);
  });

  await t.test('a lost response followed by another commit reports uncertainty rather than failure or success', async () => withRepository({ patchMode: 'lose-accepted-then-updated' }, async server => {
    const { data, session } = await connectRepository(TOKEN);
    const draft = change(data);
    const baseline = session.commitSha;
    let returnedOutcome;
    await assert.rejects(async () => { returnedOutcome = await publishContent(session, draft); }, error => {
      assert.equal(error.code, 'UNCERTAIN');
      assert.match(error.message, /may already be committed/i);
      return true;
    });
    assert.equal(returnedOutcome, undefined, 'The editor must not report confirmed publishing.');
    assert.equal(session.commitSha, baseline, 'An unconfirmed result cannot replace the known baseline.');
    assert.notEqual(server.head, baseline);
    assert.deepEqual(server.contentAtHead(), draft, 'The mock accepted the draft before the other editor committed.');
    assert.equal(server.writeCalls.filter(c => c.method === 'PATCH').length, 1);
    assert.equal(server.writeCalls.filter(c => c.url.endsWith('/git/commits')).length, 1);
    disconnectRepository(session);
  }));
});
