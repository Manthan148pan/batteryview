'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Header from '@/components/header';
import BMSDashboard from '@/components/bms-dashboard';
import SettingsModal from '@/components/settings-modal';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from '@/components/ui/button';
import { getClientDatabase, ref, get, onValue, update, set } from '@/lib/firebase';
import { ClaimedDevice, BMSDevice, RawBMSDevice } from '@/types/bms';
import ActiveAlerts from '@/components/active-alerts';
import PredictiveMaintenance from '@/components/predictive-maintenance';
import { QrCode } from 'lucide-react';
import { decodeBMSHex } from '@/lib/bms-decoder';
import { detectFaults } from '@/lib/fault-detector';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import TourGuide from '@/components/tour-guide';
import Link from 'next/link';

interface ManualBMSDevice {
  deviceNickname?: string;
  status?: 'active' | 'archived';
  // other properties if they exist
}

interface DeviceState {
  connect: boolean;
  hex_data: string;
}

const EXCLUDED_KEYS = ['bms_control'];

export default function DashboardPage() {
  const { user, userProfile, isAuthenticated, loading, sendVerificationEmail, logout, isAdmin } = useAuth();
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [scanInterval, setScanInterval] = useState(10);
  const [autoConnectInterval, setAutoConnectInterval] = useState(5);
  const [claimedDevices, setClaimedDevices] = useState<ClaimedDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [activeGateway, setActiveGateway] = useState<string | null>(null);

  const [bmsDevices, setBmsDevices] = useState<BMSDevice[]>([]);
  const [bmsDevicesLoading, setBmsDevicesLoading] = useState(true);
  const [manualBmsDevices, setManualBmsDevices] = useState<Record<string, ManualBMSDevice>>({});
  const { toast } = useToast();

  const [runTour, setRunTour] = useState(false);

  const isMainUser = userProfile?.role === 'main_user';
  const isSubUser = userProfile?.role === 'sub_user';
  const mainUserUidForSubUser = userProfile?.main_user_uid;
  const userPathUid = isSubUser ? mainUserUidForSubUser : user?.uid;
  const hasFullControl = isMainUser || isAdmin || (isSubUser && (userProfile?.permissions?.canAddGateway || userProfile?.permissions?.canRegisterBms));


  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const tourViewed = localStorage.getItem('tourViewed');
    if (!tourViewed && !loading && isAuthenticated) {
      setRunTour(true);
      localStorage.setItem('tourViewed', 'true');
    }
  }, [loading, isAuthenticated]);

  const fetchClaimedDevices = useCallback(async () => {
    const db = getClientDatabase();
    if (!userPathUid || !db) {
      setDevicesLoading(false);
      return;
    }
    setDevicesLoading(true);
    try {
      const userDevicesRef = ref(db, `users/${userPathUid}/linked_devices`);
      const snapshot = await get(userDevicesRef);

      if (snapshot.exists()) {
        const devicesData = snapshot.val();
        const devices: ClaimedDevice[] = Object.keys(devicesData).map(deviceId => ({
          id: deviceId,
          assigned_name: devicesData[deviceId].assigned_name || 'N/A',
          location: devicesData[deviceId].location || 'N/A',
          scooter_no: devicesData[deviceId].scooter_no || ''
        }));
        setClaimedDevices(devices);

      } else {
        setClaimedDevices([]);
      }
    } catch (error) {
      console.error("Failed to fetch claimed devices:", error);
    } finally {
      setDevicesLoading(false);
    }
  }, [userPathUid]);

  useEffect(() => {
    const db = getClientDatabase();
    if (!db) return;

    const fetchManualBmsDevices = async () => {
      if (!userPathUid) return;
      try {
        const manualDevicesRef = ref(db, `users/${userPathUid}/bms_devices`);
        const snapshot = await get(manualDevicesRef);
        if (snapshot.exists()) {
          setManualBmsDevices(snapshot.val());
        } else {
          setManualBmsDevices({});
        }
      } catch (error) {
        console.error("Failed to fetch manually registered BMS devices:", error);
      }
    }

    if (!loading && userPathUid) {
      fetchClaimedDevices();
      fetchManualBmsDevices();
    }
  }, [user, loading, userPathUid, fetchClaimedDevices]);

  useEffect(() => {
    const db = getClientDatabase();
    if (!userPathUid || !db) return;

    const activeDeviceRef = ref(db, `users/${userPathUid}/settings/activeGateway`);
    const unsubscribe = onValue(activeDeviceRef, (snapshot) => {
      const savedGateway = snapshot.val();
      if (savedGateway) {
        setActiveGateway(savedGateway);
      } else if (claimedDevices.length > 0) {
        // For Riders, default to their active_gateway if it exists
        if (isSubUser && userProfile?.active_gateway) {
          setActiveGateway(userProfile.active_gateway);
        } else {
          const initialDevice = claimedDevices.length > 1 ? 'all' : claimedDevices[0].id;
          setActiveGateway(initialDevice);
          set(activeDeviceRef, initialDevice);
        }
      }
    });

    return () => unsubscribe();

  }, [userPathUid, claimedDevices, isSubUser, userProfile?.active_device]);


  useEffect(() => {
    const db = getClientDatabase();
    if (!userPathUid || Object.keys(manualBmsDevices).length === 0 || !db) {
      setBmsDevicesLoading(false);
      setBmsDevices([]);
      return;
    }
    setBmsDevicesLoading(true);

    const registeredBmsIds = Object.keys(manualBmsDevices).filter(mac => manualBmsDevices[mac].status !== 'archived');

    const gatewayIds = activeGateway === 'all'
      ? claimedDevices.map(d => d.id)
      : (activeGateway ? [activeGateway] : []);

    if (gatewayIds.length === 0 || registeredBmsIds.length === 0) {
      setBmsDevices([]);
      setBmsDevicesLoading(false);
      return;
    }

    const unsubscribes: (() => void)[] = [];
    const allGatewayBmsDevices: Record<string, BMSDevice> = {};

    gatewayIds.forEach(gatewayId => {
      const devicesRef = ref(db, `linked_devices/${gatewayId}/bms_devices`);
      const unsubscribe = onValue(devicesRef, (snapshot) => {
        const data = snapshot.val() as Record<string, RawBMSDevice> | null;

        const currentGatewayDevices: Record<string, BMSDevice> = {};
        if (data) {
          Object.entries(data)
            .filter(([key]) => !EXCLUDED_KEYS.includes(key))
            .filter(([mac]) => registeredBmsIds.includes(mac))
            .forEach(([mac, dev]) => {
              const manualDevice = manualBmsDevices[mac];
              const decodedData = dev.hex_data ? decodeBMSHex(dev.hex_data) : undefined;
              const faults = detectFaults(decodedData);

              const processedDevice: BMSDevice = {
                ...dev,
                id: mac,
                decodedData,
                faults,
                deviceNickname: manualDevice?.deviceNickname || dev.deviceNickname,
                gatewayId: gatewayId,
              };

              currentGatewayDevices[mac] = processedDevice;
            });
        }

        // Merge devices from this gateway with devices from other gateways
        Object.assign(allGatewayBmsDevices, currentGatewayDevices);

        // Update the main state with the combined list from all gateways
        setBmsDevices(Object.values(allGatewayBmsDevices));
      }, (error) => {
        console.error(`Firebase read failed for ${gatewayId}:`, error.message);
        toast({
          variant: 'destructive',
          title: 'Data Read Error',
          description: `Could not fetch data for gateway ${gatewayId}.`
        });
      });
      unsubscribes.push(unsubscribe);
    });

    setBmsDevicesLoading(false);

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeGateway, claimedDevices, toast, manualBmsDevices, userPathUid]);


  const handleResendVerification = async () => {
    try {
      await sendVerificationEmail();
      alert("Verification email sent! Please check your inbox.");
    } catch (error) {
      console.error(error);
      alert("Failed to send verification email. Please try again.");
    }
  };

  const handleActiveGatewayChange = (deviceId: string | null) => {
    const db = getClientDatabase();
    if (!userPathUid || !deviceId || !db) return;
    const activeDeviceRef = ref(db, `users/${userPathUid}/settings/activeGateway`);
    set(activeDeviceRef, deviceId);
  }

  const totalRegisteredBmsCount = useMemo(() => {
    return Object.values(manualBmsDevices).filter(dev => dev && dev.status !== 'archived').length;
  }, [manualBmsDevices]);

  const activeGatewayIds = useMemo(() => {
    const activeIds = new Set<string>();
    bmsDevices.forEach(device => {
      if (device.available && device.gatewayId) {
        activeIds.add(device.gatewayId);
      }
    });
    return activeIds;
  }, [bmsDevices]);

  const activeAlertsCount = useMemo(() => {
    return bmsDevices.reduce((acc, device) => acc + (device.faults?.length || 0), 0);
  }, [bmsDevices]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex flex-col h-screen">
        <Header
          onSettingsClick={() => setIsSettingsOpen(true)}
          onStartTourClick={() => setRunTour(true)}
          claimedDevices={claimedDevices}
          devicesLoading={devicesLoading}
          activeGateway={activeGateway}
          setActiveGateway={handleActiveGatewayChange}
          activeGatewayIds={activeGatewayIds}
        />
        <div className="flex-grow p-6">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-36" />
              <Skeleton className="h-10 w-36" />
            </div>
            <div className="flex items-center space-x-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex flex-col space-y-3">
                <Skeleton className="h-[300px] w-[380px] rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (user && !user.emailVerified && !isAdmin && !isSubUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6">
          <Alert variant="destructive">
            <AlertTitle>Email Verification Required</AlertTitle>
            <AlertDescription>
              Your email address has not been verified yet. Please check your inbox for the verification link.
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-4">
            <Button onClick={handleResendVerification}>Resend Verification Email</Button>
            <Button variant="outline" onClick={logout}>Back to Login</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <TourGuide run={runTour} setRun={setRunTour} />
      <Header
        onSettingsClick={() => setIsSettingsOpen(true)}
        onStartTourClick={() => setRunTour(true)}
        claimedDevices={claimedDevices}
        devicesLoading={devicesLoading}
        activeGateway={activeGateway}
        setActiveGateway={handleActiveGatewayChange}
        activeGatewayIds={activeGatewayIds}
        alertsCount={activeAlertsCount}
      />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isSubUser && (!userProfile?.active_device || !userProfile?.active_gateway) ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-card rounded-3xl shadow-sm border border-dashed border-primary/20 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <QrCode className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl font-bold mb-4 tracking-tight">Ready to Ride?</h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-sm">
              Select your company and scooter, then scan your battery's QR code to begin.
            </p>
            <Button size="lg" asChild className="h-14 px-10 text-lg rounded-2xl gradient-bg shadow-lg hover:shadow-xl transition-all active:scale-95">
              <Link href="/scan">
                <QrCode className="mr-3 h-6 w-6" /> Setup Ride
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <BMSDashboard
                user={user}
                isAdmin={isAdmin}
                activeGateway={activeGateway}
                claimedDevices={claimedDevices}
                devicesLoading={devicesLoading}
                setActiveGateway={handleActiveGatewayChange}
                bmsDevices={bmsDevices}
                bmsDevicesLoading={bmsDevicesLoading}
                scanInterval={scanInterval}
                autoConnectInterval={autoConnectInterval}
                totalRegisteredBms={totalRegisteredBmsCount}
                activeGatewayIds={activeGatewayIds}
              />
            </div>
            <div className="space-y-6">
              {(isMainUser || isAdmin) && <PredictiveMaintenance activeGateway={activeGateway} />}
              {/* Other sidebar components can go here */}
            </div>
          </div>
        )}
      </main>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        scanInterval={scanInterval}
        setScanInterval={setScanInterval}
        autoConnectInterval={autoConnectInterval}
        setAutoConnectInterval={setAutoConnectInterval}
        claimedDevices={claimedDevices}
        devicesLoading={devicesLoading}
        hasFullControl={hasFullControl}
        onDeviceUpdate={fetchClaimedDevices}
      />
    </div>
  );
}
