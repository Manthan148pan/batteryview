'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, User as UserIcon, Wifi, Save, ListTree, Trash2, Edit, Search, QrCode, Loader2, CreditCard } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { db, ref, get, remove, update, set, query, orderByKey, limitToLast } from '@/lib/firebase';
import type { ClaimedDevice } from '@/types/bms';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { decodeBMSHex } from '@/lib/bms-decoder';
import QRCode from 'qrcode';

interface RegisteredBmsDevice {
  id: string;
  deviceNickname: string;
  status?: 'active' | 'archived';
  capacity?: number;
}

interface EditableClaimedDevice extends ClaimedDevice {
  isEditing?: boolean;
  newName: string;
  newLocation: string;
}

export default function UserInfoPage() {
  const { user, userProfile, loading, isAdmin, updateUserProfile } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [claimedDevices, setClaimedDevices] = useState<EditableClaimedDevice[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [registeredBmsDevices, setRegisteredBmsDevices] = useState<RegisteredBmsDevice[]>([]);
  const [bmsDevicesLoading, setBmsDevicesLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'gateway' | 'bms', id: string, name: string } | null>(null);
  const [bmsSearchQuery, setBmsSearchQuery] = useState('');

  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrDevice, setQrDevice] = useState<RegisteredBmsDevice | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);

  const userPathUid = userProfile?.role === 'sub_user' ? userProfile.main_user_uid : user?.uid;

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName || '');
      setCompanyName(userProfile.companyName || '');
      setMobileNumber(userProfile.mobileNumber || '');
      setDesignation(userProfile.designation || '');
    }
  }, [userProfile]);

  const fetchClaimedDevices = async () => {
    if (!userPathUid || !db) {
      setDeviceLoading(false);
      return;
    }
    setDeviceLoading(true);
    try {
      const userDevicesRef = ref(db, `users/${userPathUid}/linked_devices`);
      const snapshot = await get(userDevicesRef);
      if (snapshot.exists()) {
        const devicesData = snapshot.val();
        const devices: EditableClaimedDevice[] = Object.keys(devicesData).map(deviceId => ({
          id: deviceId,
          assigned_name: devicesData[deviceId].assigned_name || 'N/A',
          location: devicesData[deviceId].location || 'N/A',
          isEditing: false,
          newName: devicesData[deviceId].assigned_name || 'N/A',
          newLocation: devicesData[deviceId].location || 'N/A'
        }));
        setClaimedDevices(devices);
      } else {
        setClaimedDevices([]);
      }
    } catch (error) {
      console.error("Failed to fetch gateways:", error);
    } finally {
      setDeviceLoading(false);
    }
  };

  const fetchRegisteredBms = async () => {
    if (!userPathUid || !db) {
      setBmsDevicesLoading(false);
      return;
    }
    setBmsDevicesLoading(true);
    try {
      const bmsDevicesRef = ref(db, `users/${userPathUid}/bms_devices`);
      const snapshot = await get(bmsDevicesRef);
      if (snapshot.exists()) {
        const devicesData = snapshot.val();
        const devices: RegisteredBmsDevice[] = Object.keys(devicesData)
          .map(macId => ({
            id: macId,
            ...devicesData[macId],
            deviceNickname: devicesData[macId].deviceNickname || `BMS (${macId.slice(-5)})`,
          }))
          .filter(device => device.status !== 'archived');
        setRegisteredBmsDevices(devices);
      } else {
        setRegisteredBmsDevices([]);
      }
    } catch (error) {
      console.error("Failed to fetch BMS devices:", error);
    } finally {
      setBmsDevicesLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && userPathUid) {
      fetchClaimedDevices();
      fetchRegisteredBms();
    }
  }, [user, loading, isAdmin, userPathUid]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isAdmin) return;
    setIsSaving(true);
    try {
      await updateUserProfile({ fullName, companyName, mobileNumber, designation });
      toast({ title: 'Profile Updated', description: 'Your information has been successfully saved.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message || 'Could not save profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEditGateway = (id: string) => {
    setClaimedDevices(claimedDevices.map(d => d.id === id ? { ...d, isEditing: !d.isEditing } : { ...d, isEditing: false }));
  };

  const handleGatewayInputChange = (id: string, field: 'newName' | 'newLocation', value: string) => {
    setClaimedDevices(claimedDevices.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleSaveGateway = async (id: string) => {
    if (!userPathUid || !db) return;
    const device = claimedDevices.find(d => d.id === id);
    if (!device) return;
    setIsSaving(true);
    const updates: { [key: string]: any } = {};
    updates[`/users/${userPathUid}/linked_devices/${id}/assigned_name`] = device.newName;
    updates[`/users/${userPathUid}/linked_devices/${id}/location`] = device.newLocation;
    updates[`/linked_devices/${id}/assigned_name`] = device.newName;
    updates[`/linked_devices/${id}/location`] = device.newLocation;
    try {
      await update(ref(db), updates);
      toast({ title: 'Gateway Updated', description: 'Gateway details saved.' });
      fetchClaimedDevices();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not save.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete || !userPathUid || !db) return;
    setIsSaving(true);
    const { type, id, name } = itemToDelete;
    try {
      if (type === 'gateway') {
        await remove(ref(db, `users/${userPathUid}/linked_devices/${id}`));
        await remove(ref(db, `linked_devices/${id}`));
        toast({ title: 'Gateway Removed', description: `${name} removed.` });
        fetchClaimedDevices();
      } else if (type === 'bms') {
        await set(ref(db, `users/${userPathUid}/bms_devices/${id}/status`), 'archived');
        toast({ title: 'BMS Device Archived', description: `${name} archived.` });
        fetchRegisteredBms();
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not process.' });
    } finally {
      setIsSaving(false);
      setItemToDelete(null);
    }
  };

  const handleGenerateQrCode = async (device: RegisteredBmsDevice) => {
    if (!userPathUid || !db) return;
    setIsGeneratingQr(true);
    setQrDevice(device);
    setIsQrModalOpen(true);
    let capacity = device.capacity;
    if (capacity === undefined) {
      try {
        const historyRef = ref(db, `users/${userPathUid}/bms_devices/${device.id}/history`);
        const q = query(historyRef, orderByKey(), limitToLast(1));
        const dateSnapshot = await get(q);
        if (dateSnapshot.exists()) {
          const dateKey = Object.keys(dateSnapshot.val())[0];
          const timeRef = ref(db, `users/${userPathUid}/bms_devices/${device.id}/history/${dateKey}`);
          const timeQuery = query(timeRef, orderByKey(), limitToLast(1));
          const timeSnapshot = await get(timeQuery);
          if (timeSnapshot.exists()) {
            const timeKey = Object.keys(timeSnapshot.val())[0];
            const hexData = timeSnapshot.val()[timeKey].hex_data;
            const decoded = decodeBMSHex(hexData);
            capacity = decoded?.capacity;
          }
        }
      } catch (error) {
        console.error("QR Capacity fetch error:", error);
      }
    }
    const qrData = JSON.stringify({ macId: device.id, nickname: device.deviceNickname, capacity: capacity ? `${(capacity / 1000).toFixed(1)} Ah` : 'N/A' });
    try {
      const url = await QRCode.toDataURL(qrData, { errorCorrectionLevel: 'H', type: 'image/png', margin: 1, width: 256 });
      setQrCodeUrl(url);
    } catch (err) {
      console.error("QR Generation error:", err);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const filteredBmsDevices = registeredBmsDevices.filter(device => {
    const searchTerm = bmsSearchQuery.toLowerCase();
    if (!searchTerm) return true;
    return device.id.toLowerCase().includes(searchTerm) || device.deviceNickname.toLowerCase().includes(searchTerm);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">User Information</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="lg:col-span-1 space-y-6">
              <Card>
                <form onSubmit={handleProfileSave}>
                  <CardHeader>
                    <CardTitle className="flex items-center"><UserIcon className="mr-2 h-6 w-6 text-primary" /> User Profile</CardTitle>
                    <CardDescription>Your account details.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loading ? <Skeleton className="h-40 w-full" /> : user ? (
                      <>
                        <div className="space-y-2"><Label>Custom ID</Label><Input value={userProfile?.custom_id || 'N/A'} disabled /></div>
                        <div className="space-y-2"><Label>Full Name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} disabled={isSaving || isAdmin} /></div>
                        <div className="space-y-2"><Label>Email</Label><Input value={user.email || ''} disabled /></div>
                        <div className="space-y-2"><Label>Company</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={isSaving || isAdmin} /></div>
                      </>
                    ) : <p>No data</p>}
                  </CardContent>
                  {!isAdmin && user && (
                    <CardFooter>
                      <Button type="submit" disabled={isSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </CardFooter>
                  )}
                </form>
              </Card>

              {userProfile?.role === 'main_user' && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center"><CreditCard className="mr-2 h-6 w-6 text-primary" /> Subscription</CardTitle>
                    <CardDescription>Your current billing status.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Status</span>
                      <span className="text-sm font-bold uppercase text-green-600">{userProfile?.subscription?.status || 'Trialing'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Active Batteries</span>
                      <span className="text-sm font-bold">{registeredBmsDevices.length}</span>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild><Link href="/billing">Manage Billing</Link></Button>
                  </CardFooter>
                </Card>
              )}
            </div>

            {(userProfile?.role === 'main_user' || userProfile?.role === 'sub_user') && (
              <div className="lg:col-span-2">
                <AlertDialog onOpenChange={() => setItemToDelete(null)}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center"><Wifi className="mr-2 h-6 w-6 text-primary" />Gateways</CardTitle>
                        <CardDescription>Linked gateway devices.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {deviceLoading ? <Skeleton className="h-20 w-full" /> : claimedDevices.length > 0 ? (
                          <div className="divide-y divide-border -mx-6">
                            {claimedDevices.map(device => (
                              <div key={device.id} className="px-6 py-4 space-y-3">
                                {device.isEditing ? (
                                  <div className='space-y-3'>
                                    <Input value={device.newName} onChange={(e) => handleGatewayInputChange(device.id, 'newName', e.target.value)} placeholder="Name" />
                                    <Input value={device.newLocation} onChange={(e) => handleGatewayInputChange(device.id, 'newLocation', e.target.value)} placeholder="Location" />
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => handleSaveGateway(device.id)} disabled={isSaving}>Save</Button>
                                      <Button size="sm" variant="outline" onClick={() => toggleEditGateway(device.id)}>Cancel</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-start">
                                    <div><p className="font-semibold">{device.assigned_name}</p><p className="text-xs text-muted-foreground">{device.location}</p></div>
                                    <div className="flex">
                                      <Button variant="ghost" size="icon" onClick={() => toggleEditGateway(device.id)}><Edit className="h-4 w-4" /></Button>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={() => setItemToDelete({ type: 'gateway', id: device.id, name: device.assigned_name })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                      </AlertDialogTrigger>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-sm text-center py-4">No gateways</p>}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center"><ListTree className="mr-2 h-6 w-6 text-primary" />BMS Devices</CardTitle>
                        <CardDescription>Manually registered batteries.</CardDescription>
                        <div className="relative pt-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Search..." value={bmsSearchQuery} onChange={(e) => setBmsSearchQuery(e.target.value)} className="pl-10" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        {bmsDevicesLoading ? <Skeleton className="h-20 w-full" /> : filteredBmsDevices.length > 0 ? (
                          <div className="divide-y divide-border -mx-6">
                            {filteredBmsDevices.map(device => (
                              <div key={device.id} className="px-6 py-3 flex justify-between items-center">
                                <div><p className="font-semibold text-sm">{device.deviceNickname}</p><p className="font-mono text-[10px] text-muted-foreground">{device.id}</p></div>
                                <div className="flex items-center">
                                  <Button variant="ghost" size="icon" onClick={() => handleGenerateQrCode(device)}><QrCode className="h-4 w-4" /></Button>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => setItemToDelete({ type: 'bms', id: device.id, name: device.deviceNickname })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                  </AlertDialogTrigger>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-sm text-center py-4">No devices</p>}
                      </CardContent>
                    </Card>
                  </div>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>{itemToDelete?.type === 'bms' ? 'Archive device?' : `Permanently remove gateway ${itemToDelete?.name}?`}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isSaving}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR for {qrDevice?.deviceNickname}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            {isGeneratingQr ? (
              <Loader2 className="animate-spin" />
            ) : qrCodeUrl && (
              <img src={qrCodeUrl} alt="QR Code" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
