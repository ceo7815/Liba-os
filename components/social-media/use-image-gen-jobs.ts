"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type ImageGenJobStatus = "queued" | "running" | "success" | "error";

export type ImageGenJob = {
  postId: string;
  date: string;
  mode: "scheduled" | "immediate";
  status: ImageGenJobStatus;
  error?: string;
};

export function useImageGenJobs(onSettled: () => void) {
  const [jobs, setJobs] = useState<ImageGenJob[]>([]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const pumping = useRef(false);
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const pump = useCallback(async () => {
    if (pumping.current) return;
    if (jobsRef.current.some((job) => job.status === "running")) return;
    const next = jobsRef.current.find((job) => job.status === "queued");
    if (!next) return;

    pumping.current = true;
    setJobs((prev) =>
      prev.map((job) =>
        job.postId === next.postId ? { ...job, status: "running" } : job,
      ),
    );

    try {
      const res = await fetch("/api/social-media/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: next.postId }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.ok) {
        const error = json?.error ?? "ג׳נרוט תמונה נכשל";
        setJobs((prev) =>
          prev.map((job) =>
            job.postId === next.postId ? { ...job, status: "error", error } : job,
          ),
        );
        toast.error(error);
      } else {
        setJobs((prev) =>
          prev.map((job) =>
            job.postId === next.postId ? { ...job, status: "success" } : job,
          ),
        );
        toast.success("התמונה מוכנה — לחצו על החלונית למטה");
        onSettledRef.current();
      }
    } catch {
      setJobs((prev) =>
        prev.map((job) =>
          job.postId === next.postId
            ? {
                ...job,
                status: "error",
                error: "החיבור נקטע באמצע ג׳נרוט",
              }
            : job,
        ),
      );
      toast.error("החיבור נקטע באמצע ג׳נרוט. נסו שוב מהחלונית למטה.");
    } finally {
      pumping.current = false;
    }
  }, []);

  useEffect(() => {
    if (jobs.some((job) => job.status === "queued")) {
      void pump();
    }
  }, [jobs, pump]);

  const enqueue = useCallback((job: Omit<ImageGenJob, "status" | "error">) => {
    setJobs((prev) => {
      const existing = prev.find((item) => item.postId === job.postId);
      if (
        existing &&
        (existing.status === "queued" || existing.status === "running")
      ) {
        toast.message("התמונה ליום הזה כבר בעבודה");
        return prev;
      }
      return [
        ...prev.filter((item) => item.postId !== job.postId),
        { ...job, status: "queued" as const },
      ];
    });
    toast.message("יוצרים תמונה ברקע — אפשר למזער ולעבור ליום אחר");
  }, []);

  const dismiss = useCallback((postId: string) => {
    setJobs((prev) =>
      prev.filter((job) => {
        if (job.postId !== postId) return true;
        return job.status === "queued" || job.status === "running";
      }),
    );
  }, []);

  return { jobs, enqueue, dismiss };
}
