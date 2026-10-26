import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  parseFrontmatter, withFrontmatter, loadSpecs, collectTestRefs, nextAcNumber,
} from '../lib/specs.js';

const root = mkdtempSync(join(tmpdir(), 'harness-specs-'));
after(() => rmSync(root, { recursive: true, force: true }));

function write(path, text) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
}

const SPEC = `---
id: 001
title: Reset password
status: draft
approved_by:
---
# Spec 001 — Reset password

## 7. Acceptance criteria

- **AC-1** — Given a user, when they ask for a reset, then an email is sent.
- **AC-2** — Given an expired link, when it is used, then it is rejected.

## 8. Open questions

- [ ] How long does a link live?
- [x] Do we support SMS? No.
- [ ]

## 9. Decisions made during review

- [ ] This checkbox is outside the open questions section.
`;

const TASKS = `# Tasks

- [x] **T1 — Send email** (AC-1)
- [ ] **T2 — Expire links** (AC-2)
`;

test('parseFrontmatter reads key/value pairs and returns the body', () => {
  const { data, body } = parseFrontmatter('---\nid: 001\ntitle: A: B\n---\n# Body\n');
  assert.deepEqual(data, { id: '001', title: 'A: B' });
  assert.equal(body, '# Body\n');
});

test('parseFrontmatter accepts CRLF line endings', () => {
  const { data } = parseFrontmatter('---\r\nid: 001\r\nstatus: idea\r\n---\r\nbody');
  assert.deepEqual(data, { id: '001', status: 'idea' });
});

test('parseFrontmatter returns null data when there is no frontmatter', () => {
  assert.deepEqual(parseFrontmatter('# Just a title'), { data: null, body: '# Just a title' });
});

test('withFrontmatter merges fields and keeps the body untouched', () => {
  const text = withFrontmatter('---\nid: 001\nstatus: idea\napproved_by:\n---\n# Body\n', {
    status: 'approved', approved_by: 'ana',
  });
  assert.equal(text, '---\nid: 001\nstatus: approved\napproved_by: ana\n---\n# Body\n');
});

test('loadSpecs parses criteria, open questions, tasks, and AC mentions', () => {
  const specsDir = join(root, 'load', 'specs');
  write(join(specsDir, '001-reset-password', 'spec.md'), SPEC);
  write(join(specsDir, '001-reset-password', 'tasks.md'), TASKS);

  const [spec] = loadSpecs({ specsDir });
  assert.equal(spec.id, '001');
  assert.equal(spec.title, 'Reset password');
  assert.equal(spec.status, 'draft');
  assert.equal(spec.approvedBy, null);
  assert.deepEqual(spec.acs, ['AC-1', 'AC-2']);
  assert.deepEqual(spec.openQuestions, ['- [ ] How long does a link live?']);
  assert.equal(spec.hasPlan, false);
  assert.deepEqual(spec.tasks, [{ id: 'T1', done: true }, { id: 'T2', done: false }]);
  assert.deepEqual([...spec.tasksAcMentions].sort(), ['AC-1', 'AC-2']);
});

test('loadSpecs only picks NNN-slug folders that contain a spec.md, sorted by id', () => {
  const specsDir = join(root, 'filter', 'specs');
  write(join(specsDir, '002-second', 'spec.md'), '---\nid: 002\n---\n');
  write(join(specsDir, '001-first', 'spec.md'), '---\nid: 001\n---\n');
  write(join(specsDir, '003-no-spec', 'notes.md'), 'nothing');
  write(join(specsDir, 'drafts', 'spec.md'), '---\nid: 999\n---\n');

  assert.deepEqual(loadSpecs({ specsDir }).map((s) => s.name), ['001-first', '002-second']);
});

test('loadSpecs returns an empty list when the specs folder does not exist', () => {
  assert.deepEqual(loadSpecs({ specsDir: join(root, 'missing') }), []);
});

test('collectTestRefs maps [AC-n] references to files, honoring extensions and ignored dirs', () => {
  const testsDir = join(root, 'refs', 'tests');
  const used = join(testsDir, 'auth', 'reset.test.js');
  write(used, "test('[AC-1] sends an email', () => {});\n// [AC-2] [AC-1]\n");
  write(join(testsDir, 'notes.md'), '[AC-3] not a test file');
  write(join(testsDir, 'node_modules', 'lib', 'x.test.js'), '[AC-4]');

  const refs = collectTestRefs({ tests: { dirs: [testsDir], extensions: ['.js'] } });
  assert.deepEqual([...refs.keys()].sort(), ['AC-1', 'AC-2']);
  assert.deepEqual([...refs.get('AC-1')], [used]);
});

test('nextAcNumber returns the highest criterion number plus one', () => {
  assert.equal(nextAcNumber([]), 1);
  assert.equal(nextAcNumber([{ acs: ['AC-2', 'AC-10'] }, { acs: ['AC-7'] }]), 11);
});
