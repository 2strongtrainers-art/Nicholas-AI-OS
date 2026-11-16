# ARGUS verification receipt → n8n → Chief

This is a manual, read-only handoff of **synthetic verification evidence**.
It adds no schedule, client contact, broker action, image upload, or new service.
The existing ARGUS production origin remains
`https://argus-prime-forensics.2strongtrainers.workers.dev`.

## 1. Produce the receipt on GitHub

Run **Deploy ARGUS Private Forensics** on `main` with `verify_existing=true`.
The existing `osint-forensics-production` environment supplies the matching
independent ARGUS API key. This mode neither deploys nor changes secrets.
The verifier checks the known synthetic PNG only; real images are never CI inputs.

The verifier emits `argus-verification-receipt-v1` as `receipt.json` in the
artifact **`argus-verification-RUN_ID-RUN_ATTEMPT`**, retained for 14 days.
The same fixed projection is written to the GitHub step summary. A blocked or
failed verification also saves a receipt and leaves the job unsuccessful.
A failed earlier deployment step produces `prerequisite_failed` without trying
to analyze anything. If checkout or the runner itself fails before the verifier
can execute, an artifact may be absent; absence is never success.

The receipt contains public GitHub repository/workflow/run/attempt/commit
identifiers, a UTC observation time, and one of:

- `ARGUS_SYNTHETIC_PASS`: actual 401 then authorized 200, the fixed 69-byte PNG
  SHA-256, privacy flag, and successful ExifTool PNG/1×1 observations.
- `ARGUS_VERIFICATION_BLOCKED`: a fixed configuration/prerequisite reason;
  evidence is null.
- `ARGUS_VERIFICATION_FAILED`: a fixed verification failure reason; evidence is
  null.

It excludes the API key, configured URL, raw exception messages, source images,
arbitrary provider metadata, and unrelated environment values. A source commit
identifies the verifier that ran; it does **not** independently identify the
currently deployed Cloudflare code version.

## 2. Run the manual n8n handoff

Import [argus-verification-handoff.json](../workflows/n8n/argus-verification-handoff.json)
into the existing authenticated owner workspace. It starts inactive. Leave it
manual and keep the existing production intake and reel workflows unchanged.

With **Reviewed receipt (optional)** left at `{"reviewed_artifact":null}`, run it
once. Two bounded public GitHub GET requests read recent ARGUS runs and artifact
metadata. The workflow then returns:

- `BLOCKED` for an unsuccessful current run or unavailable/unusable evidence;
- `UNVERIFIED` for an unfinished run or a green run without a reviewed receipt.

Public run metadata is useful for identifying the blocker. A green run or the
existence of a correctly named artifact never proves the synthetic analysis.
The newest eligible run is used, so an old pass cannot mask a newer pending run.
The bounded lookups inspect 50 workflow runs and 100 repository artifacts;
missing or expired evidence requires a new verification run.

## 3. Supply an actual reviewed artifact

An authenticated owner/reader downloads the exact archive from GitHub, verifies
its SHA-256 against GitHub's artifact `digest`, opens `receipt.json`, and checks
that it came from the intended run. GitHub artifact downloads are authenticated;
this n8n workflow does not download the archive or request a new credential.

In the single **Reviewed receipt (optional)** Edit Fields node, replace the JSON
with the following shape using the **actual** artifact ID, archive SHA-256, and
complete receipt. Keep the input in the owner's authenticated workspace.

```json
{
  "reviewed_artifact": {
    "artifact_id": 123,
    "archive_sha256": "REPLACE_WITH_ACTUAL_64_CHARACTER_ARCHIVE_SHA256",
    "receipt": {}
  }
}
```

The numbers and empty object above are placeholders, not evidence. The digest
is for the **downloaded ZIP bytes**, not the JSON file. The workflow matches the
packet against fresh GitHub metadata: exact repository/workflow/branch, latest
run ID and attempt, commit, artifact ID and name, unexpired artifact, and archive
digest. It checks the receipt timestamp and rejects extra receipt fields. A pass
additionally requires every known synthetic assertion and an overall successful
run. A failed receipt paired with a successful run, or a pass paired with a
failed run, is blocked as inconsistent evidence.

The output calls this **reviewed artifact evidence**. Digest comparison in n8n
checks the reader-supplied digest against GitHub; it does not independently
prove which bytes the reader downloaded. Retain the actual archive in the
owner's private evidence record if longer retention is needed.

A genuine blocked receipt is valid handoff evidence. For example,
`worker_not_configured` preserves the actual authentication blocker through n8n
to the Chief while keeping the service marked blocked. It is not a live
authenticated success.

## 4. Review the Chief output and execution receipt

The final node returns:

- `receipt_key`: stable `argus-RUN_ID-RUN_ATTEMPT`, suitable for deduplication;
- exact run provenance and accepted synthetic evidence or fixed blocker;
- `n8n_execution_id` from the current n8n execution;
- `chief_snapshot`, compatible with the existing `chief_of_staff.brief` engine.

The workflow performs no data-table write and sends no message. Its
`chief_delivery` remains `normalized_output_prepared; acknowledgment_not_observed`.
The authorized reader must retain the final output and actual n8n execution ID,
pass the normalized snapshot to the Chief, and record the Chief's review before
claiming receipt by the Chief. Manual execution history is retained in the
owner's authenticated n8n workspace so the sanitized public-metadata receipt is
reviewable. Enter only the sanitized receipt packet, never credentials or images.
If ChatGPT reads the output and updates the existing Chief instruction, that is
an operator-mediated handoff; it is not an autonomous Chief acknowledgment.

Repeated n8n runs preserve `receipt_key` and the Chief item's source/version;
the existing Chief engine can suppress repeat priorities using its private
state. A new GitHub attempt is a new receipt. `VERIFIED_SYNTHETIC` means exactly
that test passed; it does not prove real-image investigation quality, automatic
Chief delivery, or complete deployment of other tools.

## Validation

```sh
python -m unittest discover -s tests -p 'test_osint_http.py' -v
node --test tests/test_argus_handoff.mjs
```

These exercise blocked/pass receipts, no secret or exception reflection,
provenance mismatches, stale attempts, false green runs, exact synthetic
assertions, safe retry identity, and the manual/read-only workflow boundary.
They use synthetic fixtures. Production and n8n execution remain separately
verified by their actual receipts.
