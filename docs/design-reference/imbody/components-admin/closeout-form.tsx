"use client";

import { useRef, useState } from "react";
import { saveCloseout } from "@/lib/crm/closeout";

export function CloseoutForm({ ticketId }: { ticketId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [saved, setSaved] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [photo, setPhoto] = useState("");

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  return (
    <form
      className="work-sheet grid gap-3 px-4 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        const note = String(new FormData(event.currentTarget).get("note") ?? "");
        const signature = canvas.current?.toDataURL("image/png") ?? "";
        void saveCloseout({ ticket: ticketId, note, signature, photoName, photo }).then((result) => setSaved(result.ok));
      }}
    >
      <h2 className="text-sm font-semibold">סגירת טכנאי</h2>
      <label className="grid gap-1 text-sm">
        הערה
        <textarea name="note" rows={3} className="rounded-xl border border-border px-3 py-2" />
      </label>
      <label className="grid gap-1 text-sm">
        תמונה
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPhotoName(file?.name ?? "");
            if (!file || file.size > 1_500_000) return;
            const reader = new FileReader();
            reader.onload = () => setPhoto(String(reader.result ?? ""));
            reader.readAsDataURL(file);
          }}
        />
      </label>
      <p className="text-sm">חתימה</p>
      <canvas
        ref={canvas}
        width={480}
        height={160}
        className="paper w-full max-w-md touch-none rounded-xl border border-border bg-white"
        onPointerDown={(event) => {
          drawing.current = true;
          const ctx = canvas.current?.getContext("2d");
          const at = point(event);
          ctx?.beginPath();
          ctx?.moveTo(at.x, at.y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const ctx = canvas.current?.getContext("2d");
          const at = point(event);
          if (!ctx) return;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#1d4333";
          ctx.lineTo(at.x, at.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
      />
      <button type="submit" className="h-10 w-fit rounded-full bg-primary px-4 text-sm text-primary-foreground">שמירת סגירה</button>
      {saved ? <p className="text-sm text-primary">הסגירה נשמרה.</p> : null}
    </form>
  );
}
