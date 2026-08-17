# ליבה OS — פלטפורמת ניהול פנימית

מעטפת פנימית לסוכנות ליבה ביטוח ופנסיוני: התחברות, ניהול משתמשים, סיידבר וניווט. סוכני AI יתווספו בהמשך דרך `lib/agents.config.ts`.

## דרישות מקדימות

- Node.js 20+
- חשבון Supabase (הפרויקט `liba-os` כבר נוצר באזור Frankfurt)

## משתני סביבה

העתיקו את `.env.example` ל-`.env.local` (פיתוח) או ל-`.env` (Docker):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=
```

| משתנה | איפה | הערות |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | דפדפן + שרת | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | דפדפן + שרת | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **שרת בלבד** | אסור לחשוף ללקוח. נדרש להזמנות, שינוי תפקיד והשבתה |
| `VAULT_ENCRYPTION_KEY` | **שרת בלבד** | מפתח AES-256 (base64, 32 בתים) לכספת הסיסמאות |
| `NEXT_PUBLIC_SITE_URL` | דפדפן + שרת | כתובת האפליקציה, למשל `http://localhost:3000` |

מפתחות: [Settings → API](https://supabase.com/dashboard/project/cuqaftpkcdxtjogiyqtu/settings/api)

## הגדרות Auth ב-Supabase (חובה)

1. **כיבוי הרשמה ציבורית** — Authentication → Providers → Email → כבו את "Allow new users to sign up".
2. **Site URL** — Authentication → URL Configuration → `http://localhost:3000` (ובפרודקשן הדומיין של ה-VPS).
3. **Redirect URLs** הוסיפו:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/set-password`
   - `http://localhost:3000/**`

## הרצה מקומית

```bash
npm install
npm run dev
```

האפליקציה: [http://localhost:3000](http://localhost:3000)

המשתמש הראשון שמוזמן הופך אוטומטית ל-admin. הזמינו אותו ממסך המשתמשים אחרי שתדביקו את `SUPABASE_SERVICE_ROLE_KEY`, או צרו משתמש ב-Supabase Dashboard ואז עדכנו:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Docker על VPS

```bash
cp .env.example .env
# מלאו מפתחות. NEXT_PUBLIC_SITE_URL = כתובת השרת הציבורית
docker compose up -d --build
```

`NEXT_PUBLIC_*` נדרשים גם בזמן **build** (מועברים כ-build args) וגם בזמן ריצה. `SUPABASE_SERVICE_ROLE_KEY` נדרש רק בזמן ריצה.

## הוספת סוכן AI

1. הוסיפו שורה ב-`lib/agents.config.ts`.
2. צרו `app/(authenticated)/agents/<slug>/page.tsx`.
3. הסוכן יופיע בסיידבר וברשימת `/agents`.
