#!/usr/bin/env python3
"""Allowlisted paper-trading route for Nicholas Operator.

No arbitrary command input is accepted. The only action is a repository-owned,
paper-only Hermes analysis script with no broker execution capability.
"""

import json
import sys


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
            and job.get("execution_mode") == "run_hermes_paper_trading_desk"
        ):
            return previous(path)

        job_id = job.get("id") or path.stem
        job["render_mode_resolved"] = "maintenance"
        job["routing_reason"] = "explicit allowlisted Hermes paper-only market analysis"
        job["status"] = "running"
        job["started_at"] = worker.utc_now()
        job["paper_only"] = True
        job["live_execution_enabled"] = False
        job.pop("error", None)
        job.pop("failed_at", None)
        worker.save_job(path, job)
        worker.push_status(path, f"Hermes paper desk {job_id}: running")

        try:
            script = worker.QUEUE_REPO / "scripts" / "run_hermes_paper_trading_desk.py"
            if not script.exists():
                raise RuntimeError(f"Paper desk runner missing: {script}")
            result = worker.run(
                [sys.executable, str(script)],
                cwd=worker.QUEUE_REPO,
                timeout=900,
            )
            output = result.stdout or ""
            verified = bool(output.strip()) and "LIVE EXECUTION: DISABLED" in output
            if not verified:
                raise RuntimeError("Hermes paper desk output failed the live-execution-disabled verification")

            job["status"] = "completed"
            job["completed_at"] = worker.utc_now()
            job["hermes_paper_desk_verified"] = True
            job["hermes_paper_desk_provider"] = "openai-codex"
            job["hermes_paper_desk_model"] = "gpt-5.6-sol"
            job["hermes_paper_desk_live_execution"] = False
            job["hermes_paper_desk_result"] = worker.sanitize_log_text(output.strip())[-16000:]
            worker.save_job(path, job)
            worker.push_status(path, f"Hermes paper desk {job_id}: completed")
            worker.log(f"HERMES PAPER DESK COMPLETED {job_id}")
        except Exception as exc:
            job["status"] = "failed"
            job["failed_at"] = worker.utc_now()
            job["error"] = str(exc)
            job["hermes_paper_desk_live_execution"] = False
            worker.save_job(path, job)
            try:
                worker.push_status(path, f"Hermes paper desk {job_id}: failed")
            except Exception as push_err:
                worker.log(f"Failed to push paper-desk failure status: {push_err}")
            worker.log(f"HERMES PAPER DESK FAILED {job_id}: {exc}")
        return True

    resilient.resilient_process_job = process_job
    return process_job
