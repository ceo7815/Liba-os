export type AcademyStatus = "draft" | "approved" | "archived";
export type AcademyBlockKind = "text" | "callout" | "todo";
export type AcademyQuestionKind = "knowledge" | "scenario" | "decision";
export type AcademyDifficulty = "easy" | "medium" | "hard";

export type AcademyTrack = {
  id: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  status: AcademyStatus;
};

export type AcademyCourse = {
  id: string;
  trackId: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  version: number;
  status: AcademyStatus;
  passScore: number;
};

export type AcademyLesson = {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  sortOrder: number;
  estimatedMinutes: number;
  status: AcademyStatus;
};

export type AcademyBlock = {
  id: string;
  lessonId: string;
  sortOrder: number;
  kind: AcademyBlockKind;
  body: string;
};

export type AcademyQuestionOption = {
  id: string;
  questionId: string;
  sortOrder: number;
  body: string;
  isCorrect: boolean;
};

export type AcademyQuestion = {
  id: string;
  lessonId: string | null;
  topic: string;
  difficulty: AcademyDifficulty;
  stem: string;
  explanation: string;
  status: AcademyStatus;
  kind: AcademyQuestionKind;
  options: AcademyQuestionOption[];
};

export type AcademyExam = {
  id: string;
  courseId: string;
  title: string;
  kind: "lesson" | "course";
  questionCount: number;
  timeLimitSec: number | null;
  passScore: number;
  shuffle: boolean;
};

export type AcademyCourseCard = AcademyCourse & {
  trackTitle: string;
  lessonCount: number;
  completedCount: number;
  percent: number;
};

export type AcademyStation = {
  id: string;
  title: string;
  estimatedMinutes: number;
  completed: boolean;
};

export type AcademyLessonCheck = {
  id: string;
  stem: string;
  options: Array<{ id: string; body: string }>;
};

export type AcademyDashboard = {
  firstName: string;
  course: AcademyCourse | null;
  trackTitle: string | null;
  lessonCount: number;
  completedCount: number;
  percent: number;
  nextLesson: AcademyLesson | null;
  exam: AcademyExam | null;
  lastScore: number | null;
  lastPassed: boolean | null;
  canLearn: boolean;
  canViewTeam: boolean;
  canManage: boolean;
  stations: AcademyStation[];
};

export type AcademyLessonDetail = {
  course: AcademyCourse;
  lesson: AcademyLesson;
  blocks: AcademyBlock[];
  checks: AcademyLessonCheck[];
  prevLesson: AcademyLesson | null;
  nextLesson: AcademyLesson | null;
  completed: boolean;
  exam: AcademyExam | null;
  isLast: boolean;
};

export type AcademyCourseDetail = {
  course: AcademyCourse;
  trackTitle: string;
  lessons: Array<AcademyLesson & { completed: boolean }>;
  exam: AcademyExam | null;
  completedCount: number;
  percent: number;
};

export type AcademyExamView = {
  exam: AcademyExam;
  courseTitle: string;
  questions: Array<{
    id: string;
    stem: string;
    options: Array<{ id: string; body: string }>;
  }>;
  attemptId: string;
};

export type AcademyExamResult = {
  score: number;
  passed: boolean;
  passScore: number;
  answers: Array<{
    questionId: string;
    stem: string;
    correct: boolean;
    explanation: string;
    selectedBody: string | null;
    correctBody: string;
  }>;
};

export type AcademyTeamRow = {
  profileId: string;
  fullName: string;
  email: string;
  percent: number;
  completedCount: number;
  lessonCount: number;
  lastScore: number | null;
  lastPassed: boolean | null;
};

export type AcademyManageLesson = {
  lesson: AcademyLesson;
  blocks: AcademyBlock[];
};
