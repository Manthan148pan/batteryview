
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Battery, Zap, Thermometer, AlertTriangle, ShieldAlert, Info, BatteryFull } from 'lucide-react';
import type { BMSDevice, Fault } from '@/types/bms';

interface ActiveAlertsProps {
  devices: BMSDevice[];
}

const faultIcons: Record<Fault['type'], React.ReactNode> = {
    'Over-voltage': <Zap className="h-5 w-5 text-destructive" />,
    'Under-voltage': <Battery className="h-5 w-5 text-destructive" />,
    'Short-circuit': <ShieldAlert className="h-5 w-5 text-destructive" />,
    'Over-heat': <Thermometer className="h-5 w-5 text-destructive" />,
    'Under-heat': <Thermometer className="h-5 w-5 text-warning-foreground" />,
    'Over-current': <Zap className="h-5 w-5 text-destructive" />,
    'Cell Imbalance': <AlertTriangle className="h-5 w-5 text-warning-foreground" />,
    'Low SOC': <Info className="h-5 w-5 text-info-foreground" />,
    'Fully Charged': <BatteryFull className="h-5 w-5 text-green-500" />,
};

const faultSeverityOrder: Record<Fault['severity'], number> = {
    critical: 1,
    warning: 2,
    info: 3,
};

export default function ActiveAlerts({ devices }: ActiveAlertsProps) {
  const allAlerts = devices
    .flatMap(device => 
        (device.faults || []).map(fault => ({ ...fault, device }))
    )
    .sort((a, b) => faultSeverityOrder[a.severity] - faultSeverityOrder[b.severity]);
  
  const getAlertClasses = (alert: Fault) => {
    if (alert.type === 'Fully Charged') {
        return 'border-green-500/50 bg-green-500/10 text-green-600';
    }
    switch (alert.severity) {
      case 'critical':
        return 'border-destructive/50 bg-destructive/10 text-destructive';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600';
      case 'info':
        return 'border-blue-500/50 bg-blue-500/10 text-blue-600';
      default:
        return 'border-muted-foreground/50 bg-muted/50';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <AlertCircle className="mr-2 h-6 w-6 text-primary" />
          Active Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {allAlerts.length > 0 ? (
          <div className="space-y-4">
            {allAlerts.map((alert, index) => (
              <div
                key={`${alert.device.id}-${alert.type}-${index}`}
                className={`flex items-center rounded-lg border p-3 ${getAlertClasses(alert)}`}
              >
                <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/50">
                  {faultIcons[alert.type] || <AlertCircle />}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{alert.device.deviceNickname || alert.device.id}</p>
                  <p className="text-sm">
                    <strong>{alert.type}:</strong> {alert.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            No active alerts. All systems normal.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
