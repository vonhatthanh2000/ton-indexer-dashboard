"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface BarDatum {
  label: string;
  value: number;
}

/** Thin rounded primary bars, horizontal gridlines only (dashboard-plan.md §4.2). */
export function BarChartView({ data, valueLabel }: { data: BarDatum[]; valueLabel: string }) {
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
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--ink)",
              fontSize: 13,
            }}
            labelStyle={{ color: "var(--ink-2)" }}
            formatter={(value) => [value, valueLabel]}
          />
          <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
