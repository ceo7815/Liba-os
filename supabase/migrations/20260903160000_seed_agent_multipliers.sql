-- Seed the official Liba agent wage multipliers.

INSERT INTO public.marketing_agent_rates (agent_name, multiplier)
VALUES
  ('ניב קובי', 5),
  ('בן ביטון', 5),
  ('חן בר און', 6),
  ('שחר משה', 5),
  ('שי משה', 5),
  ('אוריאל כהן', 5),
  ('סימונה', 6),
  ('דניאל כהן', 5),
  ('פרח כהן', 5)
ON CONFLICT (agent_name) DO UPDATE
SET multiplier = EXCLUDED.multiplier,
    updated_at = now();
