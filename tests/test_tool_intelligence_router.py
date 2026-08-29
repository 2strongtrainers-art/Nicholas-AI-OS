import importlib.util
import unittest
from pathlib import Path

P=Path(__file__).resolve().parents[1]/"scripts"/"tool_intelligence_router.py"
spec=importlib.util.spec_from_file_location("tool_intelligence_router",P)
router=importlib.util.module_from_spec(spec); assert spec.loader
spec.loader.exec_module(router)

class ToolIntelligenceRouterTests(unittest.TestCase):
    def top(self,q,runtime_adapters=None):
        r=router.route(q,limit=5,runtime_adapters=runtime_adapters)
        self.assertEqual(r["status"],"matched")
        return r["primary"],r

    def test_counts_load(self):
        idx,tools=router.load_websurfers()
        self.assertEqual(len(tools),1800)
        self.assertEqual(idx["counts"]["unique_domains"],1501)
        self.assertEqual(idx["counts"]["direct_connector_records_current_chatgpt"],21)

    def test_canva_direct_execution(self):
        top,_=self.top("create a social media design in Canva",runtime_adapters={"Canva"})
        self.assertEqual(top["website_name"],"Canva")
        self.assertTrue(top["can_execute_now"])
        self.assertEqual(top["direct_connector"],"Canva")

    def test_connector_is_not_assumed_live_without_runtime_injection(self):
        top,_=self.top("create a social media design in Canva")
        self.assertFalse(top["can_execute_now"])
        self.assertEqual(top["mode"],"connector_candidate")

    def test_heygen_direct_execution_when_live(self):
        top,_=self.top("create an avatar video with HeyGen",runtime_adapters={"HeyGen"})
        self.assertEqual(top["website_name"],"HeyGen")
        self.assertTrue(top["can_execute_now"])

    def test_github_hosted_project_is_not_execution_adapter(self):
        top,_=self.top("Mineflayer minecraft javascript bots automate tasks",runtime_adapters={"GitHub"})
        self.assertEqual(top["website_name"],"Mineflayer")
        self.assertFalse(top["can_execute_now"])
        self.assertIsNone(top["direct_connector"])

    def test_zoo_for_conversational_cad(self):
        top,_=self.top("conversational 3d cad engineering")
        self.assertEqual(top["website_name"],"Zoo")

    def test_mit_course(self):
        top,_=self.top("find free MIT course lecture notes exams")
        self.assertIn("MIT",top["website_name"])
        self.assertEqual(top["domain"],"ocw.mit.edu")

    def test_grabcraft_from_gaming_supplement(self):
        top,_=self.top("minecraft 3d blueprint building guide")
        self.assertEqual(top["website_name"],"GrabCraft")
        self.assertEqual(top["source"]["spreadsheet"],"Gaming Tools (19/06/2026)")
        self.assertEqual(top["source"]["row"],76)

    def test_vector_editor_not_free_keyword_false_positive(self):
        top,_=self.top("free browser based vector editor")
        self.assertIn(top["website_name"],{"Graphite","Vectr"})

    def test_terrain_does_not_guess_from_gaming_maps(self):
        r=router.route("3d map terrain elevation lidar",limit=5)
        self.assertEqual(r["status"],"no_match")

    def test_selection_not_execution_for_unconnected_site(self):
        top,_=self.top("conversational 3d cad engineering")
        self.assertFalse(top["can_execute_now"])
        self.assertEqual(top["mode"],"research_or_browser")

if __name__=="__main__":
    unittest.main()
