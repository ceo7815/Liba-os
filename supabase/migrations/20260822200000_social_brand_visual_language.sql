-- Ensure social_settings.brand keeps logo file + visualLanguage separate.
-- Logo path is always the official OS file; visualLanguage is photography language (editable).

UPDATE public.social_settings
SET brand =
  coalesce(brand, '{}'::jsonb)
  || jsonb_build_object(
    'logoPath', '/brand/liba-logo.png',
    'primaryColor', coalesce(brand->>'primaryColor', '#C41E3A'),
    'secondaryColor', coalesce(brand->>'secondaryColor', '#1B2A4A')
  )
  || CASE
    WHEN nullif(trim(coalesce(brand->>'visualLanguage', '')), '') IS NULL THEN
      jsonb_build_object(
        'visualLanguage',
        $vl$שפת עיצוב ליבה (אתר liba-fs.co.il) — לא הלוגו:

כן:
- צילום אנושי ישראלי באור יום טבעי: משפחה, הורים וילדים, שיחה שקטה, בית או משרד בהיר
- רקע בהיר: קרם / אוף-וויט / חם (#F7F4EE), לא שחור, לא ניאון
- צבעי אתר: נייבי עמוק, קרם, אדום-קורל לנקודת דגש קטנה בלבד — לא שליטה על כל הפריים
- אווירה רגועה, שקופה, מקצועית; הרבה אוויר; קומפוזיציה נקייה
- אם יש טקסט על התמונה: עברית, Rubik, קצר, חד

לא (זה נראה כמו «AI פיננסים» ולא כמו ליבה):
- סצנה קולנועית חשוכה, קונטרסט דרמטי, זוהר אדום
- מגן / לב / ידיים כאובייקט תלת-ממד שמוחזק בידיים או «משולב בסצנה»
- אייקונים מרחפים, גרפים זוהרים, HUD, כובע סיום, עפיפון, אופניים כקווי מתאר
- לוגו ענק, חותמת פינה גסה, או המצאת סימן חדש
- צהוב של Liba OS — זה צבע המערכת הפנימית, לא המותג הציבורי$vl$
      )
    ELSE '{}'::jsonb
  END;
