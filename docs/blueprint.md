# LogExtract Bot — Bot specification

**Archetype:** custom

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot that fetches log files from a remote folder path/URL, extracts structured fields from those logs, and returns the extracted data as a ZIP of structured files. Designed for engineers, SREs, and product analysts who need fast extraction of structured fields from server or application logs.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Engineers
- SREs
- Product Analysts

## Success criteria

- User receives ZIP file with structured log data within 7 days of job submission
- Bot handles 95% of common log formats with default extraction rules
- Progress updates are sent in real-time during processing

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu
- **/extract** (command, actor: user, command: /extract) — Initiate a new log extraction job
- **Re-run with filters** (button, actor: user, callback: job:rerun) — Re-run a previous job with additional filters

## Flows

### extraction_flow
_Trigger:_ /extract

1. User sends /extract command
2. Bot requests remote folder path/URL
3. User provides path
4. Bot confirms parameters and starts processing
5. Bot sends progress updates
6. Bot uploads ZIP file with results
7. User can re-run with filters

_Data touched:_ Job, Log file, Extracted record

### re_run_flow
_Trigger:_ job:rerun

1. User selects 'Re-run with filters' button
2. Bot requests filter parameters (time range, filename glob, regex)
3. User provides filters
4. Bot confirms parameters and re-runs job
5. Bot sends progress updates
6. Bot uploads updated ZIP file

_Data touched:_ Job, Extracted record

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Job** _(retention: persistent)_ — User-initiated extraction request with parameters, status, and result link
  - fields: remote_path, filters, rules, status, result_link
- **Log file** _(retention: session)_ — Raw file fetched from the remote path
  - fields: file_name, file_size, download_status
- **Extracted record** _(retention: session)_ — Structured JSON/CSV row produced from each parsed log line
  - fields: timestamp, level, service, message, key_value_pairs

## Integrations

- **Telegram** (required) — Bot API messaging for user interaction
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure default extraction rules
- Set maximum job size limit
- Adjust result retention period
- Enable/disable specific protocols (HTTP, SFTP)

## Notifications

- Job started
- Job in progress
- Job completed with results
- Job failed with error report

## Permissions & privacy

- Do not store user credentials
- Delete job data after 7 days
- Only store extracted data and minimal metadata

## Edge cases

- Remote path requires authentication (bot returns clear error)
- Log file exceeds size limit
- Multiple log files with different formats
- Partial parsing success with errors

## Required tests

- End-to-end extraction flow from path input to ZIP download
- Error handling for invalid remote paths
- Filter application in re-run scenarios
- Data retention and cleanup after 7 days

## Assumptions

- Remote paths are publicly accessible by default
- Default extraction rules handle common log formats
- User will handle authentication if required
- Job results are needed within 7 days
