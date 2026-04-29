'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db, ref, push, serverTimestamp, update, get } from '@/lib/firebase';
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

  const { user, userProfile, updateUserProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const hasActiveSetup = !!(userProfile?.active_device && userProfile?.active_gateway && userProfile?.main_user_uid);

  useEffect(() => {
    const fetchCompanies = async () => {
      if (!db || hasActiveSetup) return;
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
  }, [hasActiveSetup]);

  useEffect(() => {
    const fetchScooters = async () => {
      if (!db || !selectedCompany) {
        setScooters([]);
        return;
      }
      const linkedRef = ref(db, `users/${selectedCompany}/linked_devices`);
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
  }, [selectedCompany]);

  useEffect(() => {
    const startScanner = async () => {
      if (!showScanner || hasActiveSetup || scannedData) return;
      try {
        await Html5Qrcode.getCameras();
        setHasPermission(true);
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        const qrCodeSuccessCallback = (decodedText: string) => {
          try {
            const data = JSON.parse(decodedText);
            if (data.macId && data.nickname) {
              setScannedData(data);
              scanner.stop();
            }
          } catch (error) {
            toast({ variant: 'destructive', title: 'Invalid QR Code', description: 'This QR code does not contain valid battery data.' });
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
    if (!selectedCompany || !selectedScooter) {
        toast({ variant: 'destructive', title: 'Selection Required', description: 'Please select a company and scooter before scanning.' });
        return;
    }
    setShowScanner(true);
  };

  const handleLogStatus = async (status: 'IN' | 'OUT') => {
    if (!user || !db) return;
    setIsSubmitting(true);

    try {
      const isUnlink = status === 'OUT';
      
      const targetCompanyId = isUnlink ? userProfile?.main_user_uid : selectedCompany;
      const targetBatteryId = isUnlink ? userProfile?.active_device : scannedData?.macId;
      const targetBatteryNickname = isUnlink ? 'Active Battery' : scannedData?.nickname;
      const targetGatewayId = isUnlink ? userProfile?.active_gateway : selectedScooter;

      if (!targetCompanyId || !targetBatteryId || !targetGatewayId) {
          throw new Error('Missing required data to log status.');
      }

      // 1. Log the status to history
      const historyRef = ref(db, `users/${targetCompanyId}/bms_scan_history/${targetBatteryId}`);
      await push(historyRef, {
        status: status,
        timestamp: serverTimestamp(),
        scannedBy: user.email || user.phoneNumber || 'Rider',
        nickname: targetBatteryNickname,
        gatewayId: targetGatewayId
      });

      // 2. Link or Unlink the device to Rider's profile
      if (userProfile?.role === 'sub_user') {
        const userRef = ref(db, `users/${user.uid}`);
        
        if (isUnlink) {
           await update(userRef, {
             active_device: null,
             active_gateway: null,
             main_user_uid: null 
           });
           
           if (updateUserProfile) {
               await updateUserProfile({ active_device: undefined, active_gateway: undefined, main_user_uid: undefined });
           }

           toast({
             title: 'Battery Unlinked',
             description: 'You have successfully unlinked your active battery and scooter.',
           });
           setScannedData(null);
           setShowScanner(false);
           setSelectedCompany('');
           setSelectedScooter('');
        } else {
           await update(userRef, {
             active_device: targetBatteryId,
             active_gateway: targetGatewayId,
             main_user_uid: targetCompanyId,
             last_connect_time: Date.now()
           });
           
           if (updateUserProfile) {
               await updateUserProfile({ 
                   active_device: targetBatteryId, 
                   active_gateway: targetGatewayId, 
                   main_user_uid: targetCompanyId 
               });
           }
           
           toast({
             title: 'Battery Linked & Logged IN',
             description: `${targetBatteryNickname} is now your active battery.`,
           });
           
           router.push('/');
        }
      } else {
        toast({
          title: `Battery Logged ${status}`,
          description: `${targetBatteryNickname} has been successfully logged.`,
        });
        setScannedData(null);
      }

    } catch (error) {
      console.error("Scan submission failed:", error);
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not complete the request. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescan = () => {
    setScannedData(null);
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
              {hasActiveSetup ? 'Active Connection' : 'Rider Setup & Scan'}
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
                <CardTitle className="text-2xl">Connect Battery</CardTitle>
                <CardDescription>
                {scannedData ? 'Scan complete. Link this battery.' : (showScanner ? 'Point your camera at a battery QR code.' : 'Select your company and scooter to begin.')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!showScanner && !scannedData ? (
                    <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-sm font-medium">Company</label>
                           <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                               <SelectTrigger>
                                   <SelectValue placeholder="Select a Company..." />
                               </SelectTrigger>
                               <SelectContent>
                                   {companies.map(company => (
                                       <SelectItem key={company.uid} value={company.uid}>{company.name}</SelectItem>
                                   ))}
                               </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-sm font-medium">Scooter</label>
                           <Select value={selectedScooter} onValueChange={setSelectedScooter} disabled={!selectedCompany}>
                               <SelectTrigger>
                                   <SelectValue placeholder={selectedCompany ? "Select a Scooter..." : "Select a Company first"} />
                               </SelectTrigger>
                               <SelectContent>
                                   {scooters.length === 0 ? (
                                        <SelectItem value="none" disabled>No scooters found</SelectItem>
                                   ) : scooters.map(scooter => (
                                       <SelectItem key={scooter.id} value={scooter.id}>
                                            {scooter.name} {scooter.scooterNo ? `[${scooter.scooterNo}]` : ''}
                                       </SelectItem>
                                   ))}
                               </SelectContent>
                           </Select>
                        </div>
                        <Button 
                           onClick={handleStartScan} 
                           disabled={!selectedCompany || !selectedScooter}
                           className="w-full gradient-bg text-primary-foreground"
                           size="lg"
                        >
                            <QrCode className="mr-2 h-4 w-4"/> Start Scanner
                        </Button>
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
                    <p className="text-sm text-muted-foreground">Capacity: {scannedData.capacity || 'N/A'}</p>
                    <div className="flex justify-center gap-4 pt-4">
                    <Button size="lg" onClick={() => handleLogStatus('IN')} disabled={isSubmitting} className="w-full bg-green-600 hover:bg-green-700 text-white">
                        <ArrowRight className="mr-2 h-4 w-4" /> Link (IN)
                    </Button>
                    </div>
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
