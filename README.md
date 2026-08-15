# Nicholas AI OS

Private operating repository for Nicholas's reusable ChatGPT workflows, automation code, routing rules, QA checks, and job definitions.

## Purpose

ChatGPT acts as the orchestrator. This repository stores the durable, versioned parts of the system so repeated work can be executed consistently rather than rebuilt from scratch in each conversation.

## Core principles

- Use the lowest-cost capable tool first.
- Keep secrets out of source control.
- Prefer deterministic, testable workflows for repeated tasks.
- Verify outputs before delivery.
- Improve reusable workflows after real-world runs.
- Use specialist plugins only when they add clear value.

## Initial system components

- Workflow Router
- Capability Registry
- Cost Guard
- QA Gate
- Workflow Registry
- Job definitions
- GitHub Actions automation
- Lessons / workflow improvement notes

This repository is private and intended to become the durable execution layer behind Nicholas's ChatGPT workflows.
