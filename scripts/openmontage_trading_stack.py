#!/usr/bin/env python3
"""Allowlisted paper-trading routes for Nicholas Operator.

No arbitrary command input is accepted. Supported actions are repository-owned,
paper-only workflows with no broker execution capability.
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

        mode = job.get("execution_mode")
        allowed = {
            "run_hermes_paper_trading_desk",
            "install_paper_daytrader_feed",
            "install_coinbase_crypto_futures_paper",
        }
        if not (
            job.get("status") == "queued"
            and job.get("type") == "openmontage_video"
            and mode in allowed
        ):
            return previous(path)

        job_id = job.get("id") or path.stem
        job["render_mode_resolved"] = "maintenance"
        if mode == "install_paper_daytrader_feed":
            job["routing_reason"] = "explicit allowlisted 60-second stock paper day-trader market-data feed installation"
        elif mode == "install_coinbase_crypto_futures_paper":
            job["routing_reason"] = "explicit allowlisted Coinbase US crypto-futures all-timeframe Hermes-supervised paper feed installation"
        else:
            job["routing_reason"] = "explicit allowlisted Hermes paper-only market analysis"
        job["status"] = "running"
        job["started_at"] = worker.utc_now()
        job["paper_only"] = True
        job["live_execution_enabled"] = False
        job.pop("error", None)
        job.pop("failed_at", None)
        worker.save_job(path, job)
        worker.push_status(path, f"Paper trading {job_id}: running")

        try:
            if mode == "install_paper_daytrader_feed":
                script = worker.QUEUE_REPO / "scripts" / "install_paper_daytrader_feed.sh"
                if not script.exists():
                    raise RuntimeError(f"Paper feed installer missing: {script}")
                result = worker.run(["/bin/zsh", str(script)], cwd=worker.QUEUE_REPO, timeout=120)
                output = result.stdout or ""
                if "PAPER_DAYTRADER_FEED_INSTALLED=1" not in output:
                    raise RuntimeError("Paper feed installer did not return verification marker")
                if "PAPER_DAYTRADER_LIVE_EXECUTION=0" not in output:
                    raise RuntimeError("Paper feed installer did not verify live execution disabled")
                job["paper_daytrader_feed_installed"] = True
                job["paper_daytrader_interval_seconds"] = 60
                job["paper_daytrader_live_execution"] = False
                job["paper_daytrader_symbols"] = ["SPY", "QQQ", "NVDA", "AAPL", "MSFT", "AMD"]
                job["maintenance_result"] = worker.sanitize_log_text(output.strip())[-12000:]
            elif mode == "install_coinbase_crypto_futures_paper":
                script = worker.QUEUE_REPO / "scripts" / "install_coinbase_crypto_futures_paper.sh"
                if not script.exists():
                    raise RuntimeError(f"Coinbase futures paper installer missing: {script}")
                result = worker.run(["/bin/zsh", str(script)], cwd=worker.QUEUE_REPO, timeout=180)
                output = result.stdout or ""
                required = (
                    "COINBASE_CRYPTO_FUTURES_PAPER_INSTALLED=1",
                    "COINBASE_CRYPTO_FUTURES_MTF=1",
                    "COINBASE_CRYPTO_FUTURES_HERMES_SUPERVISOR=1",
                    "COINBASE_CRYPTO_FUTURES_LIVE_EXECUTION=0",
                    "COINBASE_CRYPTO_FUTURES_PUBLIC_DATA_ONLY=1",
                )
                if not all(marker in output for marker in required):
                    raise RuntimeError("Coinbase futures MTF + Hermes installer failed safety verification")
                job["coinbase_crypto_futures_paper_installed"] = True
                job["coinbase_crypto_futures_interval_seconds"] = 60
                job["coinbase_crypto_futures_live_execution"] = False
                job["coinbase_crypto_futures_public_data_only"] = True
                job["coinbase_crypto_futures_multi_timeframe"] = True
                job["coinbase_crypto_futures_timeframes"] = [
                    "ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "THIRTY_MINUTE",
                    "ONE_HOUR", "TWO_HOUR", "FOUR_HOUR", "SIX_HOUR", "ONE_DAY",
                ]
                job["coinbase_crypto_futures_hermes_supervisor"] = True
                job["coinbase_crypto_futures_hermes_fail_closed"] = True
                job["coinbase_crypto_futures_allowed_underlyings"] = ["BTC", "ETH"]
                job["maintenance_result"] = worker.sanitize_log_text(output.strip())[-12000:]
            else:
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
                job["hermes_paper_desk_verified"] = True
                job["hermes_paper_desk_provider"] = "openai-codex"
                job["hermes_paper_desk_model"] = "gpt-5.6-sol"
                job["hermes_paper_desk_live_execution"] = False
                job["hermes_paper_desk_result"] = worker.sanitize_log_text(output.strip())[-16000:]

            job["status"] = "completed"
            job["completed_at"] = worker.utc_now()
            worker.save_job(path, job)
            worker.push_status(path, f"Paper trading {job_id}: completed")
            worker.log(f"PAPER TRADING COMPLETED {job_id}: mode={mode}")
        except Exception as exc:
            job["status"] = "failed"
            job["failed_at"] = worker.utc_now()
            job["error"] = str(exc)
            job["live_execution_enabled"] = False
            worker.save_job(path, job)
            try:
                worker.push_status(path, f"Paper trading {job_id}: failed")
            except Exception as push_err:
                worker.log(f"Failed to push paper-trading failure status: {push_err}")
            worker.log(f"PAPER TRADING FAILED {job_id}: {exc}")
        return True

    resilient.resilient_process_job = process_job
    return process_job
