
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
import { Thermometer, Info, Power, Zap, BatteryCharging, PowerOff, WifiOff, Server } from 'lucide-react';
import MeterChart from './meter-chart';

interface BMSCardProps {
  device: BMSDevice;
  showNickname: boolean;
  isNew: boolean;
  onDetailsClick: () => void;
  onConnectClick: () => void;
  isFirstCard?: boolean;
}

export default function BMSCard({
  device,
  showNickname,
  isNew,
  onDetailsClick,
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
    <Card className="w-full md:w-[calc(50%-0.75rem)] flex-grow transform transition-all hover:shadow-xl hover:-translate-y-1" style={{minHeight: '300px'}}>
      <CardHeader className="pb-2">
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
            <CardTitle className="text-xl font-bold text-gray-800 dark:text-gray-200">
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
          <CardContent className="flex flex-col items-center gap-1 pt-1">
            <MeterChart
              value={soc}
              max={100}
              label="State of Charge"
              unit="%"
              color="hsl(var(--primary))"
            />
            <div className="w-full grid grid-cols-3 gap-2 text-center text-muted-foreground pt-1">
              <div className="flex flex-col items-center">
                <BatteryCharging className="w-5 h-5 mb-1 text-primary" />
                <span className="font-bold text-lg text-foreground">{volt.toFixed(1)}V</span>
                <span className="text-xs">Voltage</span>
              </div>
              <div className="flex flex-col items-center">
                <Zap className="w-5 h-5 mb-1 text-primary" />
                <span className="font-bold text-lg text-foreground">{curr.toFixed(1)}A</span>
                <span className="text-xs">Current</span>
              </div>
              <div className="flex flex-col items-center">
                <Thermometer className="w-5 h-5 mb-1 text-primary" />
                <span className="font-bold text-lg text-foreground">{temp1.toFixed(1)}°C</span>
                <span className="text-xs">Temp</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-4">
            <Button id={isFirstCard ? 'details-button' : undefined} variant="outline" className="w-full" onClick={onDetailsClick} disabled={!decodedData}>
              <Info className="mr-2" /> Details
            </Button>
            <Button
              id={isFirstCard ? 'connect-button' : undefined}
              className="w-full gradient-bg text-primary-foreground hover:opacity-90 disabled:opacity-50"
              onClick={onConnectClick}
              disabled={device.connect || !device.available}
            >
              <Power className="mr-2" /> {device.connect ? 'Connected' : 'Connect'}
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
           <CardFooter className="flex gap-4">
             <Button variant="outline" className="w-full" onClick={onDetailsClick} disabled={true}>
              <Info className="mr-2" /> Details
            </Button>
            <Button
              className="w-full"
              onClick={onConnectClick}
              disabled={true}
            >
              <Power className="mr-2" /> Connect
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
