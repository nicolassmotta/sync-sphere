# Usage and limits

[Documentation](README.md) · [Português (Brasil)](../usage.md)

## Choose and follow a transfer

Select source and destination on Home. The source may offer account playlists, a playlist link/ID, or file import depending on its capabilities. Follow Source, Destination and Connections, select playlists, review the estimate, and confirm. A provider cannot transfer to itself, except File to File for format conversion.

The queue has one processing lane per destination. Reading, matching and insertion run outside the HTTP request. Socket.io updates the panel. Estimates can change after throttling or cache hits.

| State | Next action |
|---|---|
| Queued | Wait for the destination lane. |
| Processing | Follow reading, matching and insertion. |
| Paused | Wait for the scheduled retry or use Resume where available. |
| Needs reconnection | Update the indicated connection. |
| Completed | Check output and unmatched tracks. |
| Needs attention | Read the error and use retry or manual review. |

You can switch language while following progress. It does not create another transfer or clear the selection. Dates use the selected locale. Unknown third-party errors may stay in their original language.

## Retry and review

Temporary failures stay paused while another persisted attempt is scheduled. Definitive failures appear as pending work in History. **Try again** and **Try all** also include matched tracks awaiting insertion. Retry keeps existing matches and a known destination playlist ID. Providers reconcile occurrence counts and insert only missing occurrences. Concurrent retry/review is refused while a job exists.

Unmatched tracks need manual review. In History, open details, choose an alternative, adjust title and artist, search, inspect the proposal, and confirm it. Proposals expire after ten minutes. Already inserted tracks are preserved. Older records without per-track state cannot offer this review.

Recovery after remote playlist creation but before its ID is saved can require manual inspection. Initial insertion follows resolved source order; later remote recovery appends missing tracks. File reconstructs source order.

## Reading limits

These are implementation limits, not universal service limits:

| Operation | Current limit |
|---|---|
| File import | 5 MB per request and 5,000 tracks |
| YouTube Music source | 1,000 snapshot tracks |
| Deezer, TIDAL, Apple Music source | 2,000 snapshot tracks each |
| SoundCloud | 500 snapshot tracks and 500 tracks sent to destination |
| Spotify alternative public read | 1,000 tracks; authenticated reads depend on pagination and permissions |
| Default history query | 50 latest transfers |
| Match cache | 5,000 entries, seven-day validity |

Confirmed source truncation is refused before creating the destination. History keeps known original, loaded and omitted counts. Split the source into smaller playlists. Identifiable unavailable or unsupported items are counted separately and do not automatically trigger this refusal. Unknown totals remain unknown rather than being invented.

## Files, reports and storage

Download File output in CSV, JSON, M3U or TXT. File to File transfers metadata without external search. Reports distinguish confirmed additions, matches awaiting insertion, unmatched and pending tracks. CSV headers, outcomes and report notes follow the language selected when downloading. Technical JSON keys and status enums stay unchanged, as do your playlist and track metadata.

If essential stored data cannot be read or decrypted, startup fails or readiness becomes unavailable. Preserve the data and original key; check `DATA_DIR`, `ENCRYPTION_KEY` and a compatible backup. Cache/statistics are disposable and may be skipped safely. See [backup recovery](backups.md).

Real account writes for the four additional providers still require validation. Simulated test responses do not establish real-account behavior.


## Interface recovery

History and per-track loading failures show an error with a retry action. They are not presented as an empty history or a fully resolved result. Mobile cards distinguish added, total, pending and unmatched tracks. Results with unmatched tracks display **Review outcome**. Confirmed truncated sources do not offer a retry that would repeat the same limit; split the source playlist first.

Dashboard tabs have their own URLs. Reload and browser navigation preserve the tab. A lost progress connection shows a reconnection notice without declaring the transfer finished. OAuth can be authorized again without first removing the saved connection.
