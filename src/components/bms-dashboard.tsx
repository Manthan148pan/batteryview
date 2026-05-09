
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getClientDatabase, ref, set, update, onValue, get, off } from '@/lib/firebase';
import type { BMSDevice, ClaimedDevice, DecodedBMSData, RawBMSDevice } from '@/types/bms';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ScanLine, Power, Timer, PlusCircle, Server, List, Globe, Clock, RefreshCw } from 'lucide-react';
import BMSCard from './bms-card';
import DetailsModal from './details-modal';
import PredictiveMaintenance from './predictive-maintenance';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { User } from 'firebase/auth';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from './ui/label';
import { format, formatDistanceToNow } from 'date-fns';
import { decodeBMSHex } from '@/lib/bms-decoder';
import { serverTimestamp } from 'firebase/database';
import { cn } from '@/lib/utils';

interface BMSDashboardProps {
  user: User | null;
  isAdmin: boolean;
  activeGateway: string | null;
  claimedDevices: ClaimedDevice[];
  devicesLoading: boolean;
  setActiveGateway: (deviceId: string | null) => void;
  bmsDevices: BMSDevice[];
  bmsDevicesLoading: boolean;
  scanInterval: number;
  autoConnectInterval: number;
  totalRegisteredBms: number;
  activeGatewayIds: Set<string>;
}

export default function BMSDashboard({ 
  user, 
  isAdmin, 
  activeGateway,
  claimedDevices,
  devicesLoading,
  setActiveGateway,
  bmsDevices,
  bmsDevicesLoading,
  scanInterval,
  autoConnectInterval,
  totalRegisteredBms,
  activeGatewayIds
}: BMSDashboardProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isConnectingAll, setIsConnectingAll] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<BMSDevice | null>(null);
  const [predictingDevice, setPredictingDevice] = useState<BMSDevice | null>(null);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [autoScanStartTime, setAutoScanStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState('');
  const { toast } = useToast();
  const { userProfile, user: authUser } = useAuth();
  
  const userPathUid = userProfile?.role === 'sub_user' ? userProfile.main_user_uid : authUser?.uid;
  const isMainUser = userProfile?.role === 'main_user';
  const isSubUser = userProfile?.role === 'sub_user';
  const hasFullControl = isMainUser || isAdmin;
  const dataListeners = useRef<Record<string, () => void>>({});

  const saveDataToHistory = useCallback((device: BMSDevice) => {
    const db = getClientDatabase();
    if (!userPathUid || !db || !device.hex_data) return;

    const now = new Date(); // Use client's local time to generate the date key
    const formattedDate = format(now, 'yyyy-MM-dd');
    
    // We will use a placeholder for the server to write the timestamp
    const historyPath = `users/${userPathUid}/bms_devices/${device.id}/history/${formattedDate}`;
    const newHistoryRef = ref(db, `${historyPath}/${now.getTime()}`);

    const gateway = claimedDevices.find(d => d.id === device.gatewayId);

    const historyData = {
        hex_data: device.hex_data,
        gateway_location: gateway?.location || 'N/A',
        source: 'web_manual_connect',
        timestamp: serverTimestamp() // Let Firebase server set the accurate time
    };

    set(newHistoryRef, historyData).catch(error => {
        console.error(`Failed to save history for ${device.id}:`, error);
    });
  }, [userPathUid, claimedDevices]);


  const handleConnect = useCallback(async (mac: string) => {
    const db = getClientDatabase();
    if (!userPathUid || !db) {
        toast({ variant: 'destructive', title: 'Error', description: 'Cannot perform connect action without user info.' });
        return;
    }

    const deviceToConnect = bmsDevices.find(d => d.id === mac);
    if (!deviceToConnect || !deviceToConnect.gatewayId) {
        toast({ variant: 'destructive', title: 'Device Not Found', description: 'Could not find the specified device or its gateway.' });
        return;
    }
    
    const gatewayId = deviceToConnect.gatewayId;
    const deviceNodePath = `linked_devices/${gatewayId}/bms_devices/${mac}/connect`;
    const dataNodePath = `linked_devices/${gatewayId}/bms_devices/${mac}`;

    // Remove previous listener if it exists
    if (dataListeners.current[mac]) {
        dataListeners.current[mac]();
        delete dataListeners.current[mac];
    }
    
    // Listen for the next data update
    const dataRef = ref(db, dataNodePath);
    const unsubscribe = onValue(dataRef, (snapshot) => {
        if (snapshot.exists()) {
            const updatedDevice = snapshot.val();
            // Check if hex_data has changed/updated
            if(updatedDevice.hex_data && updatedDevice.hex_data !== deviceToConnect.hex_data) {
                saveDataToHistory({ ...deviceToConnect, ...updatedDevice });
                toast({ title: 'Data Received', description: `Updated data for ${deviceToConnect.deviceNickname || mac} saved to history.`});
                unsubscribe(); // Stop listening after one successful update
                delete dataListeners.current[mac];
            }
        }
    }, { onlyOnce: false }); // `false` to keep listening until we manually unsubscribe

    dataListeners.current[mac] = unsubscribe;

    // Set a timeout to clean up the listener if no data is received
    setTimeout(() => {
        if (dataListeners.current[mac]) {
            dataListeners.current[mac](); // Unsubscribe
            delete dataListeners.current[mac];
            toast({ variant: 'destructive', title: 'Connection Timeout', description: `No new data received from ${deviceToConnect.deviceNickname || mac}.` });
        }
    }, 15000); // 15-second timeout


    toast({ title: 'Connection Sent', description: `Requesting connection to ${deviceToConnect.deviceNickname || mac}. Waiting for data...` });
    
    try {
      await set(ref(db, deviceNodePath), true);
    } catch (error: any) {
        console.error('Single connect failed:', error);
        toast({ variant: 'destructive', title: 'Connection Failed', description: error.message || 'An error occurred during the connect process.' });
        unsubscribe();
        delete dataListeners.current[mac];
    }
}, [toast, userPathUid, bmsDevices, saveDataToHistory]);
  
  const displayedDevices = useMemo(() => {
    if (!bmsDevices) return [];
    return bmsDevices
      .filter(device => device.available)
      .sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0));
  }, [bmsDevices]);


  const handleConnectAll = useCallback(async () => {
    const db = getClientDatabase();
    if (!userPathUid || !db || claimedDevices.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot perform Connect All without user or device info.' });
      return;
    }
  
    const onlineDevices = bmsDevices.filter(d => d.available);
    if (onlineDevices.length === 0) {
      toast({ title: 'No Devices Online', description: 'There are no available devices to connect to.' });
      return;
    }
  
    setIsConnectingAll(true);
    toast({ title: 'Connect All Initiated', description: `Connecting to ${onlineDevices.length} devices sequentially.` });
    
    const gatewayId = activeGateway === 'all' ? claimedDevices[0].id : activeGateway;
    if (!gatewayId) {
        setIsConnectingAll(false);
        toast({ variant: 'destructive', title: 'Error', description: 'No valid gateway found for connect all operation.' });
        return;
    }
    
    const controlPath = `linked_devices/${gatewayId}/bms_control/connect_all`;

    // Listen for data updates on all online devices
    onlineDevices.forEach(device => {
        const dataNodePath = `linked_devices/${device.gatewayId}/bms_devices/${device.id}`;
        const dataRef = ref(db, dataNodePath);
        
        // Remove previous listener if any
        if (dataListeners.current[device.id]) {
            dataListeners.current[device.id]();
        }

        const unsubscribe = onValue(dataRef, (snapshot) => {
            const updatedDeviceData = snapshot.val();
            if (updatedDeviceData && updatedDeviceData.hex_data !== device.hex_data) {
                saveDataToHistory({ ...device, ...updatedDeviceData });
                unsubscribe();
                delete dataListeners.current[device.id];
            }
        });
        dataListeners.current[device.id] = unsubscribe;
    });

    try {
        await set(ref(db, controlPath), true);
    } catch (error: any) {
        toast({
          variant: 'destructive',
          title: `Failed to initiate Connect All`,
          description: error.message || 'An unknown error occurred.',
        });
    }

    // Set a timeout to reset the UI state and clean up listeners
    setTimeout(() => {
        setIsConnectingAll(false);
        toast({ title: 'Connect All Command Sent', description: 'The gateway will now connect to all devices.' });
        Object.values(dataListeners.current).forEach(unsub => unsub());
        dataListeners.current = {};
    }, 20000); // 20-second timeout for all devices
  }, [userPathUid, claimedDevices, bmsDevices, toast, activeGateway, saveDataToHistory]);

  const handleScanDevices = useCallback(async () => {
    const db = getClientDatabase();
    if (!userPathUid || !db) return;

    const gatewayIdsToScan = activeGateway === 'all'
      ? claimedDevices.map(d => d.id)
      : (activeGateway ? [activeGateway] : []);

    if (gatewayIdsToScan.length === 0) {
        toast({ 
            variant: 'destructive',
            title: 'No Gateway Selected', 
            description: 'Please select a gateway device to initiate a scan.' 
        });
        return;
    }
    setIsScanning(true);

    const scanPromises = gatewayIdsToScan.map(id => {
      const controlPath = `linked_devices/${id}/bms_control/auto_scan`;
      return set(ref(db, controlPath), true);
    });

    try {
      await Promise.all(scanPromises);
      
      const deviceName = activeGateway === 'all' ? 'all gateways' : claimedDevices.find(d => d.id === activeGateway)?.assigned_name || activeGateway;
      toast({
          title: 'Scan Initiated',
          description: `Scan command sent to ${deviceName}. New devices will appear shortly.`,
      });
      
      setTimeout(() => setIsScanning(false), 5000); 

    } catch (error) {
      console.error('Failed to send scan command:', error);
      toast({
        variant: 'destructive',
        title: 'Scan Failed',
        description: 'Could not send scan command to one or more devices.',
      });
      setIsScanning(false)
    }
  }, [toast, activeGateway, claimedDevices, userPathUid]);


  useEffect(() => {
    const db = getClientDatabase();
    if (!hasFullControl || !activeGateway || activeGateway === 'all' || !db) {
        setIsAutoScanning(false);
        setAutoScanStartTime(null);
        return;
    }

    const controlRef = ref(db, `linked_devices/${activeGateway}/bms_control`);
    const unsubscribe = onValue(controlRef, (snapshot) => {
        const controls = snapshot.val();
        const isAuto = controls?.auto_scan_enabled === true;
        setIsAutoScanning(isAuto);

        if (isAuto && controls?.auto_scan_start_time) {
            setAutoScanStartTime(controls.auto_scan_start_time);
        } else {
            setAutoScanStartTime(null);
        }
    });

    return () => unsubscribe();
  }, [hasFullControl, activeGateway]);

  useEffect(() => {
    if (isAutoScanning && autoScanStartTime) {
      const updateElapsedTime = () => {
        const distance = formatDistanceToNow(new Date(autoScanStartTime), { includeSeconds: true });
        setElapsedTime(`for ${distance}`);
      };
      
      updateElapsedTime(); // Initial call
      const interval = setInterval(updateElapsedTime, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedTime('');
    }
  }, [isAutoScanning, autoScanStartTime]);
  

  const toggleAutoScan = async () => {
    const db = getClientDatabase();
    if (!activeGateway || activeGateway === 'all' || !db) {
        toast({
            variant: 'destructive',
            title: 'Action Failed',
            description: 'Please select a single gateway to toggle auto-scan.',
        });
        return;
    }

    const nextState = !isAutoScanning;
    const controlRef = ref(db, `linked_devices/${activeGateway}/bms_control`);
    
    try {
      const updates: any = { 
        auto_scan_enabled: nextState,
        auto_scan_start_time: nextState ? Date.now() : null,
        auto_scan_interval: nextState ? scanInterval * 60 : null, // Store interval in seconds
        auto_connect_interval: nextState ? autoConnectInterval : null, // Store interval in seconds
      };
      
      await update(controlRef, updates);
      
      if (nextState) {
        toast({
          title: 'Auto-Scan Enabled',
          description: `The gateway will now scan every ${scanInterval} minutes.`,
        });
      } else {
        toast({
          title: 'Auto-Scan Disabled',
          description: 'Gateway autonomous scanning has been stopped.',
        });
      }
    } catch (error) {
      console.error("Failed to update auto-scan setting:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update auto-scan setting.',
      });
    }
  };
  
  const canConnectAll = useMemo(() => {
    return bmsDevices.some(device => device.available) && !isConnectingAll && !isScanning;
  }, [bmsDevices, isConnectingAll, isScanning]);


  const serverIcon = (isActive: boolean) => (
    <div className='relative flex h-3 w-3'>
        {isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        <div className="flex flex-1 flex-col items-stretch gap-2">
          <div className="md:hidden w-full">
              <Select
                  value={activeGateway || ''}
                  onValueChange={setActiveGateway}
                  disabled={devicesLoading || claimedDevices.length === 0}
              >
                  <SelectTrigger id="gateway-selector-mobile">
                    <SelectValue placeholder="Select a Gateway..." />
                  </SelectTrigger>
                  <SelectContent>
                  {devicesLoading ? (
                      <SelectItem value="loading" disabled>Loading gateways...</SelectItem>
                  ) : claimedDevices && claimedDevices.length > 0 ? (
                      <>
                        {claimedDevices.length > 1 && (
                            <SelectItem value="all">
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    <span>All Gateways</span>
                                </div>
                            </SelectItem>
                        )}
                        {claimedDevices.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            <div className="flex items-center gap-2">
                                {serverIcon(activeGatewayIds.has(d.id))}
                                <span>{d.assigned_name} {d.scooter_no ? `[${d.scooter_no}]` : ''} ({d.location})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                  ) : (
                      <SelectItem value="no-devices" disabled>No gateways registered</SelectItem>
                  )}
                  </SelectContent>
              </Select>
          </div>
          
          <div className='flex items-center gap-2 justify-start flex-wrap sm:flex-nowrap'>
            {!isSubUser && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button 
                  id="scan-button" 
                  onClick={handleScanDevices} 
                  disabled={isScanning || isAutoScanning || !user || !activeGateway} 
                  className="flex-1 sm:flex-none gradient-bg text-primary-foreground h-11 sm:h-9"
                >
                    <ScanLine className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{isScanning ? 'Scanning...' : 'Scan'}</span>
                </Button>
                <Button 
                  id="connect-all-button" 
                  onClick={handleConnectAll} 
                  disabled={!canConnectAll || isAutoScanning || !activeGateway} 
                  className="flex-1 sm:flex-none gradient-bg text-primary-foreground h-11 sm:h-9"
                >
                    <Power className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{isConnectingAll ? 'Connecting...' : 'Connect All'}</span>
                </Button>
              </div>
            )}
            
            {isSubUser && (
              <Button asChild className="w-full sm:w-auto gradient-bg text-primary-foreground h-11 sm:h-9">
                <Link href="/scan">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Switch Battery
                </Link>
              </Button>
            )}

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {hasFullControl && (
                <div className="flex items-center gap-2 flex-1 sm:flex-none">
                    <Button 
                      id="auto-button" 
                      onClick={toggleAutoScan} 
                      variant={isAutoScanning ? 'destructive': 'outline'} 
                      disabled={!activeGateway || activeGateway === 'all'} 
                      className={cn(
                        "flex-1 sm:flex-none h-11 sm:h-9",
                        !isAutoScanning && "gradient-bg text-primary-foreground"
                      )}
                    >
                        <Timer className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{isAutoScanning ? 'Stop Auto' : 'Start Auto'}</span>
                    </Button>
                </div>
              )}

              {(isMainUser || isAdmin) && (
                <div className="md:hidden flex items-center space-x-2 p-2 bg-muted/60 rounded-lg border text-sm h-11 sm:h-9" id="registered-count-badge-mobile">
                    <List className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold text-foreground">
                      {totalRegisteredBms}
                    </span>
                    <span className="text-muted-foreground hidden xs:inline">Registered</span>
                </div>
              )}
            </div>
            
            {isAutoScanning && elapsedTime && (
              <div className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground p-2 rounded-md bg-muted/40 border border-dashed">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Scanning {elapsedTime}</span>
              </div>
            )}
          </div>

        </div>
        
        {(isMainUser || isAdmin) && (
          <div className="hidden md:flex items-center justify-start flex-wrap gap-x-4 gap-y-2 md:ml-auto">
                <div className="flex items-center space-x-2 p-2 bg-muted/60 rounded-md border text-sm" id="registered-count-badge">
                  <List className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {totalRegisteredBms}
                  </span>
                  <span className="text-muted-foreground">Registered</span>
              </div>
          </div>
        )}
      </div>
      
      {bmsDevicesLoading ? (
        <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col space-y-3">
              <Skeleton className="h-[300px] w-full max-w-sm" />
            </div>
          ))}
        </div>
      ) : !activeGateway ? (
         <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <Server className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-gray-100">
            No Gateway Selected
            </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Please register a device and select it as a gateway to begin.
          </p>
          {isMainUser &&
            <Button asChild className="mt-4">
                <Link href="/add-gateway">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Register a Gateway
                </Link>
            </Button>
          }
        </div>
      ) : displayedDevices.length > 0 ? (
        <div id="bms-card-list" className="flex flex-wrap gap-6 justify-center sm:justify-start">
            {displayedDevices.map((device, index) => {
                const RECENT_DEVICE_THRESHOLD_MS = 60 * 1000;
                const isNew = isAdmin && !!device.last_seen && (Date.now() - device.last_seen) < RECENT_DEVICE_THRESHOLD_MS;
                return (
                    <BMSCard
                    key={device.id}
                    device={device}
                    isNew={isNew}
                    showNickname={true}
                    onDetailsClick={() => setSelectedDevice(device)}
                    onPredictClick={() => setPredictingDevice(device)}
                    onConnectClick={() => handleConnect(device.id)}
                    isFirstCard={index === 0}
                    />
                );
            })}
        </div>
      ) : (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">
            No BMS Devices Found
            </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Click "Scan" to search for available batteries.
          </p>
        </div>
      )}

      <DetailsModal 
        device={selectedDevice} 
        isOpen={!!selectedDevice}
        onClose={() => setSelectedDevice(null)} 
        userId={user?.uid}
      />

      <Dialog open={!!predictingDevice} onOpenChange={(open) => !open && setPredictingDevice(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>AI Predictive Maintenance</DialogTitle>
            <DialogDescription>
              Predictive analysis for {predictingDevice?.deviceNickname || predictingDevice?.id}
            </DialogDescription>
          </DialogHeader>
          {predictingDevice && (
            <PredictiveMaintenance 
              activeGateway={predictingDevice.gatewayId} 
              deviceId={predictingDevice.id} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
