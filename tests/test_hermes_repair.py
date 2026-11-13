import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

worker = module('hermes_worker', 'scripts/hermes_switchboard_worker.py')
resolver = module('hermes_kv', 'scripts/resolve_hermes_kv.py')
with patch.dict(sys.modules, {'hermes_switchboard_worker': worker}):
    doctor = module('hermes_doctor', 'scripts/hermes_doctor.py')

class HermesRepairTests(unittest.TestCase):
    def test_unsupported_profiles_never_start_hermes_or_read_credentials(self):
        with patch.object(worker, 'hermes_bin') as binary, patch.object(worker, 'hermes_environment') as env:
            for profile in ['maintenance', 'unknown']:
                with self.assertRaisesRegex(RuntimeError, 'isolated runner'):
                    worker.execute({'id':'test', 'task':'make a repair', 'profile':profile})
            binary.assert_not_called()
            env.assert_not_called()

    def test_readonly_command_has_explicit_search_toolset(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(worker, 'HOME', Path(tmp)), \
             patch.object(worker, 'hermes_bin', return_value='/test/hermes'), \
             patch.object(worker, 'hermes_environment', return_value={}), \
             patch.object(worker.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, 'ok', '')) as run:
            self.assertEqual(worker.execute({'id':'test', 'task':'public research'}), 'ok')
            command = run.call_args.args[0]
            self.assertEqual(command[command.index('--toolsets') + 1], 'search')
            self.assertEqual(run.call_args.kwargs['cwd'], str(worker.ROOT))

    def test_namespace_is_preserved_and_other_bindings_survive(self):
        config = {'name':'nicholas-ai-switchboard', 'kv_namespaces':[{'binding':'OTHER','id':'b'*32}]}
        resolved = resolver.resolve(config, [{'title':'nicholas-ai-switchboard-HERMES_JOBS','id':'a'*32}])
        self.assertEqual(resolved['kv_namespaces'], [{'binding':'OTHER','id':'b'*32},{'binding':'HERMES_JOBS','id':'a'*32}])
        self.assertEqual(len(config['kv_namespaces']), 1)

    def test_missing_namespace_is_distinct_from_ambiguous_or_invalid(self):
        config = {'name':'nicholas-ai-switchboard'}
        with self.assertRaises(LookupError): resolver.resolve(config, [])
        for rows in [None, [{'title':'HERMES_JOBS','id':'placeholder'}],
                     [{'title':'HERMES_JOBS','id':'a'*32},{'title':'nicholas-ai-switchboard-HERMES_JOBS','id':'b'*32}]]:
            with self.assertRaises(ValueError): resolver.resolve(config, rows)

    def test_similar_unrelated_namespace_is_not_selected(self):
        with self.assertRaises(LookupError):
            resolver.resolve({'name':'nicholas-ai-switchboard'}, [{'title':'OTHER-HERMES_JOBS','id':'a'*32}])

    def test_worker_uses_explicit_checkout_and_config_on_recovery_hosts(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {
            'NICHOLAS_AI_OS_ROOT': tmp + '/checkout',
            'NICHOLAS_HERMES_CONFIG_DIR': tmp + '/private-config',
        }):
            portable = module('portable_hermes_worker', 'scripts/hermes_switchboard_worker.py')
            self.assertEqual(portable.ROOT, Path(tmp) / 'checkout')
            self.assertEqual(portable.WORKER_KEY_FILE, Path(tmp) / 'private-config/hermes-worker.key')

    def test_executable_from_virtual_environment_path_is_found(self):
        with patch.object(worker.shutil, 'which', return_value='/venv/bin/hermes'):
            self.assertEqual(worker.hermes_bin(), '/venv/bin/hermes')

    def test_non_executable_legacy_path_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(worker, 'HOME', Path(tmp)), \
             patch.object(worker.shutil, 'which', return_value=None):
            candidate = Path(tmp) / '.local/bin/hermes'
            candidate.parent.mkdir(parents=True)
            candidate.write_text('not executable')
            with patch.object(worker.os, 'access', return_value=False):
                with self.assertRaisesRegex(RuntimeError, 'not found'):
                    worker.hermes_bin()

    def test_broken_host_does_not_claim_jobs(self):
        with patch.object(worker, 'acquire_lock', return_value=True), \
             patch.object(worker, 'switchboard_url', return_value='https://test.example'), \
             patch.object(worker, 'worker_key', return_value='secret'), \
             patch.object(worker, 'preflight', side_effect=RuntimeError('host not ready')), \
             patch.object(worker, 'request_json') as request, \
             patch.object(worker, 'log'), patch.object(worker, 'LOCK'):
            self.assertEqual(worker.main(), 1)
            request.assert_not_called()

    def test_ambiguous_post_is_not_retried_and_cannot_claim_another_job(self):
        with patch.object(worker.HTTP, 'open', side_effect=TimeoutError('lost response')) as fetch, \
             patch.object(worker.time, 'sleep') as sleep:
            with self.assertRaises(RuntimeError):
                worker.request_json('https://test.example/hermes/internal/claim', 'test', {})
            self.assertEqual(fetch.call_count, 1)
            sleep.assert_not_called()

    def test_transient_get_failure_can_retry_without_mutations(self):
        with patch.object(worker.HTTP, 'open', side_effect=TimeoutError('lost response')) as fetch, \
             patch.object(worker.time, 'sleep'):
            with self.assertRaises(RuntimeError):
                worker.request_json('https://test.example/hermes/jobs/test', 'test')
            self.assertEqual(fetch.call_count, 3)

    def test_unknown_completion_does_not_attempt_to_mark_failed(self):
        job = {'id': 'hermes-test', 'profile': 'research_readonly'}
        with patch.object(worker, 'acquire_lock', return_value=True), \
             patch.object(worker, 'switchboard_url', return_value=worker.SWITCHBOARD_ORIGIN), \
             patch.object(worker, 'worker_key', return_value='test-worker'), \
             patch.object(worker, 'preflight'), patch.object(worker, 'post_log'), \
             patch.object(worker, 'execute', return_value='model result'), \
             patch.object(worker, 'log'), patch.object(worker, 'LOCK'), \
             patch.object(worker, 'request_json', side_effect=[{'job': job}, TimeoutError()]) as request:
            self.assertEqual(worker.main(), 1)
            self.assertEqual(request.call_count, 2)
            self.assertEqual(request.call_args.args[2]['status'], 'completed')

    def test_doctor_rejects_liveness_without_queue_or_worker_binding(self):
        checks = doctor.inspect_health({'ok':True,'service':'nicholas-ai-switchboard','hermes_jobs':False})
        self.assertTrue(checks['remote_health'])
        self.assertFalse(checks['queue_bound'])
        self.assertFalse(checks['worker_key_bound'])

    def test_doctor_never_serializes_credentials_or_claims_execution(self):
        with patch.object(worker, 'ROOT', ROOT), \
             patch.object(worker, 'hermes_bin', return_value='/venv/bin/hermes'), \
             patch.object(worker, 'worker_key', return_value='DO_NOT_PRINT'), \
             patch.object(worker, 'hermes_environment', return_value={'OPENROUTER_API_KEY':'DO_NOT_PRINT'}):
            def check_worker(origin, key):
                self.assertEqual(origin, worker.SWITCHBOARD_ORIGIN)
                self.assertEqual(key, 'DO_NOT_PRINT')

            report = doctor.report(worker.SWITCHBOARD_ORIGIN, fetch=lambda url: {
                'ok':True,'service':'nicholas-ai-switchboard','hermes_jobs':True,
                'hermes_worker_key_configured':True}, authenticate=check_worker)
            self.assertEqual(report['status'], 'ready_for_smoke_test')
            self.assertFalse(report['end_to_end_verified'])
            self.assertNotIn('DO_NOT_PRINT', json.dumps(report))

    def test_worker_key_check_requires_authenticated_not_found(self):
        for code, message in ((404, 'Hermes job not found'), (401, 'Unauthorized'),
                              (404, 'Unknown route'), (503, 'Unavailable')):
            error = urllib.error.HTTPError(worker.SWITCHBOARD_ORIGIN, code, "", {}, io.BytesIO(
                json.dumps({"error": message}).encode()))
            with patch.object(worker.HTTP, 'open', side_effect=error) as fetch:
                if message == 'Hermes job not found':
                    worker.worker_has_access(worker.SWITCHBOARD_ORIGIN, 'test-worker')
                else:
                    with self.assertRaisesRegex(RuntimeError, f'HTTP {code}'):
                        worker.worker_has_access(worker.SWITCHBOARD_ORIGIN, 'test-worker')
                request = fetch.call_args.args[0]
                self.assertEqual(request.get_method(), "GET")
                self.assertEqual(request.get_header("Authorization"), "Bearer test-worker")

    def test_hermes_process_inherits_only_model_credential(self):
        with patch.dict(os.environ, {"OPENROUTER_API_KEY": "provider-secret",
                        "HERMES_WORKER_KEY": "worker-secret", "CLOUDFLARE_API_TOKEN": "deployment-secret"}, clear=True):
            self.assertEqual(worker.hermes_environment(), {"OPENROUTER_API_KEY": "provider-secret",
                                                           "HERMES_MAX_TOKENS": worker.HERMES_MAX_TOKENS})

    def test_doctor_rejects_credential_bearing_urls_before_fetch(self):
        with patch.object(worker, 'hermes_bin'), patch.object(worker, 'worker_key'), \
             patch.object(worker, 'hermes_environment'):
            def unexpected_fetch(url):
                self.fail('Invalid endpoint must not be contacted')
            report = doctor.report('https://user:secret@test.example', fetch=unexpected_fetch)
            self.assertEqual(report['status'], 'blocked')
            self.assertNotIn('secret', json.dumps(report))

    def test_prepare_deployment_works_from_unrelated_cwd(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'checkout'
            (root / 'scripts').mkdir(parents=True)
            service = root / 'services/ai-switchboard'
            service.mkdir(parents=True)
            for name in ['prepare_hermes_deploy.sh','resolve_hermes_kv.py']:
                (root / 'scripts' / name).write_bytes((ROOT / 'scripts' / name).read_bytes())
            (service / 'wrangler.jsonc').write_text(json.dumps({'name':'nicholas-ai-switchboard','main':'src/hermes-index.ts'}))
            binary = Path(tmp) / 'bin'
            binary.mkdir()
            npx = binary / 'npx'
            npx.write_text('#!/bin/sh\nprintf \'[{"title":"HERMES_JOBS","id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]\\n\'\n')
            npx.chmod(0o700)
            result = subprocess.run(['bash',str(root / 'scripts/prepare_hermes_deploy.sh'),'resolved.json'],
                cwd=tmp, env={**os.environ,'PATH':str(binary)+os.pathsep+os.environ['PATH']}, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            config = json.loads((Path(tmp) / 'resolved.json').read_text())
            self.assertEqual(config['main'], str(service / 'src/hermes-index.ts'))
            self.assertEqual(config['kv_namespaces'][0]['id'], 'a'*32)

if __name__ == '__main__': unittest.main()
