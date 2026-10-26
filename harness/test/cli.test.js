import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../..', import.meta.url));

// The CLI resolves its root from its own location, so each test runs a copy
// of the harness inside an empty project.
let project;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'harness-cli-'));
  cpSync(join(REPO, 'harness', 'cli.js'), join(project, 'harness', 'cli.js'));
  cpSync(join(REPO, 'harness', 'lib'), join(project, 'harness', 'lib'), { recursive: true });
  cpSync(join(REPO, 'templates'), join(project, 'templates'), { recursive: true });
  writeFileSync(join(project, 'harness.config.json'), JSON.stringify({
    specsDir: 'specs',
    templatesDir: 'templates',
    progressDir: 'progress',
    tests: { dirs: ['tests'], extensions: ['.js'] },
    verify: [],
    requiredFiles: [],
  }));
});

afterEach(() => rmSync(project, { recursive: true, force: true }));

function harness(...args) {
  const result = spawnSync(process.execPath, [join(project, 'harness', 'cli.js'), ...args], { encoding: 'utf8' });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

const readSpec = () => readFileSync(join(project, 'specs', '001-reset-password', 'spec.md'), 'utf8');

test('new creates a numbered spec in idea status from the template', () => {
  const { code, output } = harness('new', 'Users reset their password by email', '--title', 'Reset password');
  assert.equal(code, 0, output);

  const spec = readSpec();
  assert.match(spec, /^---\nid: 001\ntitle: Reset password\nstatus: idea\n/);
  assert.match(spec, /> Users reset their password by email/);
});

test('move refuses to skip statuses', () => {
  harness('new', 'idea', '--title', 'Reset password');
  const { code, output } = harness('move', '001', 'approved', '--by', 'ana');
  assert.equal(code, 1);
  assert.match(output, /cannot jump from idea to approved/);
  assert.match(readSpec(), /status: idea/);
});

test('approving requires --by and passing the gate', () => {
  harness('new', 'idea', '--title', 'Reset password');
  assert.equal(harness('move', '001', 'draft').code, 0);

  const withoutBy = harness('move', '001', 'approved');
  assert.equal(withoutBy.code, 1);
  assert.match(withoutBy.output, /requires --by <name>/);

  const withoutAcs = harness('move', '001', 'approved', '--by', 'ana');
  assert.equal(withoutAcs.code, 1);
  assert.match(withoutAcs.output, /has no acceptance criteria/);
  assert.match(readSpec(), /status: draft/);

  writeFileSync(
    join(project, 'specs', '001-reset-password', 'spec.md'),
    readSpec().replace('- **AC-X** — Given ..., when ..., then ...', '- **AC-1** — Given a user, when they ask, then an email is sent.'),
  );
  const approved = harness('move', '001', 'approved', '--by', 'ana');
  assert.equal(approved.code, 0, approved.output);
  assert.match(readSpec(), /\nstatus: approved\n/);
  assert.match(readSpec(), /\napproved_by: ana\n/);
});

test('check fails when a test references a criterion that no spec defines', () => {
  assert.equal(harness('check').code, 0);

  mkdirSync(join(project, 'tests'));
  writeFileSync(join(project, 'tests', 'orphan.test.js'), "test('[AC-9] orphan', () => {});\n");
  const { code, output } = harness('check');
  assert.equal(code, 1);
  assert.match(output, /AC-9 is used in .* but does not exist in any spec/);
});
