"use client";

import { useEffect, useRef } from "react";
import type { Chart } from "chart.js";
import type { TrendSeries } from "@/lib/sales-dashboard/types";

type SalesTrendChartProps = {
  series: TrendSeries;
  barColor: string;
  lineColor: string;
};

export function SalesTrendChart({
  series,
  barColor,
  lineColor,
}: SalesTrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    void (async () => {
      const {
        Chart,
        BarController,
        BarElement,
        CategoryScale,
        LinearScale,
        LineController,
        LineElement,
        PointElement,
        Legend,
        Tooltip,
        Filler,
      } = await import("chart.js");
      if (cancelled) return;

      Chart.register(
        BarController,
        BarElement,
        CategoryScale,
        LinearScale,
        LineController,
        LineElement,
        PointElement,
        Legend,
        Tooltip,
        Filler,
      );

      chartRef.current?.destroy();
      try {
        Chart.getChart(canvas)?.destroy();
      } catch {
        /* canvas may not have a chart yet */
      }
      chartRef.current = new Chart(canvas, {
        type: "bar",
        data: {
          labels: series.labels,
          datasets: [
            {
              label: "פרמיה (₪)",
              data: series.sums,
              backgroundColor: barColor.length === 7 ? `${barColor}cc` : barColor,
              borderColor: barColor,
              borderWidth: 2,
              borderRadius: 6,
              yAxisID: "y",
            },
            {
              label: "כמות",
              data: series.counts,
              type: "line",
              borderColor: lineColor,
              backgroundColor: `${lineColor}14`,
              borderWidth: 2,
              pointBackgroundColor: lineColor,
              pointRadius: 4,
              tension: 0.35,
              yAxisID: "y1",
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: "#6b6b6b", font: { family: "inherit", size: 11 } },
            },
          },
          scales: {
            x: {
              ticks: { color: "#6b6b6b", font: { family: "inherit", size: 11 } },
              grid: { color: "rgba(17,17,17,0.06)" },
            },
            y: {
              position: "right",
              ticks: { color: "#6b6b6b" },
              grid: { color: "rgba(17,17,17,0.06)" },
            },
            y1: {
              position: "left",
              ticks: { color: "#6b6b6b" },
              grid: { display: false },
            },
          },
        },
      });
    })();

    return () => {
      cancelled = true;
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [series, barColor, lineColor]);

  return <canvas ref={canvasRef} />;
}
