
'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db, ref, push, serverTimestamp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, CameraOff, CheckCircle, QrCode } from 'lucide-react';
import Link from 'next/link';

interface ScannedData {
  macId: string;
  nickname: string;
  capacity: string;
}

export default function ScanPage() {
  const [scannedData, setScannedData] = useState<ScannedData | null>(null);
  const [hasPermission, setHasPermission] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  const userPathUid = userProfile?.role === 'sub_user' ? userProfile.main_user_uid : user?.uid;

  useEffect(() => {
    const startScanner = async () => {
      if (!readerRef.current || (scannerRef.current && scannerRef.current.isScanning)) {
        return;
      }

      try {
        await Html5Qrcode.getCameras();
        setHasPermission(true);
        const scanner = new Html5Qrcode(readerRef.current.id);
        scannerRef.current = scanner;

        const qrCodeSuccessCallback = (decodedText: string) => {
          try {
            const data = JSON.parse(decodedText);
            if (data.macId && data.nickname) {
              setScannedData(data);
              if (scannerRef.current?.isScanning) {
                scannerRef.current.stop();
              }
            } else {
              toast({ variant: 'destructive', title: 'Invalid QR Code', description: 'This QR code does not contain valid battery data.' });
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

    if (!scannedData) {
      startScanner();
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Failed to stop scanner:", err));
      }
    };
  }, [toast, scannedData]);

  const handleLogStatus = async (status: 'IN' | 'OUT') => {
    if (!user || !userPathUid || !scannedData) return;
    setIsSubmitting(true);

    try {
      const historyRef = ref(db, `users/${userPathUid}/bms_scan_history/${scannedData.macId}`);
      await push(historyRef, {
        status: status,
        timestamp: serverTimestamp(),
        scannedBy: user.email,
        nickname: scannedData.nickname,
      });

      toast({
        title: `Battery Logged ${status}`,
        description: `${scannedData.nickname} has been successfully logged.`,
      });

      setScannedData(null); // Reset for next scan

    } catch (error) {
      toast({ variant: 'destructive', title: 'Log Failed', description: 'Could not save the scan history.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRescan = () => {
    setScannedData(null);
  }

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
              Scan Battery QR Code
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <QrCode className="w-12 h-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">QR Code Scanner</CardTitle>
            <CardDescription>
              {scannedData ? 'Scan complete. Log the battery status.' : 'Point your camera at a battery QR code.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasPermission ? (
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
                <p className="text-sm text-muted-foreground">Capacity: {scannedData.capacity}</p>
                <div className="flex justify-center gap-4 pt-4">
                  <Button size="lg" onClick={() => handleLogStatus('IN')} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
                    <ArrowRight className="mr-2 h-4 w-4" /> IN
                  </Button>
                  <Button size="lg" onClick={() => handleLogStatus('OUT')} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white">
                    <ArrowLeft className="mr-2 h-4 w-4" /> OUT
                  </Button>
                </div>
                <Button variant="link" onClick={handleRescan}>Scan another</Button>
              </div>
            ) : (
              <div ref={readerRef} className="rounded-lg overflow-hidden border aspect-square w-full" id="qr-reader" />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

