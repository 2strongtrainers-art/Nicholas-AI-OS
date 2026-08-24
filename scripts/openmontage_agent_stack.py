#!/usr/bin/env python3
"""Allowlisted Mac maintenance for the recommended AI agent stack.

This intentionally exposes no arbitrary-shell job. It handles one explicit
execution_mode and runs one repository-controlled installer script.
"""

import json


def install(resilient, worker):
    previous = resilient.resilient_process_job

    def process_job(path):
        try:
            job = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return previous(path)

        if not (
            job.get("status") == "queued"
            and job.get("type") == "openmontage_video"
            and job.get("execution_mode") == "install_agent_stack"
        ):
            return previous(path)

        job_id = job.get("id") or path.stem
        script = worker.QUEUE_REPO / "scripts" / "install_agent_stack.sh"
        job["render_mode_resolved"] = "maintenance"
        job["routing_reason"] = "explicit allowlisted Codex + Hermes + Agent Skills installation"
        job["status"] = "running"
        job["started_at"] = worker.utc_now()
        job.pop("error", None)
        job.pop("failed_at", None)
        worker.save_job(path, job)
        worker.push_status(path, f"Agent stack maintenance {job_id}: running")

        try:
            if not script.exists():
                raise RuntimeError(f"Agent stack installer missing: {script}")
            result = worker.run(
                ["/bin/zsh", script],
                cwd=worker.QUEUE_REPO,
                timeout=1500,
            )
            output = result.stdout or ""
            job["status"] = "completed"
            job["completed_at"] = worker.utc_now()
            job["maintenance_result"] = worker.sanitize_log_text(output.strip())[-12000:]
            job["codex_installed"] = "CODEX_INSTALLED=1" in output
            job["hermes_installed"] = "HERMES_INSTALLED=1" in output
            job["awesome_agent_skills_installed"] = "AWESOME_AGENT_SKILLS_INSTALLED=1" in output
            job["agent_stack_verified"] = "AGENT_STACK_INSTALL_OK=1" in output
            worker.save_job(path, job)
            worker.push_status(path, f"Agent stack maintenance {job_id}: completed")
            worker.log(f"AGENT STACK COMPLETED {job_id}: verified={job['agent_stack_verified']}")
        except Exception as exc:
            job["status"] = "failed"
            job["failed_at"] = worker.utc_now()
            job["error"] = str(exc)
            worker.save_job(path, job)
            try:
                worker.push_status(path, f"Agent stack maintenance {job_id}: failed")
            except Exception as push_err:
                worker.log(f"Failed to push agent-stack failure status: {push_err}")
            worker.log(f"AGENT STACK FAILED {job_id}: {exc}")
        return True

    resilient.resilient_process_job = process_job
    return process_job
