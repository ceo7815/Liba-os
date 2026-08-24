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
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | **שרת בלבד** | אפליקציית Graph לדשבורד המכירות |
| `SALES_EXCEL_DRIVE_ID` + `SALES_EXCEL_ITEM_ID` | **שרת בלבד** | קובץ האקסל ב-OneDrive/SharePoint |
| `SALES_TV_KIOSK_TOKEN` | **שרת בלבד** | טוקן לכתובת הטלוויזיה `/sales-tv?token=` |

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

`NEXT_PUBLIC_*` נדרשים גם בזמן **build** (מועברים כ-build args) וגם בזמן ריצה. `SUPABASE_SERVICE_ROLE_KEY` ו-`VAULT_ENCRYPTION_KEY` נדרשים בזמן ריצה.

## פריסה ב-xCloud (Docker + Nginx)

השרת **Liba Insurance** כבר על סטאק Docker + Nginx. הפריסה היא מ-Git, לא מהעלאת קבצים.

1. ב-xCloud חברו GitHub של **ceo7815** (לא titatu-agents / Hub).
2. New Site → Deploy via Git / Docker Compose From Git.
3. ריפו: `ceo7815/Liba-os`, ענף: `main`.
4. Composer File Name: `docker-compose.yml`.
5. Auto-Detect Ports → Primary Service Port: **3000**.
6. Environment File — הדביקו ערכים אמיתיים (לא מהדוגמה):

```
NEXT_PUBLIC_SUPABASE_URL=https://cuqaftpkcdxtjogiyqtu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://YOUR_DOMAIN
SUPABASE_SERVICE_ROLE_KEY=
VAULT_ENCRYPTION_KEY=
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
SALES_EXCEL_DRIVE_ID=
SALES_EXCEL_ITEM_ID=
SALES_TV_KIOSK_TOKEN=
```

`NEXT_PUBLIC_SITE_URL` חייב להיות הכתובת הציבורית המדויקת (דומיין xCloud או דומיין שלכם), כולל `https://`.

ב-Supabase → Authentication → URL Configuration הוסיפו את אותה כתובת ל-Site URL ול-Redirect URLs (`/auth/callback`, `/set-password`, `/**`).

## הוספת סוכן AI

1. הוסיפו שורה ב-`lib/agents.config.ts`.
2. צרו `app/(authenticated)/agents/<slug>/page.tsx`.
3. הסוכן יופיע בסיידבר וברשימת `/agents`.

## דשבורד מכירות (TV + OneDrive)

מסך מלא ב-`/sales-tv?token=...` (קיוסק למשרד) ותצוגה מקדימה למנהלים ב-`/sales-dashboard`.

1. הרשימו אפליקציה ב-Azure AD של טננט הסוכנות (client credentials).
2. הרשאה: `Sites.Selected` (מומלץ) או `Files.Read.All`, עם הסכמת אדמין.
3. מלאו ב-env: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `SALES_EXCEL_DRIVE_ID`, ו-`SALES_EXCEL_ITEM_ID` או `SALES_EXCEL_FILE_PATH`.
4. צרו `SALES_TV_KIOSK_TOKEN` ארוך ואקראי. בטלוויזיה פתחו Chrome/Edge ל-`https://YOUR_DOMAIN/sales-tv?token=...`.
5. בלי Graph מוגדר המסך מציג נתוני הדגמה. העובדת חייבת לשמור את האקסל; הרענון הוא כ-30 שניות.

כותרות חובה בגיליון הראשון: `סטאטוס פוליסה`, `פרמיה`, `סוג תהליך`, `תאריך העברה ליצרן`, `תאריך תחילת ביטוח`, `שם לקוח`, `משווק`, `סוג המוצר`, `חברת הביטוח`, `מקור הפנייה`.
