import importlib.util
import subprocess
import tempfile
import unittest
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

if __name__ == '__main__': unittest.main()
