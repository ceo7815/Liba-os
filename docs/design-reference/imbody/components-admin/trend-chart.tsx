"use client";

import { useEffect, useId, useState } from "react";
import { Area, Brush, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({
  data,
  salesLabel,
  leadsLabel,
  height = 224,
}: {
  data: { label: string; sales: number; leads?: number }[];
  salesLabel: string;
  leadsLabel?: string;
  height?: number;
}) {
  const rawId = useId();
  const fillId = `salesFill-${rawId.replace(/:/g, "")}`;
  const [draw, setDraw] = useState(true);
  const showLeads = Boolean(leadsLabel) && data.some((row) => row.leads != null);

  useEffect(() => {
    setDraw(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return (
    <div className="w-full" style={{ height }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-fill)" stopOpacity={0.42} />
              <stop offset="100%" stopColor="var(--chart-fill)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--chart-tick)", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis yAxisId="sales" tick={{ fill: "var(--chart-tick)", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
          {showLeads ? (
            <YAxis yAxisId="leads" orientation="right" tick={{ fill: "var(--chart-tick-2)", fontSize: 11 }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          ) : null}
          <Tooltip
            cursor={{ stroke: "var(--chart-cursor)", strokeDasharray: "3 3" }}
            contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)", fontSize: 12, boxShadow: "0 8px 24px rgb(28 28 27 / 8%)" }}
            formatter={(value, name) => [name === "sales" ? `AED ${Number(value).toLocaleString("en-US")}` : value, name === "sales" ? salesLabel : leadsLabel]}
          />
          <Area
            yAxisId="sales"
            type="monotone"
            dataKey="sales"
            stroke="var(--chart-ink)"
            strokeWidth={2}
            fill={`url(#${fillId})`}
            isAnimationActive={draw}
            animationDuration={900}
            animationEasing="ease-out"
          />
          {showLeads ? (
            <Line
              yAxisId="leads"
              type="monotone"
              dataKey="leads"
              stroke="var(--chart-ink-2)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={draw}
              animationDuration={900}
              animationEasing="ease-out"
            />
          ) : null}
          {data.length > 6 ? (
            <Brush dataKey="label" height={18} travellerWidth={8} stroke="var(--chart-ink)" fill="transparent" />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
