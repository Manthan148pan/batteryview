
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Wand2, Info, Battery, Thermometer, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { decodeBMSHexWithRaw } from '@/lib/bms-decoder';
import type { DecodedBMSDataWithRaw } from '@/types/bms';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const formatBytes = (bytes: number[]) => bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

const SummaryItem = ({ label, value, rawBytes, startIndex }: { label: string; value: React.ReactNode; rawBytes: number[]; startIndex: number; }) => (
  <div className="grid grid-cols-12 items-center text-sm gap-2 py-1">
    <span className="text-muted-foreground col-span-3">{label}</span>
    <code className="text-xs bg-muted/80 px-2 py-1 rounded col-span-3 text-center font-mono">{startIndex !== -1 ? `${startIndex}` : 'N/A'}</code>
    <code className="text-xs bg-muted/80 px-2 py-1 rounded col-span-3 text-center font-mono">{rawBytes.length > 0 ? formatBytes(rawBytes) : 'N/A'}</code>
    <span className="font-medium col-span-3 text-right">{value}</span>
  </div>
);

export default function AdminDataConverterPage() {
  const [hexData, setHexData] = useState('');
  const [decodedData, setDecodedData] = useState<DecodedBMSDataWithRaw | null>(null);
  const [bytes, setBytes] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConvert = () => {
    if (!hexData) {
      toast({ variant: 'destructive', title: 'No Data', description: 'Please paste HEX data into the text area.' });
      return;
    }
    
    setError(null);
    setDecodedData(null);
    setBytes([]);

    try {
      const cleanHex = hexData.replace(/\s+/g, '').toUpperCase();
      const byteValues: number[] = [];
      if (cleanHex.length % 2 !== 0) {
        setError('Invalid HEX string length. Must be an even number of characters.');
        return;
      }
      for (let i = 0; i < cleanHex.length; i += 2) {
        byteValues.push(parseInt(cleanHex.substring(i, i + 2), 16));
      }
      setBytes(byteValues);

      const result = decodeBMSHexWithRaw(hexData);
      if (result) {
        setDecodedData(result);
        toast({ title: 'Conversion Successful', description: 'HEX data has been decoded.' });
      } else {
        setError('Failed to decode HEX data. Please check the format and ensure it is a valid BMS string.');
        toast({ variant: 'destructive', title: 'Conversion Failed', description: 'Invalid HEX data format.' });
      }
    } catch (e: any) {
      setError(`An error occurred during conversion: ${e.message}`);
      toast({ variant: 'destructive', title: 'Error', description: 'An unexpected error occurred.' });
    }
  };

  const renderSummaryHeader = () => (
    <div className="grid grid-cols-12 items-center text-sm gap-2 font-bold mb-2">
      <span className="text-muted-foreground col-span-3">Metric</span>
      <span className="text-muted-foreground col-span-3 text-center">Start Index</span>
      <span className="text-muted-foreground col-span-3 text-center">Raw Bytes (Hex)</span>
      <span className="text-muted-foreground col-span-3 text-right">Converted Value</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              HEX Data Converter
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wand2 className="mr-2 h-6 w-6 text-primary" />
                Input HEX Data
              </CardTitle>
              <CardDescription>
                Paste the raw HEX string from the BMS device below to see the converted data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={hexData}
                onChange={(e) => setHexData(e.target.value)}
                placeholder="A501002A441818... (your hex data)"
                className="min-h-[200px] font-mono text-xs"
              />
              <Button onClick={handleConvert} className="w-full">
                <Wand2 className="mr-2 h-4 w-4" />
                Convert Data
              </Button>
            </CardContent>
          </Card>
          
          <Card>
             <CardHeader>
              <CardTitle className="flex items-center">
                <Info className="mr-2 h-6 w-6 text-primary" />
                Decoded Output
              </CardTitle>
              <CardDescription>
                The human-readable data will appear here after conversion.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Conversion Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {decodedData ? (
                 <div className="space-y-4">
                    {bytes.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold flex items-center mb-2"><Database className="mr-2 h-5 w-5 text-primary" />Full Raw Bytes</h3>
                            <div className="p-4 bg-muted/50 rounded-lg font-mono text-xs break-all">
                                {bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}
                            </div>
                        </div>
                    )}
                    <Separator />
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h3 className="text-lg font-semibold flex items-center mb-4"><Battery className="mr-2 h-5 w-5 text-primary" />Battery Summary</h3>
                        {renderSummaryHeader()}
                        <SummaryItem label="Total Voltage" value={`${decodedData.totalVoltage.value} V`} rawBytes={decodedData.totalVoltage.rawBytes} startIndex={decodedData.totalVoltage.startIndex} />
                        <SummaryItem label="Current" value={`${decodedData.current.value} A`} rawBytes={decodedData.current.rawBytes} startIndex={decodedData.current.startIndex} />
                        <SummaryItem label="Power" value={`${decodedData.power.value} kW`} rawBytes={decodedData.power.rawBytes} startIndex={decodedData.power.startIndex} />
                        <SummaryItem label="State of Charge (SOC)" value={`${decodedData.soc.value}%`} rawBytes={decodedData.soc.rawBytes} startIndex={decodedData.soc.startIndex} />
                        <SummaryItem label="Nominal Capacity" value={`${(decodedData.capacity.value / 1000).toFixed(1)} Ah`} rawBytes={decodedData.capacity.rawBytes} startIndex={decodedData.capacity.startIndex} />
                        <SummaryItem label="Remaining Capacity" value={`${decodedData.remCap.value} Ah`} rawBytes={decodedData.remCap.rawBytes} startIndex={decodedData.remCap.startIndex} />
                        <SummaryItem label="Cycles" value={decodedData.cycles.value} rawBytes={decodedData.cycles.rawBytes} startIndex={decodedData.cycles.startIndex} />
                    </div>
                    <Separator />
                     <div className="p-4 bg-muted/50 rounded-lg">
                        <h3 className="text-lg font-semibold flex items-center mb-4"><Thermometer className="mr-2 h-5 w-5 text-primary" />Temperatures</h3>
                         {renderSummaryHeader()}
                         {decodedData.temps.map((temp, index) => (
                            <SummaryItem key={index} label={`Temp Sensor ${index+1}`} value={`${temp.value}°C`} rawBytes={temp.rawBytes} startIndex={temp.startIndex} />
                         ))}
                         <SummaryItem label="MOS Temp 1" value={`${decodedData.mosT1.value}°C`} rawBytes={decodedData.mosT1.rawBytes} startIndex={decodedData.mosT1.startIndex} />
                         <SummaryItem label="MOS Temp 2" value={`${decodedData.mosT2.value}°C`} rawBytes={decodedData.mosT2.rawBytes} startIndex={decodedData.mosT2.startIndex} />
                    </div>
                    <Separator />
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h3 className="text-lg font-semibold flex items-center mb-4"><Battery className="mr-2 h-5 w-5 text-primary" />Cell Voltages</h3>
                        {renderSummaryHeader()}
                        {decodedData.cellVoltages.map((volt, index) => (
                            <SummaryItem key={index} label={`Cell ${index+1}`} value={`${volt.value} V`} rawBytes={volt.rawBytes} startIndex={volt.startIndex} />
                        ))}
                    </div>
                </div>
              ) : !error && (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground">Waiting for input...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
