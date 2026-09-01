BEGIN;

ALTER TABLE public."ping-video"
    ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'video',
    ADD COLUMN IF NOT EXISTS is_short boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_live_now boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS was_live boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS live_status text,
    ADD COLUMN IF NOT EXISTS live_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS live_published_at timestamptz,
    ADD COLUMN IF NOT EXISTS live_concurrent_view_count bigint,
    ADD COLUMN IF NOT EXISTS live_metadata jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ping_video_content_type_check'
    ) THEN
        ALTER TABLE public."ping-video"
            ADD CONSTRAINT ping_video_content_type_check
            CHECK (content_type IN ('video', 'short', 'live'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ping_video_content_type_idx
    ON public."ping-video" (content_type);

CREATE INDEX IF NOT EXISTS ping_video_live_status_idx
    ON public."ping-video" (live_status);

CREATE INDEX IF NOT EXISTS ping_video_live_started_at_idx
    ON public."ping-video" (live_started_at DESC);

COMMENT ON COLUMN public."ping-video".content_type IS
    'Tipo contenuto derivato dalla pipeline: video, short o live.';

COMMENT ON COLUMN public."ping-video".is_short IS
    'True quando il contenuto e classificato come YouTube Short.';

COMMENT ON COLUMN public."ping-video".is_live_now IS
    'True solo se yt-dlp segnala che la live e attualmente in corso.';

COMMENT ON COLUMN public."ping-video".was_live IS
    'True se il contenuto nasce come live archiviata o e stato live in precedenza.';

COMMENT ON COLUMN public."ping-video".live_started_at IS
    'Timestamp ISO derivato da release_timestamp di yt-dlp; per live future rappresenta l orario pianificato di inizio.';

COMMENT ON COLUMN public."ping-video".live_published_at IS
    'Timestamp ISO derivato da timestamp di yt-dlp per il contenuto live.';

COMMENT ON COLUMN public."ping-video".live_metadata IS
    'Payload JSONB con i principali metadati live restituiti da yt-dlp.';

COMMIT;