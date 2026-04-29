'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

interface CompareCellVoltageChartProps {
  data1: number[];
  data2: number[];
}

const chartConfig = {
  device1: {
    label: 'Battery 1',
    color: 'hsl(var(--chart-1))',
  },
  device2: {
    label: 'Battery 2',
    color: 'hsl(var(--chart-2))',
  },
};

export default function CompareCellVoltageChart({ data1, data2 }: CompareCellVoltageChartProps) {
  const maxLength = Math.max(data1.length, data2.length);
  const chartData = Array.from({ length: maxLength }).map((_, index) => ({
    name: `Cell ${index + 1}`,
    device1: index < data1.length ? data1[index] : null,
    device2: index < data2.length ? data2[index] : null,
  }));

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={false} />
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
          domain={[2.8, 4.5]}
          allowDataOverflow
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          content={<ChartTooltipContent />}
        />
        <Legend />
        <Bar dataKey="device1" fill={chartConfig.device1.color} radius={[4, 4, 0, 0]} name="Battery 1" />
        <Bar dataKey="device2" fill={chartConfig.device2.color} radius={[4, 4, 0, 0]} name="Battery 2" />
      </BarChart>
    </ChartContainer>
  );
}
