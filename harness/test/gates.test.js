import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { gateProblems, canTransition, nextAction, reviewPath } from '../lib/gates.js';

const progressDir = mkdtempSync(join(tmpdir(), 'harness-gates-'));
after(() => rmSync(progressDir, { recursive: true, force: true }));

// A spec that satisfies every gate up to `done`, except the review file.
function makeSpec(overrides = {}) {
  return {
    id: '001',
    title: 'Reset password',
    status: 'draft',
    frontmatter: { id: '001' },
    approvedBy: 'ana',
    acs: ['AC-1', 'AC-2'],
    openQuestions: [],
    hasPlan: true,
    tasks: [{ id: 'T1', done: true }],
    tasksAcMentions: new Set(['AC-1', 'AC-2']),
    ...overrides,
  };
}

function ctx(overrides = {}) {
  return { specs: [], testRefs: new Map([['AC-1', new Set()], ['AC-2', new Set()]]), progressDir, ...overrides };
}

const problemsFor = (target, specOverrides, ctxOverrides) => gateProblems(makeSpec(specOverrides), target, ctx(ctxOverrides));

test('a spec without frontmatter fails every gate', () => {
  assert.deepEqual(problemsFor('draft', { frontmatter: null }), ['spec.md has no frontmatter (--- id/title/status ---)']);
});

test('blocked is always allowed and an unknown status is rejected', () => {
  assert.deepEqual(problemsFor('blocked', { acs: [], approvedBy: null }), []);
  assert.deepEqual(problemsFor('shipped'), ['unknown status "shipped"']);
});

test('idea and draft have no gate', () => {
  assert.deepEqual(problemsFor('draft', { acs: [], approvedBy: null, hasPlan: false }), []);
});

test('approved requires criteria, no open questions, and a human approver', () => {
  const problems = problemsFor('approved', { acs: [], openQuestions: ['- [ ] TTL?'], approvedBy: null });
  assert.equal(problems.length, 3);
  assert.match(problems[0], /no acceptance criteria/);
  assert.match(problems[1], /1 unresolved open question/);
  assert.match(problems[2], /missing approved_by/);
  assert.deepEqual(problemsFor('approved'), []);
});

test('planned requires a plan, tasks, and a task for every criterion', () => {
  assert.deepEqual(problemsFor('planned', { hasPlan: false, tasks: [], tasksAcMentions: new Set(['AC-1']) }), [
    'missing plan.md (`harness plan <id>` creates it from the template)',
    'tasks.md is missing or has no tasks (- [ ] **T1 — ...**)',
    'criteria with no task in tasks.md: AC-2',
  ]);
});

test('planned also enforces the approved gate', () => {
  assert.match(problemsFor('planned', { approvedBy: null }).join('\n'), /missing approved_by/);
});

test('only one spec can be in_progress at a time', () => {
  const other = makeSpec({ id: '002', status: 'in_progress' });
  assert.deepEqual(problemsFor('in_progress', {}, { specs: [other] }), [
    'only one spec can be in_progress and 002 already is',
  ]);
  assert.deepEqual(problemsFor('in_progress', {}, { specs: [makeSpec({ status: 'in_progress' })] }), []);
});

test('review requires finished tasks and a test for every criterion', () => {
  const problems = problemsFor(
    'review',
    { tasks: [{ id: 'T1', done: true }, { id: 'T2', done: false }] },
    { testRefs: new Map([['AC-1', new Set()]]) },
  );
  assert.deepEqual(problems, [
    'unfinished tasks: T2',
    'criteria with no tests ([AC-n] in the test name): AC-2',
  ]);
});

test('done requires a review file with an APPROVED verdict', () => {
  const spec = makeSpec();
  const path = reviewPath(progressDir, spec);
  assert.match(problemsFor('done').join('\n'), /missing approved review/);

  writeFileSync(path, '# Review\n\n**Verdict:** CHANGES REQUESTED\n');
  assert.match(problemsFor('done').join('\n'), /missing approved review/);

  writeFileSync(path, '# Review\n\n**Verdict:** APPROVED\n');
  assert.deepEqual(problemsFor('done'), []);
});

test('canTransition allows one step forward, any step back, and blocked in both directions', () => {
  assert.equal(canTransition('idea', 'draft'), true);
  assert.equal(canTransition('idea', 'approved'), false);
  assert.equal(canTransition('review', 'draft'), true);
  assert.equal(canTransition('planned', 'blocked'), true);
  assert.equal(canTransition('blocked', 'review'), true);
});

test('nextAction points to the role that owns the current status', () => {
  assert.match(nextAction(makeSpec({ status: 'idea' }), progressDir), /^spec-writer/);
  assert.match(nextAction(makeSpec({ status: 'draft', openQuestions: ['- [ ] a'] }), progressDir), /answer 1 open question/);
  assert.match(nextAction(makeSpec({ status: 'draft' }), progressDir), /approve/);
  assert.equal(
    nextAction(makeSpec({ status: 'in_progress', tasks: [{ id: 'T1', done: true }, { id: 'T2', done: false }] }), progressDir),
    'implementer: task T2',
  );
  assert.match(nextAction(makeSpec({ status: 'in_progress' }), progressDir), /all done/);
  assert.equal(nextAction(makeSpec({ status: 'nonsense' }), progressDir), 'fix the status in the frontmatter');
});
