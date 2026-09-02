ALTER TABLE public.council_spending ADD COLUMN IF NOT EXISTS planned_on date;
ALTER TABLE public.council_meetings ADD COLUMN IF NOT EXISTS expected_attendees integer NOT NULL DEFAULT 0;
ALTER TABLE public.council_meetings ADD COLUMN IF NOT EXISTS attendees_present integer;