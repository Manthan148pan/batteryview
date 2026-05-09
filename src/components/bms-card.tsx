
'use client';

import type { BMSDevice } from '@/types/bms';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Thermometer, Info, Power, Zap, BatteryCharging, PowerOff, WifiOff, Server, Wrench } from 'lucide-react';
import MeterChart from './meter-chart';

interface BMSCardProps {
  device: BMSDevice;
  showNickname: boolean;
  isNew: boolean;
  onDetailsClick: () => void;
  onPredictClick: () => void;
  onConnectClick: () => void;
  isFirstCard?: boolean;
}

export default function BMSCard({
  device,
  showNickname,
  isNew,
  onDetailsClick,
  onPredictClick,
  onConnectClick,
  isFirstCard = false,
}: BMSCardProps) {
  const { decodedData, connect, device_name, id, deviceNickname, available, gatewayId } = device;

  const soc = decodedData?.soc ?? 0;
  const volt = decodedData?.totalVoltage ?? 0;
  const curr = decodedData?.current ?? 0;
  const temp1 = decodedData?.temps?.[0] ?? 0;
  const isCharging = decodedData?.chgMos;

  const displayTitle = showNickname && deviceNickname ? deviceNickname : device_name || id;
  const displayDescription = id.replace(/-/g, ':');
  

  return (
    <Card className="w-full md:w-[calc(33.33%-1rem)] lg:w-[calc(25%-1rem)] flex-grow transform transition-all hover:shadow-lg hover:-translate-y-1" style={{minHeight: '280px'}}>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            {isNew && !device.available && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
              </span>
            )}
             {device.available && (
              <span className="relative flex h-3 w-3" title="Online">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            )}
            <CardTitle className="text-lg font-bold text-gray-800 dark:text-gray-200">
              {displayTitle}
            </CardTitle>
          </div>
          {device.available && (
            <Badge variant={device.connect ? 'default' : 'secondary'} className={device.connect ? 'bg-green-100 text-green-800 border-green-200' : ''}>
              {device.connect ? 'Connected' : 'Disconnected'}
            </Badge>
          )}
        </div>
        <CardDescription className="font-mono text-xs tracking-widest pt-1">
          {displayDescription}
        </CardDescription>
        {gatewayId && (
            <div className="flex items-center text-xs text-muted-foreground pt-1">
                <Server className="w-3 h-3 mr-1.5" />
                <span title={gatewayId}>via {gatewayId.substring(0, 12)}...</span>
            </div>
        )}
        {device.available && decodedData && (
          <div className="flex items-center pt-2">
            <Badge variant={isCharging ? 'default' : 'destructive'} className={isCharging ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}>
              {isCharging ? (
                <BatteryCharging className="w-3 h-3 mr-1" />
              ) : (
                <PowerOff className="w-3 h-3 mr-1" />
              )}
              {isCharging ? 'Charging On' : 'Charging Off'}
            </Badge>
          </div>
        )}
      </CardHeader>

      {device.available ? (
        <>
          <CardContent className="flex flex-col items-center gap-1 p-4 pt-1">
            <div className="scale-90 origin-top -mb-4">
              <MeterChart
                value={soc}
                max={100}
                label="SoC"
                unit="%"
                color="hsl(var(--primary))"
              />
            </div>
            <div className="w-full grid grid-cols-3 gap-1 text-center text-muted-foreground pt-1">
              <div className="flex flex-col items-center">
                <BatteryCharging className="w-4 h-4 mb-0.5 text-primary" />
                <span className="font-bold text-base text-foreground">{volt.toFixed(1)}V</span>
                <span className="text-[10px]">Voltage</span>
              </div>
              <div className="flex flex-col items-center">
                <Zap className="w-4 h-4 mb-0.5 text-primary" />
                <span className="font-bold text-base text-foreground">{curr.toFixed(1)}A</span>
                <span className="text-[10px]">Current</span>
              </div>
              <div className="flex flex-col items-center">
                <Thermometer className="w-4 h-4 mb-0.5 text-primary" />
                <span className="font-bold text-base text-foreground">{temp1.toFixed(1)}°C</span>
                <span className="text-[10px]">Temp</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-4 pt-0 flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 h-9 gap-1.5" onClick={onDetailsClick} disabled={!decodedData} title="View Details">
              <Info className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold">Info</span>
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-9 gap-1.5" onClick={onPredictClick} title="AI Prediction">
              <Wrench className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold">AI</span>
            </Button>
            <Button
              id={isFirstCard ? 'connect-button' : undefined}
              size="sm"
              className="flex-1 gradient-bg text-primary-foreground hover:opacity-90 disabled:opacity-50 h-9 gap-1.5"
              onClick={onConnectClick}
              disabled={device.connect || !device.available}
            >
              <Power className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold truncate">
                {device.connect ? 'Linked' : 'Link'}
              </span>
            </Button>
          </CardFooter>
        </>
      ) : (
        <>
          <CardContent className="flex flex-col items-center justify-center text-center h-[180px]">
            <WifiOff className="w-10 h-10 text-muted-foreground mb-2" />
            <p className="text-muted-foreground font-medium">Device Offline</p>
            <p className="text-xs text-muted-foreground">
                No real-time data available.
            </p>
          </CardContent>
            <CardFooter className="p-4 pt-0 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-9 gap-1.5" disabled={true}>
                <Info className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold">Info</span>
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-9 gap-1.5" disabled={true}>
                <Wrench className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold">AI</span>
              </Button>
              <Button
                className="flex-1 h-9 gap-1.5"
                size="sm"
                disabled={true}
              >
                <Power className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold">Link</span>
              </Button>
            </CardFooter>
        </>
      )}
    </Card>
  );
}
