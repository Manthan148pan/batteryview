import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

interface CellVoltageChartProps {
  data: number[];
}

const chartConfig = {
  voltage: {
    label: 'Voltage',
    color: 'hsl(var(--primary))',
  },
};

export default function CellVoltageChart({ data }: CellVoltageChartProps) {
  const chartData = useMemo(() => {
    return data.map((voltage, index) => ({
      name: `Cell ${index + 1}`,
      voltage,
    }));
  }, [data]);

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
          domain={[2.8, 4.5]}
          allowDataOverflow
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))' }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="voltage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
