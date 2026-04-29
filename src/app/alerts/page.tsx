'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { getClientDatabase, ref, onValue, get } from '@/lib/firebase';
import { BMSDevice, RawBMSDevice, ClaimedDevice, Fault } from '@/types/bms';
import { decodeBMSHex } from '@/lib/bms-decoder';
import { detectFaults } from '@/lib/fault-detector';
import { cn } from '@/lib/utils';
import { 
  AlertCircle, 
  Battery, 
  Zap, 
  Thermometer, 
  AlertTriangle, 
  ShieldAlert, 
  Info, 
  BatteryFull,
  ArrowLeft,
  ChevronRight,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';

const faultIcons: Record<string, React.ReactNode> = {
    'Over-voltage': <Zap className="h-6 w-6 text-destructive" />,
    'Under-voltage': <Battery className="h-6 w-6 text-destructive" />,
    'Short-circuit': <ShieldAlert className="h-6 w-6 text-destructive" />,
    'Over-heat': <Thermometer className="h-6 w-6 text-destructive" />,
    'Under-heat': <Thermometer className="h-6 w-6 text-warning" />,
    'Over-current': <Zap className="h-6 w-6 text-destructive" />,
    'Cell Imbalance': <AlertTriangle className="h-6 w-6 text-warning" />,
    'Low SOC': <Info className="h-6 w-6 text-blue-500" />,
    'Fully Charged': <BatteryFull className="h-6 w-6 text-green-500" />,
};

const faultSeverityOrder: Record<string, number> = {
    critical: 1,
    warning: 2,
    info: 3,
};

export default function AlertsPage() {
  const { user, userProfile, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  
  const [bmsDevices, setBmsDevices] = useState<BMSDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [claimedDevices, setClaimedDevices] = useState<ClaimedDevice[]>([]);
  const [activeGateway, setActiveGateway] = useState<string | null>(null);

  const userPathUid = userProfile?.role === 'sub_user' ? userProfile.main_user_uid : user?.uid;

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // 1. Fetch Claimed Gateways
  useEffect(() => {
    const db = getClientDatabase();
    if (!userPathUid || !db) return;

    const fetchDevices = async () => {
      const userDevicesRef = ref(db, `users/${userPathUid}/linked_devices`);
      const snapshot = await get(userDevicesRef);
      if (snapshot.exists()) {
        const devicesData = snapshot.val();
        setClaimedDevices(Object.keys(devicesData).map(id => ({ id, ...devicesData[id] })));
      }
    };

    const fetchActiveGateway = async () => {
        const activeRef = ref(db, `users/${userPathUid}/settings/activeGateway`);
        const snap = await get(activeRef);
        if (snap.exists()) setActiveGateway(snap.val());
    };

    fetchDevices();
    fetchActiveGateway();
  }, [userPathUid]);

  // 2. Fetch BMS Devices and Alerts
  useEffect(() => {
    const db = getClientDatabase();
    if (!userPathUid || !db) return;

    const manualDevicesRef = ref(db, `users/${userPathUid}/bms_devices`);
    get(manualDevicesRef).then(snap => {
      if (!snap.exists()) {
        setLoadingDevices(false);
        return;
      }
      const manualDevices = snap.val();
      const registeredBmsIds = Object.keys(manualDevices).filter(mac => manualDevices[mac].status !== 'archived');
      
      const gatewayIds = claimedDevices.map(d => d.id);
      if (gatewayIds.length === 0) {
        setLoadingDevices(false);
        return;
      }

      const unsubscribes: (() => void)[] = [];
      const allDevices: Record<string, BMSDevice> = {};

      gatewayIds.forEach(gwId => {
        const devicesRef = ref(db, `linked_devices/${gwId}/bms_devices`);
        const unsub = onValue(devicesRef, (snapshot) => {
          const data = snapshot.val() as Record<string, RawBMSDevice> | null;
          if (data) {
            Object.entries(data)
              .filter(([mac]) => registeredBmsIds.includes(mac))
              .forEach(([mac, dev]) => {
                const decoded = dev.hex_data ? decodeBMSHex(dev.hex_data) : undefined;
                allDevices[mac] = {
                  ...dev,
                  id: mac,
                  decodedData: decoded,
                  faults: detectFaults(decoded),
                  deviceNickname: manualDevices[mac]?.deviceNickname || dev.deviceNickname,
                  gatewayId: gwId
                };
              });
            setBmsDevices(Object.values(allDevices));
          }
        });
        unsubscribes.push(unsub);
      });

      setLoadingDevices(false);
      return () => unsubscribes.forEach(u => u());
    });
  }, [userPathUid, claimedDevices]);

  const allAlerts = useMemo(() => {
    return bmsDevices
      .flatMap(device => 
          (device.faults || []).map(fault => ({ ...fault, device }))
      )
      .sort((a, b) => faultSeverityOrder[a.severity] - faultSeverityOrder[b.severity]);
  }, [bmsDevices]);

  const activeAlertsCount = allAlerts.length;

  if (loading || loadingDevices) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading alerts...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Active Alerts</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8">
            <div>
               <p className="text-muted-foreground mt-1">Real-time system health monitoring</p>
            </div>
            <Badge variant={activeAlertsCount > 0 ? "destructive" : "outline"} className="px-4 py-1 text-sm font-bold">
              {activeAlertsCount} ACTIVE FAULTS
            </Badge>
          </div>

          {activeAlertsCount > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {allAlerts.map((alert, idx) => (
                <Card key={`${alert.device.id}-${idx}`} className="bg-white border border-border shadow-sm overflow-hidden h-full">
                  <CardContent className="p-4 flex flex-col h-full">
                    {/* Device Icon & ID */}
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        alert.severity === 'critical' ? 'text-destructive' : 
                        alert.severity === 'warning' ? 'text-orange-500' : 'text-blue-500'
                      )}>
                        {faultIcons[alert.type] || <AlertCircle className="h-5 w-5" />}
                      </div>
                      <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase opacity-50">
                        {alert.device.id.slice(-4)}
                      </span>
                    </div>

                    {/* Alert Title */}
                    <h3 className={cn(
                      "text-sm font-bold leading-tight mb-1",
                      alert.type === 'Fully Charged' ? 'text-green-600' : 'text-destructive'
                    )}>
                      {alert.type}
                    </h3>

                    <p className="text-[12px] font-medium text-foreground mb-4 flex-1">
                      {alert.device.deviceNickname || 'Unnamed Battery'}
                    </p>

                    <div className="space-y-2 pt-3 border-t">
                      <div className="flex justify-between text-[10px] uppercase font-bold tracking-tighter">
                        <span className="text-muted-foreground">SOC</span>
                        <span className={alert.device.decodedData?.soc && alert.device.decodedData.soc < 20 ? "text-destructive" : ""}>
                          {alert.device.decodedData?.soc}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] uppercase font-bold tracking-tighter">
                        <span className="text-muted-foreground">Voltage</span>
                        <span>{alert.device.decodedData?.totalVoltage}V</span>
                      </div>
                    </div>

                    <Button variant="link" asChild className="p-0 h-auto mt-4 text-[11px] justify-start text-blue-600">
                      <Link href={`/history?deviceId=${alert.device.id}`}>
                        View Details →
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white border rounded-2xl shadow-sm">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                    <BatteryFull className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-1 text-green-600">No Active Alerts</h2>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-6">
                    All connected batteries are currently operating within safe parameters.
                </p>
                <Button variant="outline" asChild className="rounded-xl">
                    <Link href="/">Return to Dashboard</Link>
                </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
