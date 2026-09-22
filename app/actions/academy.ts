"use server";

import { revalidatePath } from "next/cache";
import {
  requireAcademyAccess,
  requireAcademyLearn,
  requireAcademyManage,
  requireAcademyTeam,
} from "@/lib/auth";
import {
  canLearnAcademy,
  canManageAcademy,
  canViewAcademyTeam,
} from "@/lib/academy/access";
import {
  academyAdmin,
  fetchApprovedCourses,
  fetchBlocks,
  fetchCompletedLessonIds,
  fetchCourseById,
  fetchCourseExam,
  fetchExamById,
  fetchExamQuestions,
  fetchLastAttempt,
  fetchLessonById,
  fetchLessonQuestions,
  fetchLessons,
  fetchQuestionById,
  fetchTrackTitle,
  isAcademyId,
  shuffleInPlace,
} from "@/lib/academy/catalog";
import type {
  AcademyCourseCard,
  AcademyCourseDetail,
  AcademyDashboard,
  AcademyExamResult,
  AcademyExamView,
  AcademyLessonDetail,
  AcademyManageLesson,
  AcademyTeamRow,
} from "@/lib/academy/types";

const BLOCK_BODY_MAX = 20_000;

function firstName(fullName: string, email: string) {
  const fromName = fullName.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  return email.split("@")[0] || "שלום";
}

async function ensureEnrollment(profileId: string, courseId: string) {
  const admin = academyAdmin();
  const { error } = await admin.from("academy_enrollments").upsert(
    { profile_id: profileId, course_id: courseId },
    { onConflict: "profile_id,course_id" },
  );
  if (error) throw new Error(error.message);
}

export async function getMyAcademyDashboard(): Promise<
  { ok: true; data: AcademyDashboard } | { ok: false; error: string }
> {
  try {
    const profile = await requireAcademyAccess();
    const canLearn = canLearnAcademy(profile);
    const empty = {
      firstName: firstName(profile.full_name, profile.email),
      course: null,
      trackTitle: null,
      lessonCount: 0,
      completedCount: 0,
      percent: 0,
      nextLesson: null,
      exam: null,
      lastScore: null,
      lastPassed: null,
      canLearn,
      canViewTeam: canViewAcademyTeam(profile),
      canManage: canManageAcademy(profile),
      stations: [],
    } satisfies AcademyDashboard;

    if (!canLearn) {
      return { ok: true, data: empty };
    }

    const courses = await fetchApprovedCourses();
    const course = courses[0] ?? null;
    if (!course) {
      return { ok: true, data: empty };
    }

    await ensureEnrollment(profile.id, course.id);
    const [lessons, exam, trackTitle] = await Promise.all([
      fetchLessons(course.id),
      fetchCourseExam(course.id),
      fetchTrackTitle(course.trackId),
    ]);
    const completed = await fetchCompletedLessonIds(
      profile.id,
      lessons.map((lesson) => lesson.id),
    );
    const nextLesson = lessons.find((lesson) => !completed.has(lesson.id)) ?? null;
    const last = exam ? await fetchLastAttempt(profile.id, exam.id) : null;
    const completedCount = completed.size;
    const percent =
      lessons.length === 0 ? 0 : Math.round((completedCount / lessons.length) * 100);

    return {
      ok: true,
      data: {
        firstName: firstName(profile.full_name, profile.email),
        course,
        trackTitle,
        lessonCount: lessons.length,
        completedCount,
        percent,
        nextLesson,
        exam,
        lastScore: last?.score ?? null,
        lastPassed: last?.passed ?? null,
        canLearn: true,
        canViewTeam: canViewAcademyTeam(profile),
        canManage: canManageAcademy(profile),
        stations: lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          estimatedMinutes: lesson.estimatedMinutes,
          completed: completed.has(lesson.id),
        })),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function listAcademyCatalog(): Promise<
  { ok: true; courses: AcademyCourseCard[] } | { ok: false; error: string }
> {
  try {
    const profile = await requireAcademyLearn();
    const courses = await fetchApprovedCourses();
    const cards: AcademyCourseCard[] = [];
    for (const course of courses) {
      const [lessons, trackTitle] = await Promise.all([
        fetchLessons(course.id),
        fetchTrackTitle(course.trackId),
      ]);
      const completed = await fetchCompletedLessonIds(
        profile.id,
        lessons.map((lesson) => lesson.id),
      );
      cards.push({
        ...course,
        trackTitle: trackTitle ?? "",
        lessonCount: lessons.length,
        completedCount: completed.size,
        percent:
          lessons.length === 0 ? 0 : Math.round((completed.size / lessons.length) * 100),
      });
    }
    return { ok: true, courses: cards };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function getAcademyCourse(courseId: string): Promise<
  { ok: true; data: AcademyCourseDetail } | { ok: false; error: string }
> {
  try {
    const profile = await requireAcademyLearn();
    if (!isAcademyId(courseId)) return { ok: false, error: "הקורס לא נמצא" };
    const course = await fetchCourseById(courseId);
    if (!course) return { ok: false, error: "הקורס לא נמצא" };
    await ensureEnrollment(profile.id, course.id);
    const [lessons, exam, trackTitle] = await Promise.all([
      fetchLessons(course.id),
      fetchCourseExam(course.id),
      fetchTrackTitle(course.trackId),
    ]);
    const completed = await fetchCompletedLessonIds(
      profile.id,
      lessons.map((lesson) => lesson.id),
    );
    return {
      ok: true,
      data: {
        course,
        trackTitle: trackTitle ?? "",
        lessons: lessons.map((lesson) => ({
          ...lesson,
          completed: completed.has(lesson.id),
        })),
        exam,
        completedCount: completed.size,
        percent:
          lessons.length === 0 ? 0 : Math.round((completed.size / lessons.length) * 100),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function getAcademyLesson(lessonId: string): Promise<
  { ok: true; data: AcademyLessonDetail } | { ok: false; error: string }
> {
  try {
    const profile = await requireAcademyLearn();
    if (!isAcademyId(lessonId)) return { ok: false, error: "השיעור לא נמצא" };
    const lesson = await fetchLessonById(lessonId);
    if (!lesson) return { ok: false, error: "השיעור לא נמצא" };
    const course = await fetchCourseById(lesson.courseId);
    if (!course) return { ok: false, error: "הקורס לא נמצא" };
    const [lessons, blocks, exam, rawChecks] = await Promise.all([
      fetchLessons(course.id),
      fetchBlocks(lesson.id),
      fetchCourseExam(course.id),
      fetchLessonQuestions(lesson.id),
    ]);
    const completed = await fetchCompletedLessonIds(profile.id, [lesson.id]);
    const index = lessons.findIndex((row) => row.id === lesson.id);
    const checks = rawChecks.map((question) => ({
      id: question.id,
      stem: question.stem,
      options: shuffleInPlace(question.options).map((option) => ({
        id: option.id,
        body: option.body,
      })),
    }));
    return {
      ok: true,
      data: {
        course,
        lesson,
        blocks,
        checks,
        prevLesson: index > 0 ? lessons[index - 1] : null,
        nextLesson: index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null,
        completed: completed.has(lesson.id),
        exam,
        isLast: index === lessons.length - 1,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function completeAcademyLesson(
  lessonId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const profile = await requireAcademyLearn();
    if (!isAcademyId(lessonId)) return { ok: false, error: "השיעור לא נמצא" };
    const lesson = await fetchLessonById(lessonId);
    if (!lesson) return { ok: false, error: "השיעור לא נמצא" };
    const course = await fetchCourseById(lesson.courseId);
    if (!course) return { ok: false, error: "הקורס לא נמצא" };
    const admin = academyAdmin();
    const { error } = await admin.from("academy_lesson_progress").upsert(
      {
        profile_id: profile.id,
        lesson_id: lessonId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,lesson_id" },
    );
    if (error) return { ok: false, error: error.message };
    revalidatePath("/academy");
    revalidatePath("/academy/catalog");
    revalidatePath(`/academy/courses/${lesson.courseId}`);
    revalidatePath(`/academy/lessons/${lessonId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function checkAcademyLessonQuestion(
  questionId: string,
  optionId: string,
): Promise<
  | {
      ok: true;
      data: {
        correct: boolean;
        explanation: string;
        selectedBody: string | null;
        correctBody: string;
        correctOptionId: string | null;
      };
    }
  | { ok: false; error: string }
> {
  try {
    await requireAcademyLearn();
    if (!isAcademyId(questionId) || !isAcademyId(optionId)) {
      return { ok: false, error: "השאלה לא נמצאה" };
    }
    const question = await fetchQuestionById(questionId);
    if (!question || !question.lessonId) {
      return { ok: false, error: "השאלה לא נמצאה" };
    }
    const lesson = await fetchLessonById(question.lessonId);
    if (!lesson) return { ok: false, error: "השאלה לא נמצאה" };
    const selected = question.options.find((option) => option.id === optionId) ?? null;
    const correct = question.options.find((option) => option.isCorrect) ?? null;
    return {
      ok: true,
      data: {
        correct: Boolean(selected?.isCorrect),
        explanation: question.explanation,
        selectedBody: selected?.body ?? null,
        correctBody: correct?.body ?? "",
        correctOptionId: correct?.id ?? null,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function startAcademyExam(
  examId: string,
): Promise<{ ok: true; data: AcademyExamView } | { ok: false; error: string }> {
  try {
    const profile = await requireAcademyLearn();
    if (!isAcademyId(examId)) return { ok: false, error: "המבחן לא נמצא" };
    const exam = await fetchExamById(examId);
    if (!exam) return { ok: false, error: "המבחן לא נמצא" };

    const course = await fetchCourseById(exam.courseId);
    if (!course) return { ok: false, error: "המבחן לא נמצא" };

    const admin = academyAdmin();
    let questions = await fetchExamQuestions(examId);
    if (questions.length === 0) {
      return { ok: false, error: "אין שאלות מאושרות למבחן" };
    }
    if (exam.shuffle) {
      questions = shuffleInPlace(questions).map((question) => ({
        ...question,
        options: shuffleInPlace(question.options),
      }));
    }

    const { data: attempt, error: attemptError } = await admin
      .from("academy_attempts")
      .insert({
        exam_id: examId,
        profile_id: profile.id,
      })
      .select("id")
      .single();
    if (attemptError || !attempt) {
      return { ok: false, error: attemptError?.message ?? "לא ניתן לפתוח מבחן" };
    }

    return {
      ok: true,
      data: {
        exam,
        courseTitle: course.title,
        attemptId: attempt.id,
        questions: questions.map((question) => ({
          id: question.id,
          stem: question.stem,
          options: question.options.map((option) => ({
            id: option.id,
            body: option.body,
          })),
        })),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function submitAcademyExam(
  attemptId: string,
  answers: Record<string, string>,
): Promise<{ ok: true; data: AcademyExamResult } | { ok: false; error: string }> {
  try {
    const profile = await requireAcademyLearn();
    if (!isAcademyId(attemptId)) return { ok: false, error: "הניסיון לא נמצא" };
    const admin = academyAdmin();
    const { data: attempt, error: attemptError } = await admin
      .from("academy_attempts")
      .select("id, exam_id, profile_id, submitted_at")
      .eq("id", attemptId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (attemptError) return { ok: false, error: attemptError.message };
    if (!attempt) return { ok: false, error: "הניסיון לא נמצא" };
    if (attempt.submitted_at) return { ok: false, error: "המבחן כבר הוגש" };

    const exam = await fetchExamById(attempt.exam_id);
    if (!exam) return { ok: false, error: "המבחן לא נמצא" };

    const questions = await fetchExamQuestions(attempt.exam_id);
    const rows = questions.map((question) => {
      const selectedId = answers[question.id] ?? "";
      const selected = isAcademyId(selectedId)
        ? question.options.find((option) => option.id === selectedId) ?? null
        : null;
      const correct = question.options.find((option) => option.isCorrect) ?? null;
      return {
        questionId: question.id,
        stem: question.stem,
        correct: Boolean(selected?.isCorrect),
        explanation: question.explanation,
        selectedBody: selected?.body ?? null,
        correctBody: correct?.body ?? "",
        optionId: selected?.id ?? null,
      };
    });

    const score = questions.length
      ? Math.round((rows.filter((row) => row.correct).length / questions.length) * 100)
      : 0;
    const passed = score >= exam.passScore;

    const { data: claimed, error: updateError } = await admin
      .from("academy_attempts")
      .update({
        submitted_at: new Date().toISOString(),
        score,
        passed,
      })
      .eq("id", attemptId)
      .eq("profile_id", profile.id)
      .is("submitted_at", null)
      .select("id")
      .maybeSingle();
    if (updateError) return { ok: false, error: updateError.message };
    if (!claimed) return { ok: false, error: "המבחן כבר הוגש" };

    if (rows.length) {
      const { error: answerError } = await admin.from("academy_answers").insert(
        rows.map((row) => ({
          attempt_id: attemptId,
          question_id: row.questionId,
          option_id: row.optionId,
          is_correct: row.correct,
        })),
      );
      if (answerError) return { ok: false, error: answerError.message };
    }

    revalidatePath("/academy");
    revalidatePath(`/academy/courses/${exam.courseId}`);
    return {
      ok: true,
      data: {
        score,
        passed,
        passScore: exam.passScore,
        answers: rows.map((row) => ({
          questionId: row.questionId,
          stem: row.stem,
          correct: row.correct,
          explanation: row.explanation,
          selectedBody: row.selectedBody,
          correctBody: row.correctBody,
        })),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function getAcademyTeamProgress(): Promise<
  { ok: true; rows: AcademyTeamRow[] } | { ok: false; error: string }
> {
  try {
    await requireAcademyTeam();
    const courses = await fetchApprovedCourses();
    const course = courses[0];
    const lessons = course ? await fetchLessons(course.id) : [];
    const exam = course ? await fetchCourseExam(course.id) : null;
    const admin = academyAdmin();

    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, email, is_active")
      .eq("is_active", true)
      .order("full_name");
    if (profileError) return { ok: false, error: profileError.message };

    const { data: perms } = await admin
      .from("profile_permissions")
      .select("profile_id")
      .eq("permission_key", "academy.learn")
      .eq("granted", true);
    const learners = new Set((perms ?? []).map((row) => String(row.profile_id)));

    const lessonIds = lessons.map((lesson) => lesson.id);
    const { data: progress } = lessonIds.length
      ? await admin
          .from("academy_lesson_progress")
          .select("profile_id, lesson_id")
          .in("lesson_id", lessonIds)
      : { data: [] as Array<{ profile_id: string; lesson_id: string }> };

    const completedByUser = new Map<string, number>();
    for (const row of progress ?? []) {
      completedByUser.set(
        row.profile_id,
        (completedByUser.get(row.profile_id) ?? 0) + 1,
      );
    }

    const lastByUser = new Map<string, { score: number | null; passed: boolean | null }>();
    if (exam) {
      const { data: attempts } = await admin
        .from("academy_attempts")
        .select("profile_id, score, passed, submitted_at")
        .eq("exam_id", exam.id)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false });
      for (const row of attempts ?? []) {
        if (lastByUser.has(row.profile_id)) continue;
        lastByUser.set(row.profile_id, {
          score: row.score,
          passed: row.passed,
        });
      }
    }

    const rows: AcademyTeamRow[] = (profiles ?? [])
      .filter((profile) => learners.has(profile.id) || completedByUser.has(profile.id))
      .map((profile) => {
        const completedCount = completedByUser.get(profile.id) ?? 0;
        const last = lastByUser.get(profile.id);
        return {
          profileId: profile.id,
          fullName: profile.full_name || profile.email,
          email: profile.email,
          completedCount,
          lessonCount: lessons.length,
          percent:
            lessons.length === 0
              ? 0
              : Math.round((completedCount / lessons.length) * 100),
          lastScore: last?.score ?? null,
          lastPassed: last?.passed ?? null,
        };
      });

    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function listAcademyManageLessons(): Promise<
  { ok: true; lessons: AcademyManageLesson[] } | { ok: false; error: string }
> {
  try {
    await requireAcademyManage();
    const courses = await fetchApprovedCourses();
    const course = courses[0];
    if (!course) return { ok: true, lessons: [] };
    const lessons = await fetchLessons(course.id, { approvedOnly: false });
    const items: AcademyManageLesson[] = [];
    for (const lesson of lessons) {
      items.push({
        lesson,
        blocks: await fetchBlocks(lesson.id),
      });
    }
    return { ok: true, lessons: items };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}

export async function saveAcademyBlock(input: {
  blockId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAcademyManage();
    if (!isAcademyId(input.blockId)) return { ok: false, error: "הבלוק לא נמצא" };
    const body = input.body.trim();
    if (!body) return { ok: false, error: "התוכן ריק" };
    if (body.length > BLOCK_BODY_MAX) {
      return { ok: false, error: "התוכן ארוך מדי" };
    }
    const admin = academyAdmin();
    const { data, error } = await admin
      .from("academy_blocks")
      .update({ body })
      .eq("id", input.blockId)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "הבלוק לא נמצא" };
    revalidatePath("/academy");
    revalidatePath("/academy/manage");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "שגיאה" };
  }
}
