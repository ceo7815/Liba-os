-- LIBA Academy — training module (same project, no tenant_id).
-- All writes go through the service-role admin client.

create table if not exists public.academy_tracks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  sort_order int not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.academy_tracks (id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text not null default '',
  sort_order int not null default 0,
  version int not null default 1,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'archived')),
  pass_score int not null default 70
    check (pass_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses (id) on delete cascade,
  slug text not null,
  title text not null,
  sort_order int not null default 0,
  estimated_minutes int not null default 8,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'archived')),
  unique (course_id, slug)
);

create index if not exists academy_lessons_course_sort_idx
  on public.academy_lessons (course_id, sort_order);

create table if not exists public.academy_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.academy_lessons (id) on delete cascade,
  sort_order int not null default 0,
  kind text not null default 'text'
    check (kind in ('text', 'callout', 'todo')),
  body text not null default ''
);

create index if not exists academy_blocks_lesson_sort_idx
  on public.academy_blocks (lesson_id, sort_order);

create table if not exists public.academy_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.academy_lessons (id) on delete set null,
  topic text not null default '',
  difficulty text not null default 'easy'
    check (difficulty in ('easy', 'medium', 'hard')),
  stem text not null,
  explanation text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'archived')),
  kind text not null default 'knowledge'
    check (kind in ('knowledge', 'scenario', 'decision'))
);

create table if not exists public.academy_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.academy_questions (id) on delete cascade,
  sort_order int not null default 0,
  body text not null,
  is_correct boolean not null default false
);

create index if not exists academy_question_options_q_idx
  on public.academy_question_options (question_id, sort_order);

create table if not exists public.academy_exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses (id) on delete cascade,
  title text not null,
  kind text not null default 'course'
    check (kind in ('lesson', 'course')),
  question_count int not null default 8,
  time_limit_sec int,
  pass_score int not null default 70
    check (pass_score between 0 and 100),
  shuffle boolean not null default true
);

create table if not exists public.academy_exam_questions (
  exam_id uuid not null references public.academy_exams (id) on delete cascade,
  question_id uuid not null references public.academy_questions (id) on delete cascade,
  sort_order int not null default 0,
  primary key (exam_id, question_id)
);

create table if not exists public.academy_enrollments (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.academy_courses (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (profile_id, course_id)
);

create table if not exists public.academy_lesson_progress (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.academy_lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (profile_id, lesson_id)
);

create table if not exists public.academy_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.academy_exams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score int,
  passed boolean
);

create index if not exists academy_attempts_profile_exam_idx
  on public.academy_attempts (profile_id, exam_id, started_at desc);

create table if not exists public.academy_answers (
  attempt_id uuid not null references public.academy_attempts (id) on delete cascade,
  question_id uuid not null references public.academy_questions (id) on delete cascade,
  option_id uuid references public.academy_question_options (id) on delete set null,
  is_correct boolean not null default false,
  primary key (attempt_id, question_id)
);

create table if not exists public.academy_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  track_id uuid not null references public.academy_tracks (id) on delete cascade,
  due_at timestamptz,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, track_id)
);

do $$
declare
  t text;
begin
  foreach t in array array[
    'academy_tracks',
    'academy_courses',
    'academy_lessons',
    'academy_blocks',
    'academy_questions',
    'academy_question_options',
    'academy_exams',
    'academy_exam_questions',
    'academy_enrollments',
    'academy_lesson_progress',
    'academy_attempts',
    'academy_answers',
    'academy_assignments'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Permissions for existing users
insert into public.profile_permissions (profile_id, permission_key)
select p.id, v.permission_key
from public.profiles p
cross join (
  values
    ('academy.learn'),
    ('academy.team'),
    ('academy.manage')
) as v(permission_key)
where p.role = 'admin' and p.is_active = true
on conflict (profile_id, permission_key) do nothing;

insert into public.profile_permissions (profile_id, permission_key)
select p.id, 'academy.learn'
from public.profiles p
where p.is_active = true
  and exists (
    select 1
    from public.profile_permissions pp
    where pp.profile_id = p.id
      and pp.permission_key = 'dashboard.view'
      and pp.granted = true
  )
on conflict (profile_id, permission_key) do nothing;

-- Seed: insurance foundations track (organizational copy only; no invented insurance law)
insert into public.academy_tracks (slug, title, description, sort_order, status)
values (
  'insurance-foundations',
  'יסודות הביטוח',
  'מסלול הכניסה לסוכנות. חלק מהשיעורים מחכים לתוכן מקצועי מאושר.',
  1,
  'approved'
)
on conflict (slug) do nothing;

insert into public.academy_courses (track_id, slug, title, description, sort_order, version, status, pass_score)
select
  t.id,
  'insurance-foundations-1',
  'יסודות הביטוח — שלב א',
  '12 שיעורים. ציון עובר במבחן: 70. ההדרכה פנימית ואינה רישיון רשות שוק ההון.',
  1,
  1,
  'approved',
  70
from public.academy_tracks t
where t.slug = 'insurance-foundations'
on conflict (slug) do nothing;

insert into public.academy_lessons (course_id, slug, title, sort_order, estimated_minutes, status)
select c.id, v.slug, v.title, v.sort_order, v.mins, 'approved'
from public.academy_courses c
cross join (
  values
    ('welcome', 'מה לומדים במסלול הזה', 1, 6),
    ('agency-role', 'מהי סוכנות ביטוח ומה התפקיד שלי', 2, 8),
    ('product-map', 'סוגי מוצרים — מפת שמות', 3, 8),
    ('indemnity', 'שיפוי מול פיצוי', 4, 10),
    ('waiting-periods', 'חריגים, אכשרה והמתנה', 5, 10),
    ('beneficiaries', 'מוטבים', 6, 8),
    ('underwriting', 'הצהרת בריאות וחיתום', 7, 10),
    ('needs', 'בירור צרכים', 8, 10),
    ('portfolio', 'תיק ביטוחי', 9, 10),
    ('forms', 'טפסים ותהליך מכירה', 10, 8),
    ('liba-os', 'עבודה ב-LIBA OS', 11, 8),
    ('exam-prep', 'מבחן קצר', 12, 15)
) as v(slug, title, sort_order, mins)
where c.slug = 'insurance-foundations-1'
on conflict (course_id, slug) do nothing;

insert into public.academy_blocks (lesson_id, sort_order, kind, body)
select l.id, 1, v.kind, v.body
from public.academy_lessons l
join public.academy_courses c on c.id = l.course_id
join (
  values
    ('welcome', 'text', 'המסלול הזה מכניס אותך לסוכנות ליבה: מה לומדים, באיזה סדר, ואיך יודעים שהתקדמת.

בכל יום תראה את השיעור הבא, ואחרי השיעורים הפתוחים — מבחן קצר. ציון עובר: 70.

ההדרכה הזו פנימית לסוכנות. היא אינה תחליף להכשרה או רישיון של רשות שוק ההון.'),
    ('welcome', 'callout', 'אם שיעור מסומן «נדרש תוכן מקצועי» — אין בו עדיין הגדרה מאושרת. אל תסתמך עליו מול לקוח.'),
    ('agency-role', 'text', 'סוכנות ביטוח מחברת בין לקוח לבין חברות ביטוח. בליבה יש תפקידים שונים: מכירות, תפעול, שיווק, כספים וניהול.

התפקיד שלך במערכת מוגדר בהרשאות. מה שאתה רואה בסיידבר — זה מה שמותר לך לעבוד עליו. הדרכה פתוחה למי שקיבל הרשאת למידה, גם אם אין לו גישה לכספים או לשכר.'),
    ('agency-role', 'callout', 'אל תערבב בין לימוד לבין ביצוע. תרגול כאן לא יוצר פוליסה ולא משנה נתונים ב-LIBA OS.'),
    ('product-map', 'text', 'בסוכנות מדברים על משפחות מוצרים. בשלב זה רק שמות, בלי הגדרות משפטיות:

• ביטוח חיים
• ביטוח בריאות
• מחלות קשות
• אובדן כושר עבודה
• קרנות פנסיה
• ביטוח מנהלים
• קופות גמל

פירוט מקצועי לכל משפחה ייכתב ויאושר בנפרד.'),
    ('product-map', 'callout', 'רשימת שמות אינה ייעוץ ואינה תיאור כיסוי. אל תסביר ללקוח מוצר מתוך השיעור הזה.'),
    ('indemnity', 'todo', 'נדרש תוכן מקצועי מאושר: שיפוי מול פיצוי. אין לנסח הגדרה עד אישור SME.'),
    ('waiting-periods', 'todo', 'נדרש תוכן מקצועי מאושר: חריגים, תקופת אכשרה ותקופת המתנה.'),
    ('beneficiaries', 'todo', 'נדרש תוכן מקצועי מאושר: מוטבים.'),
    ('underwriting', 'todo', 'נדרש תוכן מקצועי מאושר: הצהרת בריאות וחיתום.'),
    ('needs', 'todo', 'נדרש תוכן מקצועי מאושר: בירור צרכים.'),
    ('portfolio', 'todo', 'נדרש תוכן מקצועי מאושר: ניתוח תיק ביטוחי.'),
    ('forms', 'todo', 'נדרש תוכן מקצועי מאושר: טפסי מכירה ותהליך תפעול. אפשר יהיה לצרף כאן צילומי מסך של טופס התפעול הקיים — בלי לצטט סעיפים שלא אושרו.'),
    ('liba-os', 'text', 'LIBA OS היא מערכת התפעול של הסוכנות, לא מערכת הלימוד.

ניווט בסיסי אחרי ההתחברות:
• מכירות — דשבורד, לפי מקור, דוח אקסל
• עובדים — כרטיסים, הסכמים, משכורות
• חשבונות — רווח והפסד, הוצאות, הסכמי חברות
• הדרכה — כאן

מה שלא מופיע אצלך בתפריט — אין לך הרשאה אליו.'),
    ('liba-os', 'callout', 'ההדרכה לא קוראת שכר, הפקות או כספת. היא רק מלמדת איפה הדברים נמצאים.'),
    ('exam-prep', 'text', 'המבחן בודק רק חומר שאושר בשיעורים הפתוחים: מבנה המסלול, תפקיד בסוכנות, מפת שמות המוצרים, וניווט ב-LIBA OS.

שיעורים שמסומנים כתוכן חסר לא נכללים במבחן.')
) as v(slug, kind, body)
  on l.slug = v.slug
where c.slug = 'insurance-foundations-1';

insert into public.academy_questions (lesson_id, topic, difficulty, stem, explanation, status, kind)
select l.id, v.topic, v.difficulty, v.stem, v.explanation, 'approved', 'knowledge'
from public.academy_lessons l
join public.academy_courses c on c.id = l.course_id
join (
  values
    ('welcome', 'מסלול', 'easy',
      'מה נכון לגבי מסלול «יסודות הביטוח» בליבה?',
      'ההדרכה פנימית. היא אינה רישיון רשות שוק ההון.',
      'ההדרכה מחליפה רישיון של רשות שוק ההון',
      'ההדרכה פנימית לסוכנות ואינה תחליף לרישיון רגולטורי',
      'אחרי המסלול אפשר לחתום פוליסות בלי הרשאות ב-LIBA OS',
      'רק מנהלים לומדים כאן'),
    ('welcome', 'מסלול', 'easy',
      'מה עושים כששיעור מסומן «נדרש תוכן מקצועי»?',
      'אין בו הגדרה מאושרת. לא מסתמכים עליו מול לקוח.',
      'משלימים בעל פה לפי מה ששמענו במשרד',
      'לא מסתמכים עליו מול לקוח עד שיש תוכן מאושר',
      'מדלגים וסוגרים כבוצע בלי לקרוא',
      'שולחים ללקוח כהסבר רשמי'),
    ('agency-role', 'סוכנות', 'easy',
      'מה מגדיר אילו מסכים רואים ב-LIBA OS?',
      'הרשאות המשתמש. התפריט מציג רק מה שמותר.',
      'כל העובדים רואים את כל המסכים',
      'הרשאות המשתמש — מה שמופיע בתפריט מותר',
      'רק מחלקת המכירות קובעת',
      'הדשבורד תמיד פתוח לכולם כולל שכר'),
    ('agency-role', 'סוכנות', 'easy',
      'תרגול בהדרכה יוצר פוליסה במערכת התפעול?',
      'לא. לימוד לא כותב למכירות, שכר או כספת.',
      'כן, תמיד',
      'לא — תרגול כאן לא יוצר פוליסה ולא משנה נתוני תפעול',
      'רק אם סיימת מבחן בציון 100',
      'כן, אחרי שיעור 11'),
    ('product-map', 'מוצרים', 'easy',
      'מה מופיע בשיעור מפת המוצרים בשלב זה?',
      'רשימת שמות משפחות בלבד, בלי הגדרות כיסוי.',
      'תנאי פוליסה מלאים לכל חברה',
      'רשימת שמות משפחות מוצרים, בלי הגדרה משפטית',
      'מחירון פרמיות',
      'הסכמי עמלות'),
    ('product-map', 'מוצרים', 'easy',
      'איזו משפחה מופיעה במפת השמות של המסלול?',
      'בין השמות: ביטוח חיים, בריאות, מחלות קשות, אכ"ע, פנסיה, מנהלים, גמל.',
      'רק ביטוח רכב',
      'ביטוח חיים (בין השאר)',
      'רק קופות גמל להשקעה של בנק',
      'אין במפה שמות מוצרים'),
    ('liba-os', 'מערכת', 'easy',
      'איפה ב-LIBA OS רואים רווח והפסד?',
      'באזור חשבונות — לא באזור ההדרכה.',
      'רק במסך ההדרכה',
      'באזור חשבונות (רווח והפסד)',
      'בכספת הסיסמאות',
      'בסוכן הרשתות החברתיות'),
    ('liba-os', 'מערכת', 'easy',
      'מה נכון על הקשר בין הדרכה לבין שכר והפקות?',
      'ההדרכה לא קוראת ולא כותבת שכר, הפקות או כספת.',
      'ההדרכה מעדכנת משכורת לפי ציון',
      'ההדרכה לא קוראת שכר, הפקות או כספת',
      'כל שיעור סוגר הפקה באקסל',
      'ציון נכשל מוחק הרשאות כספים')
) as v(slug, topic, difficulty, stem, explanation, wrong1, correct, wrong2, wrong3)
  on l.slug = v.slug
where c.slug = 'insurance-foundations-1';

insert into public.academy_question_options (question_id, sort_order, body, is_correct)
select q.id, o.sort_order, o.body, o.is_correct
from public.academy_questions q
join (
  values
    ('מה נכון לגבי מסלול «יסודות הביטוח» בליבה?', 1, 'ההדרכה מחליפה רישיון של רשות שוק ההון', false),
    ('מה נכון לגבי מסלול «יסודות הביטוח» בליבה?', 2, 'ההדרכה פנימית לסוכנות ואינה תחליף לרישיון רגולטורי', true),
    ('מה נכון לגבי מסלול «יסודות הביטוח» בליבה?', 3, 'אחרי המסלול אפשר לחתום פוליסות בלי הרשאות ב-LIBA OS', false),
    ('מה נכון לגבי מסלול «יסודות הביטוח» בליבה?', 4, 'רק מנהלים לומדים כאן', false),
    ('מה עושים כששיעור מסומן «נדרש תוכן מקצועי»?', 1, 'משלימים בעל פה לפי מה ששמענו במשרד', false),
    ('מה עושים כששיעור מסומן «נדרש תוכן מקצועי»?', 2, 'לא מסתמכים עליו מול לקוח עד שיש תוכן מאושר', true),
    ('מה עושים כששיעור מסומן «נדרש תוכן מקצועי»?', 3, 'מדלגים וסוגרים כבוצע בלי לקרוא', false),
    ('מה עושים כששיעור מסומן «נדרש תוכן מקצועי»?', 4, 'שולחים ללקוח כהסבר רשמי', false),
    ('מה מגדיר אילו מסכים רואים ב-LIBA OS?', 1, 'כל העובדים רואים את כל המסכים', false),
    ('מה מגדיר אילו מסכים רואים ב-LIBA OS?', 2, 'הרשאות המשתמש — מה שמופיע בתפריט מותר', true),
    ('מה מגדיר אילו מסכים רואים ב-LIBA OS?', 3, 'רק מחלקת המכירות קובעת', false),
    ('מה מגדיר אילו מסכים רואים ב-LIBA OS?', 4, 'הדשבורד תמיד פתוח לכולם כולל שכר', false),
    ('תרגול בהדרכה יוצר פוליסה במערכת התפעול?', 1, 'כן, תמיד', false),
    ('תרגול בהדרכה יוצר פוליסה במערכת התפעול?', 2, 'לא — תרגול כאן לא יוצר פוליסה ולא משנה נתוני תפעול', true),
    ('תרגול בהדרכה יוצר פוליסה במערכת התפעול?', 3, 'רק אם סיימת מבחן בציון 100', false),
    ('תרגול בהדרכה יוצר פוליסה במערכת התפעול?', 4, 'כן, אחרי שיעור 11', false),
    ('מה מופיע בשיעור מפת המוצרים בשלב זה?', 1, 'תנאי פוליסה מלאים לכל חברה', false),
    ('מה מופיע בשיעור מפת המוצרים בשלב זה?', 2, 'רשימת שמות משפחות מוצרים, בלי הגדרה משפטית', true),
    ('מה מופיע בשיעור מפת המוצרים בשלב זה?', 3, 'מחירון פרמיות', false),
    ('מה מופיע בשיעור מפת המוצרים בשלב זה?', 4, 'הסכמי עמלות', false),
    ('איזו משפחה מופיעה במפת השמות של המסלול?', 1, 'רק ביטוח רכב', false),
    ('איזו משפחה מופיעה במפת השמות של המסלול?', 2, 'ביטוח חיים (בין השאר)', true),
    ('איזו משפחה מופיעה במפת השמות של המסלול?', 3, 'רק קופות גמל להשקעה של בנק', false),
    ('איזו משפחה מופיעה במפת השמות של המסלול?', 4, 'אין במפה שמות מוצרים', false),
    ('איפה ב-LIBA OS רואים רווח והפסד?', 1, 'רק במסך ההדרכה', false),
    ('איפה ב-LIBA OS רואים רווח והפסד?', 2, 'באזור חשבונות (רווח והפסד)', true),
    ('איפה ב-LIBA OS רואים רווח והפסד?', 3, 'בכספת הסיסמאות', false),
    ('איפה ב-LIBA OS רואים רווח והפסד?', 4, 'בסוכן הרשתות החברתיות', false),
    ('מה נכון על הקשר בין הדרכה לבין שכר והפקות?', 1, 'ההדרכה מעדכנת משכורת לפי ציון', false),
    ('מה נכון על הקשר בין הדרכה לבין שכר והפקות?', 2, 'ההדרכה לא קוראת שכר, הפקות או כספת', true),
    ('מה נכון על הקשר בין הדרכה לבין שכר והפקות?', 3, 'כל שיעור סוגר הפקה באקסל', false),
    ('מה נכון על הקשר בין הדרכה לבין שכר והפקות?', 4, 'ציון נכשל מוחק הרשאות כספים', false)
) as o(stem, sort_order, body, is_correct)
  on q.stem = o.stem;

insert into public.academy_exams (course_id, title, kind, question_count, pass_score, shuffle)
select
  c.id,
  'מבחן קצר — יסודות הביטוח שלב א',
  'course',
  8,
  70,
  true
from public.academy_courses c
where c.slug = 'insurance-foundations-1'
  and not exists (
    select 1 from public.academy_exams e where e.course_id = c.id
  );

insert into public.academy_exam_questions (exam_id, question_id, sort_order)
select e.id, q.id, row_number() over (order by q.stem)
from public.academy_exams e
join public.academy_courses c on c.id = e.course_id
join public.academy_questions q on q.status = 'approved'
where c.slug = 'insurance-foundations-1';

comment on table public.academy_tracks is 'Academy learning tracks (Liba internal)';
comment on table public.academy_courses is 'Academy courses under a track';
comment on table public.academy_lessons is 'Academy lessons';
