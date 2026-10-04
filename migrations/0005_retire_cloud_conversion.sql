-- Keep original R2 packages and D1 history for the future conversion service.
UPDATE import_jobs
SET state='failed', error='Cloud conversion has been paused. Upload a Blender ZIP to convert locally in Studio.',
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE state IN ('queued','converting','saving');
