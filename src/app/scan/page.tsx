'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db, ref, push, serverTimestamp, update, get, onValue } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, CameraOff, CheckCircle, QrCode, PowerOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ScannedData {
  macId: string;
  nickname: string;
  capacity?: string;
}

interface Company {
  uid: string;
  name: string;
}

interface Scooter {
  id: string;
  name: string;
  scooterNo: string;
}

export default function ScanPage() {
  const [scannedData, setScannedData] = useState<ScannedData | null>(null);
  const [hasPermission, setHasPermission] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [scooters, setScooters] = useState<Scooter[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedScooter, setSelectedScooter] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);
  const [inventoryAction, setInventoryAction] = useState<'IN' | 'OUT' | null>(null);
  const [liveBmsData, setLiveBmsData] = useState<any>(null);
  const [activeGateway, setActiveGateway] = useState<string | null>(null);

  const { user, userProfile, updateUserProfile, loginAnonymously } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const isCompany = userProfile?.role === 'main_user';
  const hasActiveSetup = !isCompany && !!(userProfile?.active_device || userProfile?.active_gateway);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!db || hasActiveSetup || isCompany) return;
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        const usersData = snapshot.val();
        const companiesList: Company[] = [];
        for (const [uid, data] of Object.entries(usersData) as [string, any][]) {
          if (data.role === 'main_user' && data.companyName) {
            companiesList.push({ uid, name: data.companyName });
          }
        }
        setCompanies(companiesList);
      }
    };
    fetchCompanies();
  }, [hasActiveSetup, isCompany]);

  useEffect(() => {
    const fetchScooters = async () => {
      const companyId = isCompany ? user?.uid : selectedCompany;
      if (!db || !companyId) {
        setScooters([]);
        return;
      }
      const linkedRef = ref(db, `users/${companyId}/linked_devices`);
      const snapshot = await get(linkedRef);
      if (snapshot.exists()) {
        const devices = snapshot.val();
        const scootersList: Scooter[] = [];
        for (const [id, data] of Object.entries(devices) as [string, any][]) {
          scootersList.push({
            id,
            name: data.assigned_name || id,
            scooterNo: data.scooter_no || ''
          });
        }
        setScooters(scootersList);
      } else {
        setScooters([]);
      }
    };
    fetchScooters();
  }, [selectedCompany, isCompany, user?.uid]);

  useEffect(() => {
    if (!db || !isCompany || !user?.uid) return;
    const activeRef = ref(db, `users/${user.uid}/settings/activeGateway`);
    const unsubscribe = onValue(activeRef, (snapshot) => {
        setActiveGateway(snapshot.val() || 'all');
    });
    return () => unsubscribe();
  }, [db, isCompany, user?.uid]);

  useEffect(() => {
    if (!scannedData?.macId || !db || !isCompany || !user?.uid || !activeGateway) return;

    // Try to find which gateway this battery is currently on
    const fetchLiveStats = async () => {
        try {
            const companyId = user.uid;
            
            // Determine which gateways to search
            let gatewaysToSearch: string[] = [];
            if (activeGateway === 'all') {
                const linkedRef = ref(db, `users/${companyId}/linked_devices`);
                const snapshot = await get(linkedRef);
                if (snapshot.exists()) {
                    gatewaysToSearch = Object.keys(snapshot.val());
                }
            } else {
                gatewaysToSearch = [activeGateway];
            }
            
            // Check selected gateway(s) for this battery's data
            for (const gatewayId of gatewaysToSearch) {
                const bmsRef = ref(db, `linked_devices/${gatewayId}/bms_devices/${scannedData.macId}`);
                const bmsSnap = await get(bmsRef);
                if (bmsSnap.exists()) {
                    const data = bmsSnap.val();
                    if (data.hex_data) {
                        const { decodeBMSHex } = await import('@/lib/bms-decoder');
                        setLiveBmsData(decodeBMSHex(data.hex_data));
                        break; 
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch diagnostic data", e);
        }
    };
    
    fetchLiveStats();
  }, [scannedData?.macId, isCompany, user?.uid, db, activeGateway]);

  useEffect(() => {
    const startScanner = async () => {
      if (!showScanner || hasActiveSetup || scannedData) return;
      try {
        await Html5Qrcode.getCameras();
        setHasPermission(true);
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        const qrCodeSuccessCallback = async (decodedText: string) => {
          try {
            const data = JSON.parse(decodedText);
            // Case 1: Battery QR
            if (data.macId && data.nickname) {
              setScannedData(data);
              scanner.stop();
            } 
            // Case 2: Scooter/Gateway QR (e.g., {"gatewayId": "...", "companyId": "..."})
            else if (data.gatewayId) {
                setScannedData(data);
                scanner.stop();
                if (!isCompany) {
                    // Auto-trigger link for riders
                    await handleLogStatus('IN');
                }
            }
          } catch (error) {
            toast({ variant: 'destructive', title: 'Invalid QR Code', description: 'This QR code does not contain valid data.' });
          }
        };

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        scanner.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, undefined);

      } catch (err) {
        setHasPermission(false);
        console.error("Camera permission error:", err);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Failed to stop scanner:", err));
      }
    };
  }, [showScanner, hasActiveSetup, scannedData, toast]);

  const handleStartScan = () => {
    setShowScanner(true);
  };

  const handleLogStatus = async (status: 'IN' | 'OUT') => {
    if (!db) return;
    setIsSubmitting(true);

    try {
      // 1. If Rider (sub_user) and Unlinking
      const isRider = userProfile?.role === 'sub_user';
      const isUnlink = status === 'OUT' && isRider;
      
      if (isRider) {
        if (!user) {
          // If rider somehow scans without auth, sign in anonymously
          await loginAnonymously();
        }

        const targetCompanyId = isUnlink ? userProfile?.main_user_uid : (scannedData as any)?.companyId || selectedCompany;
        const targetBatteryId = isUnlink ? userProfile?.active_device : scannedData?.macId;
        const targetBatteryNickname = isUnlink ? 'Active Battery' : scannedData?.nickname;
        const targetGatewayId = isUnlink ? userProfile?.active_gateway : (scannedData as any)?.gatewayId || selectedScooter;

        if (!targetCompanyId || !targetGatewayId) {
            throw new Error('This QR code is not registered to a company. Please contact support.');
        }

        // Log the status to history
        const historyRef = ref(db, `users/${targetCompanyId}/bms_scan_history/${targetBatteryId || 'GUEST_LINK'}`);
        await push(historyRef, {
          status: status,
          timestamp: serverTimestamp(),
          scannedBy: userProfile?.fullName || 'Guest Rider',
          nickname: targetBatteryNickname || 'Scanned Device',
          gatewayId: targetGatewayId,
          type: 'rider_link'
        });

        // Link/Unlink profile
        const userRef = ref(db, `users/${user?.uid}`);
        const updateData = isUnlink ? {
          active_device: null,
          active_gateway: null,
          main_user_uid: null
        } : {
          active_device: targetBatteryId || null,
          active_gateway: targetGatewayId,
          main_user_uid: targetCompanyId,
          last_connect_time: Date.now()
        };

        await update(userRef, updateData);
        if (updateUserProfile) {
            await updateUserProfile(updateData as any);
        }

        toast({
          title: isUnlink ? 'Battery Unlinked' : 'Scooter Connected',
          description: isUnlink ? 'Successfully unlinked.' : 'You can now monitor your battery percentage.',
        });

        if (!isUnlink) router.push('/');
        else {
           setScannedData(null);
           setShowScanner(false);
        }
      } else if (isCompany) {
        // Company Flow (Unchanged logic but using local variables)
        const targetCompanyId = user?.uid;
        const targetBatteryId = scannedData?.macId;
        const targetBatteryNickname = scannedData?.nickname;
        const targetGatewayId = status === 'OUT' ? selectedScooter : 'CHARGER';

        if (!targetCompanyId || !targetBatteryId || (!targetGatewayId && status === 'OUT')) {
            toast({ variant: 'destructive', title: 'Missing Data', description: 'Please select a scooter.' });
            setIsSubmitting(false);
            return;
        }

        const historyRef = ref(db, `users/${targetCompanyId}/bms_scan_history/${targetBatteryId}`);
        await push(historyRef, {
          status: status,
          timestamp: serverTimestamp(),
          scannedBy: userProfile?.fullName || user?.email || 'Admin',
          nickname: targetBatteryNickname,
          gatewayId: targetGatewayId,
          type: 'inventory'
        });

        toast({
          title: `Inventory Logged ${status}`,
          description: `${targetBatteryNickname} logged as ${status === 'IN' ? 'Charging' : 'Assigned'}.`,
        });
        setScannedData(null);
        setInventoryAction(null);
        setSelectedScooter('');
      }

    } catch (error: any) {
      console.error("Scan submission failed:", error);
      toast({ variant: 'destructive', title: 'Action Failed', description: error.message || 'Could not complete the request.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescan = () => {
    setScannedData(null);
    setLiveBmsData(null);
    setInventoryAction(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              {isCompany ? 'Inventory Scan' : (hasActiveSetup ? 'Active Connection' : 'Rider Setup & Scan')}
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 items-center justify-center py-12 px-4">
        {hasActiveSetup ? (
            <Card className="w-full max-w-md">
                 <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                    <CheckCircle className="w-16 h-16 text-green-500" />
                    </div>
                    <CardTitle className="text-2xl">Active Connection</CardTitle>
                    <CardDescription>
                    You are currently connected to a scooter and battery. You must unlink before selecting a new one.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-center">
                    <div className="p-4 bg-muted rounded-lg text-sm">
                        <p className="font-semibold text-foreground mb-1">Current Scooter (Gateway)</p>
                        <p className="text-muted-foreground font-mono">{userProfile.active_gateway}</p>
                        <p className="font-semibold text-foreground mt-4 mb-1">Current Battery (BMS)</p>
                        <p className="text-muted-foreground font-mono">{userProfile.active_device}</p>
                    </div>
                    <Button 
                        size="lg" 
                        onClick={() => handleLogStatus('OUT')} 
                        disabled={isSubmitting} 
                        className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                        <PowerOff className="mr-2 h-4 w-4" /> Unlink (OUT)
                    </Button>
                </CardContent>
            </Card>
        ) : (
            <Card className="w-full max-w-md">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <QrCode className="w-12 h-12 text-primary" />
                </div>
                <CardTitle className="text-2xl">{isCompany ? 'Inventory Management' : 'Connect Battery'}</CardTitle>
                <CardDescription>
                {scannedData ? 'Scan complete. Choose action.' : (showScanner ? 'Point your camera at a battery QR code.' : (isCompany ? 'Scan a battery to log its status.' : 'Select your company and scooter to begin.'))}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!showScanner && !scannedData ? (
                    <div className="space-y-6">
                        {isCompany ? (
                            <Button 
                                onClick={handleStartScan} 
                                className="w-full gradient-bg text-primary-foreground h-16 text-lg rounded-2xl shadow-lg"
                                size="lg"
                            >
                                <QrCode className="mr-3 h-6 w-6"/> Scan Battery
                            </Button>
                        ) : !hasActiveSetup ? (
                            <div className="space-y-6">
                                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        Scan the QR code on your scooter to automatically connect and start monitoring.
                                    </p>
                                </div>
                                <Button 
                                    onClick={handleStartScan} 
                                    className="w-full h-16 text-lg rounded-2xl gradient-bg shadow-lg hover:shadow-xl transition-all"
                                    size="lg"
                                >
                                    <QrCode className="mr-3 h-6 w-6"/> Start Scanner
                                </Button>
                            </div>
                        ) : null}
                    </div>
                ) : !hasPermission ? (
                <Alert variant="destructive">
                    <CameraOff className="h-4 w-4" />
                    <AlertTitle>Camera Permission Denied</AlertTitle>
                    <AlertDescription>
                    Please grant camera access in your browser settings to use the scanner.
                    </AlertDescription>
                </Alert>
                ) : scannedData ? (
                <div className="space-y-4 text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                    <h3 className="text-lg font-semibold">{scannedData.nickname}</h3>
                    <p className="text-sm text-muted-foreground font-mono">{scannedData.macId}</p>
                    
                    {isCompany ? (
                        <div className="space-y-4 pt-4">
                            {/* Diagnostic Snapshot */}
                            {liveBmsData && (
                                <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-xl border border-primary/10 mb-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="text-center">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">SOC</p>
                                        <p className="text-lg font-bold text-primary">{liveBmsData.soc}%</p>
                                    </div>
                                    <div className="text-center border-x">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Voltage</p>
                                        <p className="text-lg font-bold text-primary">{liveBmsData.totalVoltage}V</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Temp</p>
                                        <p className="text-lg font-bold text-primary">{liveBmsData.avgTemp}°C</p>
                                    </div>
                                </div>
                            )}

                            {!inventoryAction ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50" onClick={() => handleLogStatus('IN')}>
                                        Log IN (Charging)
                                    </Button>
                                    <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50" onClick={() => setInventoryAction('OUT')}>
                                        Log OUT (Scooter)
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="space-y-2 text-left">
                                        <label className="text-sm font-medium">Assign to Scooter</label>
                                        <Select value={selectedScooter} onValueChange={setSelectedScooter}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a Scooter..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {scooters.map(scooter => (
                                                    <SelectItem key={scooter.id} value={scooter.id}>
                                                        {scooter.name} {scooter.scooterNo ? `[${scooter.scooterNo}]` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" className="flex-1" onClick={() => {setInventoryAction(null); setSelectedScooter('');}}>Cancel</Button>
                                        <Button className="flex-2 bg-blue-600 hover:bg-blue-700" onClick={() => handleLogStatus('OUT')} disabled={!selectedScooter || isSubmitting}>
                                            Confirm Log OUT
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <Button variant="ghost" className="w-full text-primary" asChild>
                                <Link href={`/history?device=${scannedData.macId}`}>View Battery History</Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">Capacity: {scannedData.capacity || 'N/A'}</p>
                            <div className="flex justify-center gap-4 pt-4">
                                <Button size="lg" onClick={() => handleLogStatus('IN')} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white">
                                    <ArrowRight className="mr-2 h-4 w-4" /> Link (IN)
                                </Button>
                            </div>
                        </div>
                    )}
                    
                    <Button variant="link" onClick={handleRescan}>Scan another</Button>
                </div>
                ) : (
                <div className="space-y-4">
                    <div className="rounded-lg overflow-hidden border aspect-square w-full" id="qr-reader" />
                    <Button variant="outline" className="w-full" onClick={() => setShowScanner(false)}>Back to Selection</Button>
                </div>
                )}
            </CardContent>
            </Card>
        )}
      </main>
    </div>
  )
}
