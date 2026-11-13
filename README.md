# Nicholas AI OS

Public repository for Nicholas's reusable ChatGPT workflows, automation code, routing rules, QA checks, and job definitions.

## Purpose

ChatGPT acts as the orchestrator. This repository stores the durable, versioned parts of the system so repeated work can be executed consistently rather than rebuilt from scratch in each conversation.

## Core principles

- Use the lowest-cost capable tool first.
- Keep secrets, private client data, and owner-only work in their authorized services.
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

GitHub holds the versioned execution and QA code. Connected services hold private inputs and owner reports.
