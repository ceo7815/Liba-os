-- Hide referral sources that are not Liba campaigns from the marketing board.

INSERT INTO public.marketing_campaigns (source_name, included)
VALUES
  ('רועי אזולאי', false),
  ('רועי אוזלאי', false),
  ('קמפיין שמש', false),
  ('קו 2 רועי אזולאי', false),
  ('קמפיין שי', false),
  ('סקירה אשר לא קיים', false),
  ('סקירה', false),
  ('אביחי יועצים', false),
  ('קמפיין דור', false)
ON CONFLICT (source_name) DO UPDATE
SET included = false,
    updated_at = now();
