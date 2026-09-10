-- Restore referral sources that were previously hidden from the marketing board.

INSERT INTO public.marketing_campaigns (source_name, included)
VALUES
  ('רועי אזולאי', true),
  ('רועי אוזלאי', true),
  ('קמפיין שמש', true),
  ('קו 2 רועי אזולאי', true),
  ('קמפיין שי', true),
  ('סקירה אשר לא קיים', true),
  ('סקירה', true),
  ('אביחי יועצים', true),
  ('קמפיין דור', true)
ON CONFLICT (source_name) DO UPDATE
SET included = true,
    updated_at = now();
