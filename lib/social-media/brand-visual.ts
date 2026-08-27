/**
 * Two separate brand memories for image gen — do not merge them:
 *
 * 1) Logo = official file only (`public/brand/liba-logo.png`)
 *    Small flat 2D mark in a corner. Never “integrate the shield into the scene”.
 *    Never a 3D shield in hands.
 *
 * 2) Visual language = photography like liba-fs.co.il
 *    Daylight, cream, human; navy + coral-red accent.
 *    Not dark “AI finance”. Not Liba OS yellow.
 */

export const LIBA_LOGO_FILE = "/brand/liba-logo.png" as const;

export const LIBA_LOGO_SPEC = {
  file: LIBA_LOGO_FILE,
  mark:
    "Official 2D Liba wordmark from the attached PNG only: red shield with two white hands holding a heart, Hebrew ליבה, subtitle ביטוח ופיננסים in charcoal. Flat graphic sticker, not a 3D object.",
  placement:
    "Small, quiet, lower corner (prefer lower-start in RTL), overlaid on the photograph itself — never on an empty padded margin. Do not crop, recolor, glow, extrude, or invent a new mark.",
  never:
    "Never integrate the shield into the scene as a prop. Never a giant glowing shield. Never a 3D badge people hold. Never a second invented logo. Never rebuild the mark from memory — only the attached file.",
} as const;

/** Matches liba-fs.co.il (Rubik, cream, navy, coral-red accent) — not Liba OS yellow. */
export const DEFAULT_VISUAL_LANGUAGE = `שפת עיצוב ליבה (אתר liba-fs.co.il) — לא הלוגו:

כן:
- צילום אנושי ישראלי באור יום טבעי: משפחה, הורים וילדים, שיחה שקטה, בית או משרד בהיר
- רקע בהיר: קרם / אוף-וויט / חם (#F7F4EE), לא שחור, לא ניאון
- צבעי אתר: נייבי עמוק, קרם, אדום-קורל לנקודת דגש קטנה בלבד — לא שליטה על כל הפריים
- אווירה רגועה, שקופה, מקצועית; צילום מלא עד קצוות הפריים, בלי מסגרת ובלי שוליים ריקים
- אם יש טקסט על התמונה: עברית RTL, Rubik, כותרת קצרה + כמה מילים בלבד — לא פסקה. לפעמים יישור ימין, לפעמים ממורכז (לא שמאל כמו אנגלית)

לא (זה נראה כמו «AI פיננסים» ולא כמו ליבה):
- סצנה קולנועית חשוכה, קונטרסט דרמטי, זוהר אדום
- מגן / לב / ידיים כאובייקט תלת-ממד שמוחזק בידיים או «משולב בסצנה»
- אייקונים מרחפים, גרפים זוהרים, HUD, כובע סיום, עפיפון, אופניים כקווי מתאר
- לוגו ענק, חותמת פינה גסה, או המצאת סימן חדש
- צהוב של Liba OS — זה צבע המערכת הפנימית, לא המותג הציבורי`;

/** English hard rules sent to the image model (logo ≠ visual language). */
export const IMAGE_PROMPT_VISUAL_EN = `
DESIGN LANGUAGE (this is NOT the logo — it is how the photo looks):
Israeli professional-family brand like liba-fs.co.il. Bright natural daylight. Cream / off-white / warm interiors. Calm documentary photography of real people. Navy and warm neutrals. Coral-red only as a tiny accent. Full-bleed: subject and scenery reach all four edges. No letterbox, no frame, no padded poster. Quiet, human, trustworthy. If type: Hebrew RTL, Rubik-like, headline + a few words only — never a paragraph. Alternate right-aligned RTL and centered RTL. Never English left-align.

LOGO (separate from design language — attached PNG only):
Use the attached official Liba PNG as a small flat 2D wordmark in a quiet corner. Copy it exactly. Do not extrude it. Do not integrate the shield into the scene. Do not make anyone hold a shield. Do not invent icons from the logo.

FORBIDDEN LOOK:
Dark cinematic lighting, glowing 3D shield, neon charts, floating line-art icons, sci-fi HUD, stock "AI finance" aesthetic, yellow Liba OS chrome, giant logo stamp.
`.trim();
