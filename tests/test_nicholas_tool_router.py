import importlib.util
import unittest
from pathlib import Path

P = Path(__file__).resolve().parents[1] / "scripts" / "nicholas_tool_router.py"
spec = importlib.util.spec_from_file_location("nicholas_tool_router", P)
router = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(router)


class NicholasToolRouterTests(unittest.TestCase):
    def test_confirmed_lucas_source_is_main_registry(self):
        result = router.route("find free MIT course lecture notes exams", limit=5)
        self.assertEqual(result["status"], "matched")
        self.assertEqual(result["primary"]["domain"], "ocw.mit.edu")
        self.assertIn(683, result["primary"]["lucas_confirmed_parts"])
        self.assertEqual(
            result["provenance_policy"]["lucas_confirmed"],
            "data/tool-intelligence/canonical-tools.json",
        )

    def test_probable_never_becomes_confirmed(self):
        lucas = router.load_canonical_lucas()
        probable = [t for t in lucas["tools"] if t.get("match_confidence") == "Probable"]
        self.assertTrue(probable)
        self.assertTrue(all(t.get("route_enabled") is False for t in probable))

    def test_runtime_execution_is_explicit(self):
        result = router.route(
            "create a social media design in Canva",
            runtime_adapters={"Canva"},
        )
        self.assertEqual(result["primary"]["website_name"], "Canva")
        self.assertTrue(result["primary"]["can_execute_now"])

    def test_unknown_adapter_is_not_assumed(self):
        result = router.route("conversational 3d cad engineering")
        self.assertEqual(result["status"], "matched")
        self.assertFalse(result["primary"]["can_execute_now"])


if __name__ == "__main__":
    unittest.main()
