import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AcademyBlock,
  AcademyCourse,
  AcademyExam,
  AcademyLesson,
  AcademyQuestion,
} from "@/lib/academy/types";

type TrackRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  sort_order: number;
  status: AcademyCourse["status"];
};

type CourseRow = {
  id: string;
  track_id: string;
  slug: string;
  title: string;
  description: string;
  sort_order: number;
  version: number;
  status: AcademyCourse["status"];
  pass_score: number;
};

type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  sort_order: number;
  estimated_minutes: number;
  status: AcademyLesson["status"];
};

function mapCourse(row: CourseRow): AcademyCourse {
  return {
    id: row.id,
    trackId: row.track_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    version: row.version,
    status: row.status,
    passScore: row.pass_score,
  };
}

function mapLesson(row: LessonRow): AcademyLesson {
  return {
    id: row.id,
    courseId: row.course_id,
    slug: row.slug,
    title: row.title,
    sortOrder: row.sort_order,
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAcademyId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function academyAdmin() {
  return createAdminClient();
}

export function mapTrack(row: TrackRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    status: row.status,
  };
}

export { mapCourse, mapLesson };

export async function fetchApprovedCourses() {
  const admin = academyAdmin();
  const { data, error } = await admin
    .from("academy_courses")
    .select("id, track_id, slug, title, description, sort_order, version, status, pass_score")
    .eq("status", "approved")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapCourse(row as CourseRow));
}

export async function fetchCourseById(id: string, approvedOnly = true) {
  if (!isAcademyId(id)) return null;
  const admin = academyAdmin();
  let query = admin
    .from("academy_courses")
    .select("id, track_id, slug, title, description, sort_order, version, status, pass_score")
    .eq("id", id);
  if (approvedOnly) query = query.eq("status", "approved");
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapCourse(data as CourseRow) : null;
}

export async function fetchTrackTitle(trackId: string) {
  const admin = academyAdmin();
  const { data } = await admin
    .from("academy_tracks")
    .select("title")
    .eq("id", trackId)
    .maybeSingle();
  return data?.title ?? null;
}

export async function fetchLessons(
  courseId: string,
  options: { approvedOnly?: boolean } = {},
) {
  if (!isAcademyId(courseId)) return [];
  const approvedOnly = options.approvedOnly !== false;
  const admin = academyAdmin();
  let query = admin
    .from("academy_lessons")
    .select("id, course_id, slug, title, sort_order, estimated_minutes, status")
    .eq("course_id", courseId);
  if (approvedOnly) {
    query = query.eq("status", "approved");
  } else {
    query = query.neq("status", "archived");
  }
  const { data, error } = await query.order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapLesson(row as LessonRow));
}

export async function fetchLessonById(id: string, approvedOnly = true) {
  if (!isAcademyId(id)) return null;
  const admin = academyAdmin();
  let query = admin
    .from("academy_lessons")
    .select("id, course_id, slug, title, sort_order, estimated_minutes, status")
    .eq("id", id);
  if (approvedOnly) query = query.eq("status", "approved");
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapLesson(data as LessonRow) : null;
}

export async function fetchBlocks(lessonId: string): Promise<AcademyBlock[]> {
  if (!isAcademyId(lessonId)) return [];
  const admin = academyAdmin();
  const { data, error } = await admin
    .from("academy_blocks")
    .select("id, lesson_id, sort_order, kind, body")
    .eq("lesson_id", lessonId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    lessonId: row.lesson_id,
    sortOrder: row.sort_order,
    kind: row.kind,
    body: row.body,
  }));
}

function mapExam(data: {
  id: string;
  course_id: string;
  title: string;
  kind: AcademyExam["kind"];
  question_count: number;
  time_limit_sec: number | null;
  pass_score: number;
  shuffle: boolean;
}): AcademyExam {
  return {
    id: data.id,
    courseId: data.course_id,
    title: data.title,
    kind: data.kind,
    questionCount: data.question_count,
    timeLimitSec: data.time_limit_sec,
    passScore: data.pass_score,
    shuffle: data.shuffle,
  };
}

export async function fetchCourseExam(courseId: string): Promise<AcademyExam | null> {
  if (!isAcademyId(courseId)) return null;
  const admin = academyAdmin();
  const { data, error } = await admin
    .from("academy_exams")
    .select("id, course_id, title, kind, question_count, time_limit_sec, pass_score, shuffle")
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapExam(data) : null;
}

export async function fetchExamById(id: string): Promise<AcademyExam | null> {
  if (!isAcademyId(id)) return null;
  const admin = academyAdmin();
  const { data, error } = await admin
    .from("academy_exams")
    .select("id, course_id, title, kind, question_count, time_limit_sec, pass_score, shuffle")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapExam(data) : null;
}

export async function fetchCompletedLessonIds(profileId: string, lessonIds: string[]) {
  if (!isAcademyId(profileId) || lessonIds.length === 0) return new Set<string>();
  const safeIds = lessonIds.filter((id) => isAcademyId(id));
  if (safeIds.length === 0) return new Set<string>();
  const admin = academyAdmin();
  const { data, error } = await admin
    .from("academy_lesson_progress")
    .select("lesson_id")
    .eq("profile_id", profileId)
    .in("lesson_id", safeIds);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => String(row.lesson_id)));
}

export async function fetchLastAttempt(profileId: string, examId: string) {
  if (!isAcademyId(profileId) || !isAcademyId(examId)) return null;
  const admin = academyAdmin();
  const { data } = await admin
    .from("academy_attempts")
    .select("score, passed, submitted_at")
    .eq("profile_id", profileId)
    .eq("exam_id", examId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    score: data.score as number | null,
    passed: data.passed as boolean | null,
  };
}

export async function fetchExamQuestions(examId: string): Promise<AcademyQuestion[]> {
  if (!isAcademyId(examId)) return [];
  const admin = academyAdmin();
  const { data: links, error: linkError } = await admin
    .from("academy_exam_questions")
    .select("question_id, sort_order")
    .eq("exam_id", examId)
    .order("sort_order", { ascending: true });
  if (linkError) throw new Error(linkError.message);
  const ids = (links ?? []).map((row) => String(row.question_id));
  if (ids.length === 0) return [];

  const { data: questions, error: qError } = await admin
    .from("academy_questions")
    .select("id, lesson_id, topic, difficulty, stem, explanation, status, kind")
    .eq("status", "approved")
    .in("id", ids);
  if (qError) throw new Error(qError.message);

  const { data: options, error: oError } = await admin
    .from("academy_question_options")
    .select("id, question_id, sort_order, body, is_correct")
    .in("question_id", ids)
    .order("sort_order", { ascending: true });
  if (oError) throw new Error(oError.message);

  const byQuestion = new Map<string, AcademyQuestion["options"]>();
  for (const opt of options ?? []) {
    const list = byQuestion.get(opt.question_id) ?? [];
    list.push({
      id: opt.id,
      questionId: opt.question_id,
      sortOrder: opt.sort_order,
      body: opt.body,
      isCorrect: Boolean(opt.is_correct),
    });
    byQuestion.set(opt.question_id, list);
  }

  const order = new Map(ids.map((id, index) => [id, index]));
  return (questions ?? [])
    .map((row) => ({
      id: row.id,
      lessonId: row.lesson_id,
      topic: row.topic,
      difficulty: row.difficulty,
      stem: row.stem,
      explanation: row.explanation,
      status: row.status,
      kind: row.kind,
      options: byQuestion.get(row.id) ?? [],
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function fetchLessonQuestions(lessonId: string): Promise<AcademyQuestion[]> {
  if (!isAcademyId(lessonId)) return [];
  const admin = academyAdmin();
  const { data: questions, error: qError } = await admin
    .from("academy_questions")
    .select("id, lesson_id, topic, difficulty, stem, explanation, status, kind")
    .eq("lesson_id", lessonId)
    .eq("status", "approved")
    .order("stem", { ascending: true });
  if (qError) throw new Error(qError.message);
  const ids = (questions ?? []).map((row) => String(row.id));
  if (ids.length === 0) return [];

  const { data: options, error: oError } = await admin
    .from("academy_question_options")
    .select("id, question_id, sort_order, body, is_correct")
    .in("question_id", ids)
    .order("sort_order", { ascending: true });
  if (oError) throw new Error(oError.message);

  const byQuestion = new Map<string, AcademyQuestion["options"]>();
  for (const opt of options ?? []) {
    const list = byQuestion.get(opt.question_id) ?? [];
    list.push({
      id: opt.id,
      questionId: opt.question_id,
      sortOrder: opt.sort_order,
      body: opt.body,
      isCorrect: Boolean(opt.is_correct),
    });
    byQuestion.set(opt.question_id, list);
  }

  return (questions ?? []).map((row) => ({
    id: row.id,
    lessonId: row.lesson_id,
    topic: row.topic,
    difficulty: row.difficulty,
    stem: row.stem,
    explanation: row.explanation,
    status: row.status,
    kind: row.kind,
    options: byQuestion.get(row.id) ?? [],
  }));
}

export async function fetchQuestionById(id: string): Promise<AcademyQuestion | null> {
  if (!isAcademyId(id)) return null;
  const admin = academyAdmin();
  const { data, error } = await admin
    .from("academy_questions")
    .select("id, lesson_id, topic, difficulty, stem, explanation, status, kind")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { data: options, error: oError } = await admin
    .from("academy_question_options")
    .select("id, question_id, sort_order, body, is_correct")
    .eq("question_id", data.id)
    .order("sort_order", { ascending: true });
  if (oError) throw new Error(oError.message);
  return {
    id: data.id,
    lessonId: data.lesson_id,
    topic: data.topic,
    difficulty: data.difficulty,
    stem: data.stem,
    explanation: data.explanation,
    status: data.status,
    kind: data.kind,
    options: (options ?? []).map((opt) => ({
      id: opt.id,
      questionId: opt.question_id,
      sortOrder: opt.sort_order,
      body: opt.body,
      isCorrect: Boolean(opt.is_correct),
    })),
  };
}

export function shuffleInPlace<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
