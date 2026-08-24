#!/usr/bin/env python3
"""Allowlisted Mac maintenance and demonstrations for the AI agent stack.

This intentionally exposes no arbitrary-shell job. It handles explicit
execution modes and runs only repository-controlled actions.
"""

import json
from pathlib import Path


def _codex_bin():
    candidates = (
        Path.home() / ".local" / "bin" / "codex",
        Path("/usr/local/bin/codex"),
        Path("/opt/homebrew/bin/codex"),
    )
    return next((path for path in candidates if path.exists()), candidates[0])


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
