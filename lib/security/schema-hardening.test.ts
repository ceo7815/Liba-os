import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function sql(name: string): string {
  return readFileSync(`supabase/migrations/${name}`, "utf8");
}

const MUTABLE_FUNCTIONS = [
  "public.finance_entries_require_salary_assignment()",
  "public.finance_entries_set_updated_at()",
  "public.finance_fixed_costs_set_updated_at()",
  "public.keep_one_voicenter_push_run()",
  "public.social_posts_guard_approved()",
  "public.social_posts_set_updated_at()",
  "public.social_settings_set_updated_at()",
  "public.touch_calls_updated_at()",
  "public.vault_entries_set_search_text()",
];

const DENY_TABLES = [
  "academy_answers",
  "academy_assignments",
  "academy_attempts",
  "academy_blocks",
  "academy_courses",
  "academy_enrollments",
  "academy_exam_questions",
  "academy_exams",
  "academy_lesson_progress",
  "academy_lessons",
  "academy_question_options",
  "academy_questions",
  "academy_tracks",
  "agent_api_keys",
  "voicenter_cdr_receipts",
  "voicenter_cdr_webhook",
];

test("the nine functions get the search_path already used in production", () => {
  const text = sql("20261030120000_function_search_path.sql");
  assert.equal(MUTABLE_FUNCTIONS.length, 9);
  for (const fn of MUTABLE_FUNCTIONS) {
    assert.match(text, new RegExp(fn.replace(/[()]/g, "\\$&")));
  }
  assert.match(text, /SET search_path = public, pg_temp/);
  assert.match(text, /to_regprocedure/);
  assert.doesNotMatch(text, /\b(INSERT INTO|UPDATE public|DELETE FROM)\b/i);
});

test("only the uncovered social queue foreign key is indexed", () => {
  const text = sql("20261030121000_hot_fk_indexes.sql");
  assert.match(
    text,
    /CREATE INDEX IF NOT EXISTS social_publish_queue_post_id_idx\s+ON public\.social_publish_queue \(post_id\);/,
  );
  assert.equal(text.match(/CREATE INDEX/g)?.length, 1);
});

test("RLS policies wrap auth.uid() once per query", () => {
  const text = sql("20261030122000_rls_initplan.sql");
  assert.match(text, /profile_id = \(SELECT auth\.uid\(\)\)/);
  assert.match(text, /p\.id = \(SELECT auth\.uid\(\)\)/);
  assert.match(text, /website_leads_staff_select/);
  assert.doesNotMatch(text, /profile_id = auth\.uid\(\)/);
  assert.doesNotMatch(text, /p\.id = auth\.uid\(\)/);
});

test("RLS tables without policies get an explicit client deny", () => {
  const text = sql("20261030123000_rls_explicit_deny.sql");
  assert.equal(DENY_TABLES.length, 16);
  for (const table of DENY_TABLES) {
    assert.match(text, new RegExp(`'${table}'`));
  }
  assert.match(text, /USING \(false\) WITH CHECK \(false\)/);
  assert.match(text, /TO anon, authenticated/);
  assert.doesNotMatch(text, /TO service_role/);
  assert.doesNotMatch(text, /\b(INSERT INTO|UPDATE public|DELETE FROM)\b/i);
});
