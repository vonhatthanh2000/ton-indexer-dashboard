"use client";

import { useMediaQuery } from "@/components/shell/use-media";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarDatum {
  label: string;
  value: number;
}

/** Thin rounded primary bars, horizontal gridlines only (dashboard-plan.md §4.2). */
export function BarChartView({ data, valueLabel }: { data: BarDatum[]; valueLabel: string }) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
  return (
    <div className="h-72 w-full" role="img" aria-label={`${valueLabel}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: -24, bottom: 0 }} barCategoryGap="35%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "var(--neutral-soft)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "var(--hairline)",
              borderRadius: "var(--r-sm)",
              color: "var(--ink)",
              fontSize: "var(--fs-small)",
            }}
            labelStyle={{ color: "var(--ink-2)" }}
            formatter={(value) => [value, valueLabel]}
          />
          <Bar
            dataKey="value"
            fill="var(--primary)"
            radius={[6, 6, 0, 0]}
            maxBarSize={28}
            isAnimationActive={!reducedMotion}
            animationDuration={400}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
