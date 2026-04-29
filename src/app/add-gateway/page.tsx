'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { db, ref, update } from '@/lib/firebase';

export default function AddGatewayPage() {
  const [deviceId, setDeviceId] = useState('');
  const [assignedName, setAssignedName] = useState('');
  const [location, setLocation] = useState('');
  const [scooterNo, setScooterNo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const handleRegisterGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId || !assignedName) {
      toast({
        variant: 'destructive',
        title: 'Required Fields Missing',
        description: 'Please enter the Device ID and an assigned name.',
      });
      return;
    }
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Not Authenticated',
        description: 'You must be logged in to register a gateway.',
      });
      return;
    }

    if (!db) {
        toast({
            variant: 'destructive',
            title: 'Database Error',
            description: 'Database connection not available.',
        });
        return;
    }

    setIsLoading(true);

    try {
      const now = new Date().toISOString();
      const deviceData = {
        added_at: now,
        added_by: user.email,
        assigned_name: assignedName,
        location: location || 'Not set',
        scooter_no: scooterNo || '',
        owner_uid: user.uid
      };

      const updates: { [key: string]: any } = {};
      updates[`/users/${user.uid}/linked_devices/${deviceId}`] = deviceData;
      updates[`/linked_devices/${deviceId}`] = deviceData;

      await update(ref(db), updates);

      toast({
        title: 'Gateway Registered!',
        description: `Gateway ${deviceId} has been successfully linked to your account.`,
      });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: error.message || 'An error occurred. The device may already be claimed. Please check permissions or try again.',
      });
    } finally {
      setIsLoading(false);
    }
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
              Register Gateway
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 items-center justify-center py-12 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Wifi className="w-12 h-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Register Your Gateway</CardTitle>
            <CardDescription>
              Enter the unique Device ID from your gateway to link it to your account.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegisterGateway}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deviceId">Unique Device ID</Label>
                <Input
                  id="deviceId"
                  type="text"
                  placeholder="e.g., 24A1B3C4D5E6"
                  required
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value.trim())}
                  disabled={isLoading}
                  className="text-center font-mono tracking-widest"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedName">Assign Name</Label>
                <Input
                  id="assignedName"
                  type="text"
                  placeholder="e.g., Garage Gateway"
                  required
                  value={assignedName}
                  onChange={(e) => setAssignedName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Device Location (Optional)</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="e.g., Main Workshop"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scooterNo">Scooter Number / Asset ID (Optional)</Label>
                <Input
                  id="scooterNo"
                  type="text"
                  placeholder="e.g., S-101 or MH-01-1234"
                  value={scooterNo}
                  onChange={(e) => setScooterNo(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full gradient-bg text-primary-foreground" disabled={isLoading}>
                {isLoading ? 'Verifying & Registering...' : 'Register Gateway'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
