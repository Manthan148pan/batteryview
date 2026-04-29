
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ArrowLeft, History, BarChart3, Calendar as CalendarIcon, Battery, Thermometer, Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { db, ref, get } from '@/lib/firebase';
import { decodeBMSHex } from '@/lib/bms-decoder';
import type { DecodedBMSData } from '@/types/bms';
import CompareCellVoltageChart from '@/components/compare-cell-voltage-chart';
import { Separator } from '@/components/ui/separator';

interface RegisteredBMS {
  id: string;
  deviceNickname: string;
}

interface HistoryDataPoint {
  time: string;
  timestamp: number;
  hex_data: string;
}

const SummaryItem = ({ label, value, value2 }: { label: string; value?: React.ReactNode; value2?: React.ReactNode }) => (
  <div className="grid grid-cols-3 items-center text-sm py-2 border-b">
    <span className="text-muted-foreground col-span-1">{label}</span>
    <span className="font-medium text-center col-span-1">{value ?? 'N/A'}</span>
    <span className="font-medium text-center col-span-1">{value2 ?? 'N/A'}</span>
  </div>
);

export default function ComparePage() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>();
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredBMS[]>([]);
  const [device1, setDevice1] = useState<string | null>(null);
  const [device2, setDevice2] = useState<string | null>(null);
  const [device1Data, setDevice1Data] = useState<DecodedBMSData | null>(null);
  const [device2Data, setDevice2Data] = useState<DecodedBMSData | null>(null);
  const [timestamps1, setTimestamps1] = useState<HistoryDataPoint[]>([]);
  const [timestamps2, setTimestamps2] = useState<HistoryDataPoint[]>([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize date on client side only to avoid hydration mismatch
    setDate(new Date());
  }, []);

  useEffect(() => {
    const fetchRegisteredDevices = async () => {
      if (!user || !db) return;
      try {
        const devicesRef = ref(db, `users/${user.uid}/bms_devices`);
        const snapshot = await get(devicesRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          const devices: RegisteredBMS[] = Object.keys(data).map(macId => ({
            id: macId,
            deviceNickname: data[macId].deviceNickname || `BMS-${macId.substring(macId.length - 5)}`,
          }));
          setRegisteredDevices(devices);
          if (devices.length > 1) {
            setDevice1(devices[0].id);
            setDevice2(devices[1].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch registered devices:", error);
      }
    };
    fetchRegisteredDevices();
  }, [user]);

  const fetchTimestamps = async (deviceId: string | null, date: Date | undefined) => {
    if (!user || !deviceId || !date || !db) return [];
    try {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const historyRef = ref(db, `users/${user.uid}/bms_devices/${deviceId}/history/${formattedDate}`);
      const snapshot = await get(historyRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.entries(data).map(([timestampStr, entry]: [string, any]) => ({
          timestamp: Number(timestampStr),
          time: format(new Date(Number(timestampStr)), 'HH:mm:ss'),
          hex_data: entry.hex_data,
        })).sort((a, b) => a.timestamp - b.timestamp);
      }
    } catch (error) {
      console.error(`Failed to fetch timestamps for ${deviceId}`, error);
    }
    return [];
  };

  useEffect(() => {
    const loadTimestamps = async () => {
      setIsLoading(true);
      const ts1 = await fetchTimestamps(device1, date);
      const ts2 = await fetchTimestamps(device2, date);
      setTimestamps1(ts1);
      setTimestamps2(ts2);
      setSelectedTimestamp(ts1.length > 0 ? String(ts1[0].timestamp) : null);
      setIsLoading(false);
    };
    if (device1 && device2 && date) {
      loadTimestamps();
    }
  }, [device1, device2, date]);

  useEffect(() => {
    if (selectedTimestamp) {
      const dataPoint1 = timestamps1.find(t => String(t.timestamp) === selectedTimestamp);
      const dataPoint2 = timestamps2.find(t => String(t.timestamp) === selectedTimestamp) || 
                         timestamps2.reduce((prev, curr) => 
                           Math.abs(curr.timestamp - Number(selectedTimestamp)) < Math.abs(prev.timestamp - Number(selectedTimestamp)) ? curr : prev, 
                           timestamps2[0]);

      setDevice1Data(dataPoint1 ? decodeBMSHex(dataPoint1.hex_data) : null);
      setDevice2Data(dataPoint2 ? decodeBMSHex(dataPoint2.hex_data) : null);
    } else {
        setDevice1Data(null);
        setDevice2Data(null);
    }
  }, [selectedTimestamp, timestamps1, timestamps2]);
  
  const commonTimestamps = timestamps1.filter(ts1 => timestamps2.some(ts2 => ts2.time === ts1.time));

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm">
        <div className="container mx-auto flex flex-col px-4 sm:px-6 lg:px-8 py-4 gap-4">
          <div className="flex items-center justify-between flex-wrap">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Compare Batteries</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/history">
                  <History className="mr-2 h-4 w-4" />
                  History
                </Link>
              </Button>
              <Button variant="outline" disabled>
                <BarChart3 className="mr-2 h-4 w-4" />
                Compare
              </Button>
            </div>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-4 items-stretch sm:items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={'outline'}
                  className={cn('w-full justify-start text-left font-normal h-11 sm:h-9', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'LLL dd, y') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Select value={device1 || ''} onValueChange={setDevice1}>
              <SelectTrigger className="w-full h-11 sm:h-9">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <SelectValue placeholder="Select Battery 1" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {registeredDevices.map(dev => <SelectItem key={dev.id} value={dev.id}>{dev.deviceNickname}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={device2 || ''} onValueChange={setDevice2}>
              <SelectTrigger className="w-full h-11 sm:h-9">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <SelectValue placeholder="Select Battery 2" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {registeredDevices.map(dev => <SelectItem key={dev.id} value={dev.id}>{dev.deviceNickname}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={selectedTimestamp || ''} onValueChange={setSelectedTimestamp} disabled={commonTimestamps.length === 0}>
              <SelectTrigger className="w-full h-11 sm:h-9">
                <SelectValue placeholder="Select Timestamp" />
              </SelectTrigger>
              <SelectContent>
                 {isLoading ? (
                    <SelectItem value="loading" disabled>Loading times...</SelectItem>
                ) : commonTimestamps.length > 0 ? (
                    commonTimestamps.map(ts => (
                        <SelectItem key={ts.timestamp} value={String(ts.timestamp)}>{ts.time}</SelectItem>
                    ))
                ) : (
                    <SelectItem value="no-times" disabled>No common timestamps</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="border-none sm:border shadow-none sm:shadow-sm">
          <CardHeader className="px-0 sm:px-6">
            <CardTitle>Side-by-Side Comparison</CardTitle>
            <CardDescription>Reviewing performance for the selected batteries and timestamp.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6 space-y-8">
            {isLoading ? (
              <div className="flex justify-center items-center h-[300px]"><p>Loading comparison data...</p></div>
            ) : device1Data && device2Data ? (
              <div className="space-y-6">
                <div className="px-4 sm:px-0">
                  <h3 className="text-lg font-semibold flex items-center mb-4"><Battery className="mr-2 h-5 w-5 text-primary" />Cell Voltages</h3>
                  <CompareCellVoltageChart data1={device1Data.cellVoltages} data2={device2Data.cellVoltages} />
                </div>
                <Separator />
                <div className="px-4 sm:px-0">
                   <h3 className="text-lg font-semibold flex items-center mb-4"><Info className="mr-2 h-5 w-5 text-primary" />Battery Summary</h3>
                   <div className="rounded-xl border overflow-hidden bg-card">
                     <div className="overflow-x-auto">
                        <div className="min-w-[600px]">
                          <div className="grid grid-cols-3 items-center text-sm font-bold p-4 bg-muted/40 border-b">
                              <span className="col-span-1">Metric</span>
                              <span className="text-center col-span-1 text-blue-600">{registeredDevices.find(d=>d.id===device1)?.deviceNickname}</span>
                              <span className="text-center col-span-1 text-green-600">{registeredDevices.find(d=>d.id===device2)?.deviceNickname}</span>
                          </div>
                          <div className="divide-y">
                            <SummaryItem label="Total Voltage" value={`${device1Data.totalVoltage} V`} value2={`${device2Data.totalVoltage} V`} />
                            <SummaryItem label="Current" value={`${device1Data.current} A`} value2={`${device2Data.current} A`} />
                            <SummaryItem label="Power" value={`${device1Data.power} kW`} value2={`${device2Data.power} kW`} />
                            <SummaryItem label="SOC" value={`${device1Data.soc}%`} value2={`${device2Data.soc}%`} />
                            <SummaryItem label="Cycles" value={device1Data.cycles} value2={device2Data.cycles} />
                            <SummaryItem label="Max Cell" value={`${device1Data.maxCell} V`} value2={`${device2Data.maxCell} V`} />
                            <SummaryItem label="Min Cell" value={`${device1Data.minCell} V`} value2={`${device2Data.minCell} V`} />
                            <SummaryItem label="Avg Cell" value={`${device1Data.avgCellVolt} V`} value2={`${device2Data.avgCellVolt} V`} />
                            <SummaryItem label="MOS Temp" value={`${device1Data.mosT1}°C`} value2={`${device2Data.mosT1}°C`} />
                          </div>
                        </div>
                     </div>
                   </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <h3 className="text-xl font-medium">No Data to Compare</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Select two different batteries and a date with data for both to see a comparison.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
