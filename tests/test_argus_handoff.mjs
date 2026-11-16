import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const workflow = JSON.parse(await readFile(new URL('../workflows/n8n/argus-verification-handoff.json', import.meta.url), 'utf8'));
const code = workflow.nodes.find(node => node.type === 'n8n-nodes-base.code').parameters.jsCode;
const repository = '2strongtrainers-art/Nicholas-AI-OS';
const path = '.github/workflows/deploy-argus-private-forensics.yml';
const run = { id: 12345, run_attempt: 2, workflow_id: 418878767, path, head_branch: 'main',
  head_sha: 'a'.repeat(40), event: 'workflow_dispatch', status: 'completed', conclusion: 'success',
  repository: { full_name: repository }, head_repository: { full_name: repository },
  created_at: '2026-11-15T18:00:00Z', updated_at: '2026-11-15T18:01:00Z' };
const artifact = { id: 456, name: 'argus-verification-12345-2', expired: false, digest: 'sha256:' + 'b'.repeat(64),
  workflow_run: { id: run.id, head_sha: run.head_sha, head_branch: run.head_branch } };
const receipt = {
  schema: 'argus-verification-receipt-v1', service: 'argus-prime-forensics', scope: 'synthetic_only',
  status: 'ARGUS_SYNTHETIC_PASS', failure_code: null, observed_at: '2026-11-15T18:00:30+00:00',
  github: { repository, workflow_path: path, run_id: String(run.id), run_attempt: run.run_attempt,
    head_sha: run.head_sha, ref: 'refs/heads/main', event: run.event,
    run_url: 'https://github.com/' + repository + '/actions/runs/12345/attempts/2' },
  evidence: { fixture_id: 'argus-synthetic-png-v1', source_bytes: 69,
    source_sha256: '5731a25f0c25c4e8b515f273b778da29ec74369400f93551a68507d5dacf77c3',
    unauthenticated_http: 401, authenticated_http: 200,
    exiftool: { FileType: 'PNG', MIMEType: 'image/png', ImageWidth: 1, ImageHeight: 1 },
    sensitive_metadata_included: false },
};
const packet = { artifact_id: artifact.id, archive_sha256: 'b'.repeat(64), receipt };
const clone = value => JSON.parse(JSON.stringify(value));
function evaluate({ runs = [run], artifacts = [artifact], reviewed = null, execution = '987' } = {}) {
  const context = {
    $input: { first: () => ({ json: { artifacts } }) },
    $: name => ({ first: () => ({ json: name === 'Read ARGUS workflow runs' ? { workflow_runs: runs } : { reviewed_artifact: reviewed } }) }),
    $execution: { id: execution },
  };
  return clone(runInNewContext(`(() => { ${code} })()`, context, { timeout: 1000 })[0].json);
}

test('workflow has only manual trigger, bounded public reads, no secrets or writes', () => {
  assert.equal(workflow.active, false);
  assert.deepEqual(workflow.pinData, {});
  assert.equal(workflow.settings.saveManualExecutions, true);
  assert.equal(workflow.settings.saveDataSuccessExecution, 'all');
  assert.equal(workflow.settings.saveDataErrorExecution, 'all');
  const types = new Set(['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.set', 'n8n-nodes-base.httpRequest', 'n8n-nodes-base.code']);
  for (const node of workflow.nodes) {
    assert.ok(types.has(node.type));
    assert.equal(node.credentials, undefined);
    assert.equal(node.webhookId, undefined);
    if (node.type === 'n8n-nodes-base.httpRequest') {
      assert.equal(node.parameters.method, 'GET');
      assert.ok(node.parameters.url.startsWith('https://api.github.com/repos/' + repository + '/actions/'));
      assert.equal(node.parameters.options.timeout, 20000);
      assert.ok(!JSON.stringify(node).includes('Authorization'));
    }
  }
});

test('green workflow without reviewed artifact remains unverified', () => {
  const result = evaluate();
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.reason, 'sanitized_receipt_not_reviewed');
  assert.equal(result.verification, null);
  assert.equal(result.n8n_execution_id, '987');
  assert.match(result.chief_delivery, /acknowledgment_not_observed/);
});

test('failed public run yields an honest blocker without invented cause', () => {
  const result = evaluate({ runs: [{ ...run, conclusion: 'failure' }] });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'run_not_successful');
  assert.equal(result.verification, null);
  assert.equal(result.chief_snapshot.items[0].url, receipt.github.run_url);
  assert.equal(result.chief_snapshot.items[0].source, 'github');
});

test('reviewed blocked artifact preserves actual blocker and exact attempt', () => {
  const reviewed = clone(packet);
  Object.assign(reviewed.receipt, { status: 'ARGUS_VERIFICATION_BLOCKED', failure_code: 'worker_not_configured', evidence: null });
  const result = evaluate({ runs: [{ ...run, conclusion: 'failure' }], reviewed });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.reason, 'worker_not_configured');
  assert.equal(result.verification.evidence, null);
  assert.equal(result.receipt_key, 'argus-12345-2');
  assert.equal(result.reviewed_artifact.artifact_id, artifact.id);
});

test('matching reviewed artifact verifies only the synthetic check', () => {
  const result = evaluate({ reviewed: packet });
  assert.equal(result.status, 'VERIFIED_SYNTHETIC');
  assert.deepEqual(result.verification.evidence, receipt.evidence);
  assert.equal(result.run.head_sha, run.head_sha);
  assert.match(result.chief_delivery, /prepared/);
  assert.equal(result.chief_snapshot.run_id, 'argus-12345-2-987');
});

test('forged archive, commit, attempt, fixture, sensitive flag, and extra fields are rejected without reflection', () => {
  for (const change of [
    p => { p.archive_sha256 = 'c'.repeat(64); },
    p => { p.receipt.github.head_sha = 'c'.repeat(40); },
    p => { p.receipt.github.run_attempt = 1; },
    p => { p.receipt.evidence.source_sha256 = 'c'.repeat(64); },
    p => { p.receipt.evidence.sensitive_metadata_included = true; },
    p => { p.receipt.private_test_field = 'synthetic-sensitive-marker'; },
    p => { p.receipt.github.run_url = 'https://example.invalid/synthetic-sensitive-marker'; },
    p => { p.receipt.failure_code = 'synthetic-sensitive-marker'; },
  ]) {
    const reviewed = clone(packet); change(reviewed);
    const result = evaluate({ reviewed });
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.verification, null);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-sensitive-marker/);
  }
});

test('expired artifact and success/failure contradiction cannot pass', () => {
  assert.equal(evaluate({ reviewed: packet, artifacts: [{ ...artifact, expired: true }] }).reason, 'matching_artifact_unavailable');
  assert.equal(evaluate({ reviewed: packet, runs: [{ ...run, conclusion: 'failure' }] }).reason, 'run_receipt_conflict');
  const reviewed = clone(packet);
  Object.assign(reviewed.receipt, { status: 'ARGUS_VERIFICATION_FAILED', failure_code: 'synthetic_integrity_failed', evidence: null });
  assert.equal(evaluate({ reviewed }).reason, 'run_receipt_conflict');
});

test('new pending run prevents reusing an older success receipt', () => {
  const pending = { ...run, id: 12346, run_attempt: 1, created_at: '2026-11-15T18:02:00Z',
    updated_at: '2026-11-15T18:02:01Z', status: 'in_progress', conclusion: null };
  const result = evaluate({ runs: [run, pending], reviewed: packet });
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.reason, 'run_not_completed');
  assert.equal(result.run.run_id, '12346');
});

test('wrong repositories and missing source become blocked; retries reuse receipt key', () => {
  const invalid = { ...run, head_repository: { full_name: 'unrelated/repo' }, private_test_field: 'synthetic-sensitive-marker' };
  const result = evaluate({ runs: [invalid], reviewed: packet });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.run, null);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-sensitive-marker/);
  assert.equal(evaluate({ runs: null }).status, 'BLOCKED');
  assert.equal(evaluate({ reviewed: packet, execution: '1' }).receipt_key, evaluate({ reviewed: packet, execution: '2' }).receipt_key);
});

test('actual Chief engine accepts and replays the normalized blocked handoff', async () => {
  const reviewed = clone(packet);
  Object.assign(reviewed.receipt, { status: 'ARGUS_VERIFICATION_BLOCKED', failure_code: 'worker_not_configured', evidence: null });
  const result = evaluate({ runs: [{ ...run, conclusion: 'failure' }], reviewed });
  const directory = await mkdtemp(join(tmpdir(), 'argus-chief-test-'));
  try {
    const snapshot = join(directory, 'snapshot.json');
    const state = join(directory, 'chief.sqlite');
    await writeFile(snapshot, JSON.stringify(result.chief_snapshot));
    const args = ['-m', 'chief_of_staff.brief', snapshot, '--state', state];
    const options = { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' };
    const first = execFileSync('python3', args, options);
    const second = execFileSync('python3', args, options);
    assert.equal(first, second);
    const brief = JSON.parse(first);
    assert.equal(brief.priorities.length, 1);
    assert.equal(brief.priorities[0].url, receipt.github.run_url);
    assert.match(brief.priorities[0].title, /BLOCKED: worker_not_configured/);
    assert.equal(brief.run_id, result.chief_snapshot.run_id);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
