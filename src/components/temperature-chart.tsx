'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

interface TemperatureChartProps {
  temps: number[];
  mosT1: number;
  mosT2: number;
}

const chartConfig = {
  temperature: {
    label: 'Temperature',
  },
};

export default function TemperatureChart({ temps, mosT1, mosT2 }: TemperatureChartProps) {
  const chartData = [
    ...temps.map((t, i) => ({ name: `Temp ${i + 1}`, temperature: t })),
    { name: 'MOS 1', temperature: mosT1 },
    { name: 'MOS 2', temperature: mosT2 },
  ];

  const getColor = (temp: number) => {
    if (temp >= 60) return '#ef4444'; // Red for high temp
    if (temp >= 40) return '#fbbf24'; // Yellow for medium temp
    return 'hsl(var(--accent))'; // Green for normal
  };

  return (
    <ChartContainer config={chartConfig} className="min-h-[150px] w-full">
      <BarChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 12 }}
          unit="°C"
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="temperature" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.temperature)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
