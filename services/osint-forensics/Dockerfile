# ARGUS PRIME: isolated offline parser image. This image must run with --network none.
FROM python:3.12-slim-bookworm

# Official C2PA release artifact and GitHub-published SHA256, verified 2026-11-14.
ARG C2PATOOL_VERSION=0.29.0
ARG C2PATOOL_SHA256=af5494722fc8c3f239980f36ceb3acf496d1481850d356a4bb34777b33b08043
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl libimage-exiftool-perl \
    && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    curl -fsSL "https://github.com/contentauth/c2patool/releases/download/v$C2PATOOL_VERSION/v$C2PATOOL_VERSION-x86_64-unknown-linux-gnu.tar.gz" -o /tmp/c2patool.tar.gz; \
    echo "$C2PATOOL_SHA256  /tmp/c2patool.tar.gz" | sha256sum -c -; \
    mkdir -p /tmp/c2pa; \
    tar -xzf /tmp/c2patool.tar.gz -C /tmp/c2pa; \
    executable="$(find /tmp/c2pa -type f -name c2patool -print -quit)"; \
    test -n "$executable"; \
    install -m 0755 "$executable" /usr/local/bin/c2patool; \
    rm -rf /tmp/c2pa /tmp/c2patool.tar.gz
COPY services/osint-forensics/analyze.py /opt/argus/analyze.py
ENV PYTHONDONTWRITEBYTECODE=1 HOME=/tmp
WORKDIR /opt/argus
USER 65532:65532
CMD ["python", "/opt/argus/analyze.py", "--help"]
