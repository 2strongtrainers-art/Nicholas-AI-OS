#!/usr/bin/env python3
"""Allowlisted Mac maintenance and demonstrations for the AI agent stack.

This intentionally exposes no arbitrary-shell job. It handles explicit
execution modes and runs only repository-controlled actions.
"""

import json
from pathlib import Path

HERMES_RESEARCH_TASK_MAX_CHARS = 12000
HERMES_RESEARCH_TIMEOUT_DEFAULT = 900
HERMES_RESEARCH_TIMEOUT_MAX = 1200


def _codex_bin():
    candidates = (
        Path.home() / ".local" / "bin" / "codex",
        Path("/usr/local/bin/codex"),
        Path("/opt/homebrew/bin/codex"),
    )
    return next((path for path in candidates if path.exists()), candidates[0])


def _hermes_bin():
    candidates = (
        Path.home() / ".local" / "bin" / "hermes",
        Path("/usr/local/bin/hermes"),
        Path("/opt/homebrew/bin/hermes"),
    )
    return next((path for path in candidates if path.exists()), candidates[0])


def _hermes_research_prompt(task: str) -> str:
    return f"""You are Nicholas Operator/Hermes running an authenticated one-shot task from the Nicholas-AI-OS GitHub control plane.

SAFETY PROFILE — READ ONLY
- Perform reasoning and public-information research only.
- Use only the enabled search toolset.
- Do not edit or create files.
- Do not run terminal or shell commands.
- Do not send messages, publish content, schedule tasks, make purchases, change accounts, change websites, alter CRM/payment systems, or control the computer.
- Do not access, reveal, print, or infer credentials, tokens, API keys, .env files, Keychain data, or other secrets.
- If the task requires a mutation or a capability outside this read-only profile, explain the blocked action instead of attempting it.

USER TASK
{task}

Return the useful result directly and distinguish verified facts from uncertainty."""


def install(resilient, worker):
    previous = resilient.resilient_process_job

    def process_job(path):
        try:
            job = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return previous(path)

        allowed_modes = {
            "install_agent_stack",
            "demo_codex_readonly",
            "configure_hermes_safe",
            "configure_nicholas_operator_brain",
            "run_nicholas_operator_first_test",
            "run_hermes_research_task",
        }
        if not (
            job.get("status") == "queued"
            and job.get("type") == "openmontage_video"
            and job.get("execution_mode") in allowed_modes
        ):
            return previous(path)

        job_id = job.get("id") or path.stem
        mode = job.get("execution_mode")
        job["render_mode_resolved"] = "maintenance"
        job["status"] = "running"
        job["started_at"] = worker.utc_now()
        job.pop("error", None)
        job.pop("failed_at", None)

        if mode == "install_agent_stack":
            job["routing_reason"] = "explicit allowlisted Codex + Hermes + Agent Skills installation"
        elif mode == "configure_hermes_safe":
            job["routing_reason"] = "explicit allowlisted Hermes local scheduler + zero-spend health job configuration"
        elif mode == "configure_nicholas_operator_brain":
            job["routing_reason"] = "explicit allowlisted Nicholas Operator Hermes brain activation"
        elif mode == "run_nicholas_operator_first_test":
            job["routing_reason"] = "explicit allowlisted Nicholas Operator read-only reasoning test"
        elif mode == "run_hermes_research_task":
            job["routing_reason"] = "explicit allowlisted Hermes one-shot read-only research task"
        else:
            job["routing_reason"] = "explicit allowlisted Codex read-only repository demonstration"

        worker.save_job(path, job)
        worker.push_status(path, f"Agent stack {job_id}: running")

        try:
            if mode == "install_agent_stack":
                script = worker.QUEUE_REPO / "scripts" / "install_agent_stack.sh"
                if not script.exists():
                    raise RuntimeError(f"Agent stack installer missing: {script}")
                result = worker.run(
                    ["/bin/zsh", script],
                    cwd=worker.QUEUE_REPO,
                    timeout=1500,
                )
                output = result.stdout or ""
                job["codex_installed"] = "CODEX_INSTALLED=1" in output
                job["hermes_installed"] = "HERMES_INSTALLED=1" in output
                job["awesome_agent_skills_installed"] = "AWESOME_AGENT_SKILLS_INSTALLED=1" in output
                job["agent_stack_verified"] = "AGENT_STACK_INSTALL_OK=1" in output
                job["maintenance_result"] = worker.sanitize_log_text(output.strip())[-12000:]
            elif mode == "configure_hermes_safe":
                script = worker.QUEUE_REPO / "scripts" / "configure_hermes_safe.sh"
                if not script.exists():
                    raise RuntimeError(f"Hermes configuration script missing: {script}")
                result = worker.run(
                    ["/bin/zsh", script],
                    cwd=worker.QUEUE_REPO,
                    timeout=300,
                )
                output = result.stdout or ""
                job["hermes_safe_configured"] = "HERMES_SAFE_CONFIG_OK=1" in output
                job["hermes_local_scheduler"] = "HERMES_GATEWAY_LOCAL_SCHEDULER=1" in output
                job["hermes_external_messaging_configured"] = False
                job["hermes_model_provider_configured"] = False
                job["hermes_cron_no_agent"] = "HERMES_CRON_NO_AGENT=1" in output
                job["hermes_cron_schedule"] = "30 7 * * *"
                job["hermes_cron_delivery"] = "local"
                job["maintenance_result"] = worker.sanitize_log_text(output.strip())[-12000:]
                if not job["hermes_safe_configured"]:
                    raise RuntimeError("Hermes safe configuration did not return verification marker")
            elif mode == "configure_nicholas_operator_brain":
                script = worker.QUEUE_REPO / "scripts" / "configure_nicholas_operator_brain.sh"
                if not script.exists():
                    raise RuntimeError(f"Nicholas Operator configuration script missing: {script}")
                result = worker.run(
                    ["/bin/zsh", script],
                    cwd=worker.QUEUE_REPO,
                    timeout=300,
                )
                output = result.stdout or ""
                job["nicholas_operator_configured"] = "NICHOLAS_OPERATOR_CONFIG_OK=1" in output
                job["nicholas_operator_soul_installed"] = "NICHOLAS_OPERATOR_SOUL_INSTALLED=1" in output
                job["nicholas_operator_project_context"] = "NICHOLAS_OPERATOR_PROJECT_CONTEXT=1" in output
                job["nicholas_operator_provider"] = "openai-codex"
                job["nicholas_operator_model"] = "gpt-5.6-sol"
                job["nicholas_operator_codex_auth_detected"] = "NICHOLAS_OPERATOR_CODEX_AUTH_DETECTED=1" in output
                job["nicholas_operator_memory_approval"] = "NICHOLAS_OPERATOR_MEMORY_APPROVAL=1" in output
                job["nicholas_operator_unattended_ai_cron"] = False
                job["nicholas_operator_external_messaging"] = False
                job["nicholas_operator_gateway_ok"] = "NICHOLAS_OPERATOR_GATEWAY_OK=1" in output
                job["maintenance_result"] = worker.sanitize_log_text(output.strip())[-12000:]
                if not job["nicholas_operator_configured"]:
                    raise RuntimeError("Nicholas Operator configuration did not return verification marker")
            elif mode == "run_nicholas_operator_first_test":
                prompt = """You are Nicholas Operator. This is your first controlled model-driven business reasoning run.

Do not execute actions and do not call tools. Do not edit files, send messages, publish, schedule anything, spend money, alter financial systems, change a website, or change CRM records. Reason only from the audited facts below.

AUDITED CURRENT STATE
- Nicholas-AI-OS is a private GitHub-controlled automation system that can route approved jobs to a Mac worker and return verified results.
- The Mac worker is healthy and has an AC-power keep-awake policy.
- Codex CLI is installed and a read-only remote repository analysis has succeeded end-to-end.
- Hermes is installed as a persistent launchd-supervised service.
- Hermes has one zero-token no-agent daily Nicholas-AI-OS health job at 7:30 AM local time.
- The Nicholas Operator SOUL and Nicholas-AI-OS project context are installed.
- The reasoning provider is existing OpenAI Codex/ChatGPT OAuth with GPT-5.6 Sol; no new pay-per-token API key was added.
- Persistent memory writes require approval.
- External messaging and unattended AI cron remain disabled.
- Awesome Agent Skills is installed as a local catalog for selective use.
- Existing media automation includes vertical Reel production, ElevenLabs narration, MoneyPrinter/OpenMontage rendering, validation, and iCloud delivery.
- The business has a TriValley.fit online-coaching funnel, including a $497/month online coaching offer and a $297 assessment. Publishing and consequential financial changes require approval.
- The goal is to use automation to increase or protect legitimate business revenue while preserving review gates on consequential actions.

OBJECTIVE
Choose the single highest-value automation to build next that could plausibly increase or protect revenue within 7 days. Score your winner from 1-10 on revenue impact, time-to-value, reversibility, confidence, and implementation effort (10 = easiest). Give:
1. The winner and one-sentence thesis.
2. Why it beats the two best runners-up.
3. The exact workflow from trigger to reviewed output.
4. The minimum permissions it needs and what must remain approval-gated.
5. Three measurable success metrics for the first 7 days.
6. The first concrete Codex implementation task, scoped so it cannot publish, message prospects, or charge money.
7. One failure mode that would cause you to stop or redesign the automation.

Be specific, commercially grounded, concise, and skeptical. Maximum 700 words."""
                usage_path = Path.home() / ".hermes" / "nicholas-operator-first-test-usage.json"
                result = worker.run(
                    [
                        str(_hermes_bin()),
                        "--provider", "openai-codex",
                        "--model", "gpt-5.6-sol",
                        "--reasoning", "high",
                        "--toolsets", "search",
                        "--usage-file", str(usage_path),
                        "--oneshot", prompt,
                    ],
                    cwd=worker.QUEUE_REPO,
                    timeout=900,
                )
                output = result.stdout or ""
                job["nicholas_operator_first_test_verified"] = bool(output.strip())
                job["nicholas_operator_first_test_provider"] = "openai-codex"
                job["nicholas_operator_first_test_model"] = "gpt-5.6-sol"
                job["nicholas_operator_first_test_reasoning"] = "high"
                job["nicholas_operator_first_test_toolsets"] = "search (read-only)"
                job["nicholas_operator_first_test_mutations_allowed"] = False
                job["nicholas_operator_first_test_usage_report_written"] = usage_path.exists()
                job["nicholas_operator_first_test_result"] = worker.sanitize_log_text(output.strip())[-16000:]
                if not job["nicholas_operator_first_test_verified"]:
                    raise RuntimeError("Nicholas Operator first reasoning test returned no output")
            elif mode == "run_hermes_research_task":
                task = str(job.get("hermes_task") or job.get("brief") or "").strip()
                if not task:
                    raise RuntimeError("Missing hermes_task")
                if len(task) > HERMES_RESEARCH_TASK_MAX_CHARS:
                    raise RuntimeError(
                        f"hermes_task exceeds {HERMES_RESEARCH_TASK_MAX_CHARS} characters"
                    )
                timeout_seconds = int(job.get("timeout_seconds", HERMES_RESEARCH_TIMEOUT_DEFAULT))
                timeout_seconds = max(60, min(timeout_seconds, HERMES_RESEARCH_TIMEOUT_MAX))
                usage_path = Path.home() / ".hermes" / f"{worker.safe_slug(job_id)}-usage.json"
                prompt = _hermes_research_prompt(task)
                result = worker.run(
                    [
                        str(_hermes_bin()),
                        "--provider", "openai-codex",
                        "--model", "gpt-5.6-sol",
                        "--reasoning", "high",
                        "--toolsets", "search",
                        "--usage-file", str(usage_path),
                        "--oneshot", prompt,
                    ],
                    cwd=worker.QUEUE_REPO,
                    timeout=timeout_seconds,
                )
                output = result.stdout or ""
                job["hermes_profile"] = "research_readonly"
                job["hermes_provider"] = "openai-codex"
                job["hermes_model"] = "gpt-5.6-sol"
                job["hermes_reasoning"] = "high"
                job["hermes_toolsets"] = "search (read-only)"
                job["hermes_mutations_allowed"] = False
                job["hermes_usage_report_written"] = usage_path.exists()
                job["hermes_result"] = worker.sanitize_log_text(output.strip())[-20000:]
                job["hermes_verified"] = bool(output.strip())
                if not job["hermes_verified"]:
                    raise RuntimeError("Hermes read-only task returned no output")
            else:
                prompt = (
                    "Inspect this Nicholas-AI-OS repository in read-only mode. Do not edit files, "
                    "do not access network resources, do not inspect credential, token, .env, keychain, "
                    "or secret files, and do not reveal secrets. Focus only on tracked source code and "
                    "documentation. Return a concise report with exactly three sections: "
                    "1) What this system already does well, 2) The three highest-value improvements, "
                    "3) One concrete next automation to build. Keep the full response under 500 words."
                )
                result = worker.run(
                    [
                        str(_codex_bin()),
                        "--ask-for-approval", "never",
                        "exec",
                        "--sandbox", "read-only",
                        "--ephemeral",
                        "--ignore-user-config",
                        prompt,
                    ],
                    cwd=worker.QUEUE_REPO,
                    timeout=600,
                )
                output = result.stdout or ""
                job["codex_demo_sandbox"] = "read-only"
                job["codex_demo_ephemeral"] = True
                job["codex_demo_result"] = worker.sanitize_log_text(output.strip())[-12000:]
                job["codex_demo_verified"] = bool(output.strip())

            job["status"] = "completed"
            job["completed_at"] = worker.utc_now()
            worker.save_job(path, job)
            worker.push_status(path, f"Agent stack {job_id}: completed")
            worker.log(f"AGENT STACK COMPLETED {job_id}: mode={mode}")
        except Exception as exc:
            job["status"] = "failed"
            job["failed_at"] = worker.utc_now()
            job["error"] = str(exc)
            worker.save_job(path, job)
            try:
                worker.push_status(path, f"Agent stack {job_id}: failed")
            except Exception as push_err:
                worker.log(f"Failed to push agent-stack failure status: {push_err}")
            worker.log(f"AGENT STACK FAILED {job_id}: {exc}")
        return True

    resilient.resilient_process_job = process_job
    return process_job
