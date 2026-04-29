
'use client';

import { useState } from 'react';
import { Area, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart, ReferenceArea } from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DecodedBMSData } from '@/types/bms';
import { format } from 'date-fns';

interface ChartDataPoint {
  time: string;
  soc?: number;
  voltage?: number;
  temperature?: number;
  maxCell?: number;
  minCell?: number;
  avgCellVolt?: number;
  chargeStatus?: number;
  power?: number;
}

interface UnifiedDataTrendChartProps {
  data: {
    timestamp: number;
    decodedData?: DecodedBMSData;
  }[];
}

const chartConfig = {
  soc: { label: 'SOC (%)', color: 'hsl(var(--chart-2))' },
  voltage: { label: 'Voltage (V)', color: 'hsl(var(--chart-1))' },
  temperature: { label: 'Max Temp (°C)', color: 'hsl(var(--chart-5))' },
  maxCell: { label: 'Max Cell (V)', color: 'hsl(var(--chart-3))' },
  minCell: { label: 'Min Cell (V)', color: 'hsl(var(--chart-4))' },
  avgCellVolt: { label: 'Avg Cell (V)', color: 'hsl(var(--chart-1))' },
  chargeStatus: { label: 'Charge MOS', color: 'hsla(var(--chart-2), 0.5)' },
  power: { label: 'Power (kW)', color: 'hsl(var(--chart-3))' },
};

export default function UnifiedDataTrendChart({ data }: UnifiedDataTrendChartProps) {
  const [visibleData, setVisibleData] = useState(['soc', 'voltage', 'temperature']);

  const chartData: ChartDataPoint[] = useMemo(() => {
    return data
      .filter(p => p.decodedData)
      .map(p => ({
          time: format(new Date(p.timestamp), 'MMM dd, HH:mm'),
          soc: p.decodedData!.soc,
          voltage: p.decodedData!.totalVoltage,
          temperature: Math.max(...p.decodedData!.temps, p.decodedData!.mosT1, p.decodedData!.mosT2),
          maxCell: p.decodedData!.maxCell,
          minCell: p.decodedData!.minCell,
          avgCellVolt: p.decodedData!.avgCellVolt,
          chargeStatus: p.decodedData!.chgMos,
          power: p.decodedData!.power,
      }));
  }, [data]);

  const chargingPeriods = useMemo(() => {
    return chartData.reduce((acc, point, index) => {
        if (point.chargeStatus === 1 && (index === 0 || chartData[index - 1].chargeStatus === 0)) {
          acc.push({ x1: point.time });
        }
        if (point.chargeStatus === 0 && index > 0 && chartData[index - 1].chargeStatus === 1) {
          const lastPeriod = acc[acc.length - 1];
          if (lastPeriod && !lastPeriod.x2) {
            lastPeriod.x2 = chartData[index - 1].time;
          }
        }
        if (index === chartData.length - 1 && point.chargeStatus === 1) {
            const lastPeriod = acc[acc.length - 1];
            if (lastPeriod && !lastPeriod.x2) {
                lastPeriod.x2 = point.time;
            }
        }
        return acc;
      }, [] as { x1: string; x2?: string }[]);
  }, [chartData]);


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const chargeStatusItem = payload.find((p:any) => p.dataKey === 'chargeStatus');
      const otherPayload = payload.filter((p:any) => p.dataKey !== 'chargeStatus');

      return (
        <div className="p-2 bg-background border rounded-md shadow-lg text-sm">
          <p className="font-bold mb-2">{label}</p>
          {chargeStatusItem && (
            <p className="font-semibold" style={{ color: chartConfig.chargeStatus.color }}>
              Charging: {chargeStatusItem.value === 1 ? 'ON' : 'OFF'}
            </p>
          )}
          {otherPayload.map((item: any) => {
              if (item.value === undefined || item.value === null) return null;
              return (
                  <p key={item.dataKey} style={{ color: item.color }}>
                      {`${item.name}: ${item.value.toFixed(2)}`}
                  </p>
              )
          })}
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="space-y-4">
       <ToggleGroup
        type="multiple"
        variant="outline"
        value={visibleData}
        onValueChange={(value) => { if (value.length) setVisibleData(value); }}
        className="flex-wrap justify-start"
      >
        <ToggleGroupItem value="soc">SOC</ToggleGroupItem>
        <ToggleGroupItem value="voltage">Voltage</ToggleGroupItem>
        <ToggleGroupItem value="temperature">Temp</ToggleGroupItem>
        <ToggleGroupItem value="cell_spread">Cell Spread</ToggleGroupItem>
        <ToggleGroupItem value="power">Power</ToggleGroupItem>
      </ToggleGroup>

      <ChartContainer config={chartConfig} className="h-[350px] w-full sm:min-h-[400px]">
        <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis 
            dataKey="time" 
            tickLine={false} 
            axisLine={false} 
            tickMargin={8}
            interval="preserveStartEnd"
            tick={{ fontSize: 12 }}
          />
          <YAxis yAxisId="left" orientation="left" stroke={chartConfig.voltage.color} domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" stroke={chartConfig.soc.color} domain={[0, 100]} tick={{ fontSize: 10 }}/>
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          {chargingPeriods.map((period, index) => (
            period.x2 && <ReferenceArea key={index} yAxisId="left" x1={period.x1} x2={period.x2} strokeOpacity={0.3} fill="hsl(var(--chart-2))" fillOpacity={0.1} />
          ))}

          {visibleData.includes('soc') && <Area type="monotone" dataKey="soc" fill={chartConfig.soc.color} stroke={chartConfig.soc.color} fillOpacity={0.1} yAxisId="right" name="SOC" />}
          {visibleData.includes('voltage') && <Line type="monotone" dataKey="voltage" stroke={chartConfig.voltage.color} yAxisId="left" dot={false} name="Voltage" />}
          {visibleData.includes('temperature') && <Line type="monotone" dataKey="temperature" stroke={chartConfig.temperature.color} yAxisId="left" dot={false} name="Max Temp" />}
          {visibleData.includes('power') && <Line type="monotone" dataKey="power" stroke={chartConfig.power.color} yAxisId="left" dot={false} name="Power" strokeDasharray="3 3"/>}
          
          {visibleData.includes('cell_spread') && <Line type="monotone" dataKey="maxCell" stroke={chartConfig.maxCell.color} yAxisId="left" dot={false} name="Max Cell" />}
          {visibleData.includes('cell_spread') && <Line type="monotone" dataKey="minCell" stroke={chartConfig.minCell.color} yAxisId="left" dot={false} name="Min Cell" />}
          {visibleData.includes('cell_spread') && <Line type="monotone" dataKey="avgCellVolt" stroke={chartConfig.avgCellVolt.color} yAxisId="left" dot={false} name="Avg Cell" strokeDasharray="5 5" />}
          
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

    