-- Align hermes_profile with Hermes folder name (API slug stays call-control)
UPDATE public.agents
SET hermes_profile = 'call-qa'
WHERE slug = 'call-control'
  AND hermes_profile IS DISTINCT FROM 'call-qa';
