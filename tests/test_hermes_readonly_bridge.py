from pathlib import Path


SOURCE_PATH = Path("scripts/openmontage_agent_stack.py")


def _source() -> str:
    return SOURCE_PATH.read_text(encoding="utf-8")


def test_hermes_bridge_source_compiles():
    source = _source()
    compile(source, str(SOURCE_PATH), "exec")


def test_hermes_research_mode_is_explicitly_allowlisted_and_read_only():
    source = _source()
    assert '"run_hermes_research_task"' in source
    assert '"--toolsets", "search"' in source
    assert 'job["hermes_mutations_allowed"] = False' in source
    assert 'job["hermes_profile"] = "research_readonly"' in source


def test_hermes_research_prompt_blocks_consequential_actions_and_secrets():
    source = _source()
    assert "Do not edit or create files." in source
    assert "Do not run terminal or shell commands." in source
    assert "Do not send messages, publish content, schedule tasks, make purchases" in source
    assert "Do not access, reveal, print, or infer credentials" in source
    assert "HERMES_RESEARCH_TASK_MAX_CHARS = 12000" in source
