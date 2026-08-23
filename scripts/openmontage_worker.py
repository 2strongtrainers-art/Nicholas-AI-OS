#!/usr/bin/env python3
"""Stable entrypoint for the resilient Nicholas-AI-OS OpenMontage worker."""

import sys
from openmontage_worker_resilient import main

if __name__ == "__main__":
    sys.exit(main())
