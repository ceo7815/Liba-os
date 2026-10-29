-- DEV ONLY. Demo rows for a local Shemesh database. Do not run in production.
-- Amounts here are fake and exist only so screens can be reviewed.

INSERT INTO public.shemesh_fee_settings (id, redemption_fee_rate, tax_fee_rate, vat_rate, sla_days)
VALUES (1, 0.15, 0.10, 0.18, 7)
ON CONFLICT (id) DO UPDATE SET
  redemption_fee_rate = EXCLUDED.redemption_fee_rate,
  tax_fee_rate = EXCLUDED.tax_fee_rate,
  vat_rate = EXCLUDED.vat_rate,
  sla_days = EXCLUDED.sla_days;

INSERT INTO public.shemesh_cases (id, client_name, phone, stage, status, handler, opened_on, deadline, notes)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'מיכל כהן', '050-1000001', 'documents', 'open', 'מתן בריזלי', '2026-10-01', '2026-10-08', 'חסר טופס 106'),
  ('22222222-2222-4222-8222-222222222222', 'אורן דהן', '050-1000002', 'filed', 'waiting', 'לירון כהן', '2026-10-20', '2026-11-10', 'הוגש למס הכנסה'),
  ('33333333-3333-4333-8333-333333333333', 'נועה ברק', '050-1000003', 'collected', 'done', 'רועי אזולאי', '2026-09-02', '2026-09-20', 'נגבה'),
  ('44444444-4444-4444-8444-444444444444', 'רן מזרחי', '050-1000004', 'lead', 'open', 'אגם פרץ', '2026-10-28', '2026-11-04', 'שיחה ראשונה')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_case_tasks (id, case_id, title, assignee, due_on, status)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'לאסוף טופס 106', 'מתן בריזלי', '2026-10-06', 'open'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '22222222-2222-4222-8222-222222222222', 'לעקוב אחרי הקבלה', 'לירון כהן', '2026-11-02', 'open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_case_documents (id, case_id, label, required, received)
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', '11111111-1111-4111-8111-111111111111', 'תעודת זהות', true, true),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '11111111-1111-4111-8111-111111111111', 'טופס 106', true, false),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', '22222222-2222-4222-8222-222222222222', 'ייפוי כוח', true, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_case_notes (id, case_id, body, author)
VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '11111111-1111-4111-8111-111111111111', 'הלקוחה ביקשה לחזור ביום ראשון', 'מתן בריזלי')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_audit (id, actor, action, entity, entity_id, summary)
VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'הדגמה', 'create', 'case', '11111111-1111-4111-8111-111111111111', 'נפתח תיק למיכל כהן')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_ledger (id, kind, client_name, day, gross, fee_rate, fee, net, status, notes)
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'redemption', 'מיכל כהן', '2026-10-12', 10000, 0.15, 1500, 8500, 'open', 'הדגמה'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'tax_refund', 'נועה ברק', '2026-10-18', 4000, 0.10, 400, 3600, 'done', 'הדגמה')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_rules (id, kind, title, amount, cadence, day_of_month, starts_on, active, notes)
VALUES
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'cost', 'שכירות משרד', 8000, 'monthly', 1, '2026-01-01', true, 'הדגמה'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff2', 'cost', 'תוכנה', 450, 'monthly', 1, '2026-01-01', true, 'הדגמה'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff3', 'income', 'החזרי מס שנגבו', 12000, 'monthly', 5, '2026-01-01', true, 'הדגמה'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff4', 'payroll', 'שכר צוות', 9000, 'monthly', 1, '2026-01-01', true, 'הדגמה'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff5', 'commission', 'עמלת מטפל', 1800, 'monthly', 10, '2026-01-01', true, 'הדגמה'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff6', 'debt', 'הלוואת ציוד', 2500, 'monthly', 15, '2026-01-01', true, 'הדגמה')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_facebook_settings (id, ad_account_id, access_token_encrypted, connected_name, last_synced_at)
VALUES (1, '2542541459538449', 'demo-not-a-secret', 'שמש הדגמה', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_google_settings (id, customer_id, login_customer_id, refresh_token_encrypted, connected_email, candidate_customers, last_synced_at)
VALUES (1, '1111111111', '2888742858', 'demo-not-a-secret', 'demo@example.com', '["1111111111","2222222222"]'::jsonb, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_excel_settings (id, file_name, last_synced_at)
VALUES (1, 'דוח מכירות שמש פדיונות 2', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_surense_settings (id, mode, last_synced_at)
VALUES (1, 'same', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shemesh_provider_secrets (provider, api_url, secret_encrypted, last_checked_at)
VALUES
  ('rivhit', 'https://demo.invalid/rivhit', 'demo-not-a-secret', now()),
  ('grow', 'https://demo.invalid/grow', 'demo-not-a-secret', now()),
  ('insurance', 'https://demo.invalid/insurance', NULL, NULL)
ON CONFLICT (provider) DO NOTHING;
