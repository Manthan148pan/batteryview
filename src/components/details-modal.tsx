
'use client';

import { useState, useEffect } from 'react';
import type { BMSDevice } from '@/types/bms';
import { db, ref, remove, update } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import CellVoltageChart from './cell-voltage-chart';
import TemperatureChart from './temperature-chart';
import { Battery, Thermometer, Info, Save, History, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface DetailsModalProps {
  device: BMSDevice | null;
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
}

const SummaryItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default function DetailsModal({ device, isOpen, onClose, userId }: DetailsModalProps) {
  const [nickname, setNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (device) {
      setNickname(device.deviceNickname || '');
    }
  }, [device]);

  if (!device || !device.decodedData) return null;

  const { decodedData, id } = device;

  const handleSaveNickname = async () => {
    if (!id || !userId || !db) {
        toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: 'Cannot save nickname without a user context or db connection.',
        });
        return;
    }
    
    setIsSaving(true);
    try {
        const updates: { [key: string]: any } = {};
        updates[`/users/${userId}/bms_devices/${id}/deviceNickname`] = nickname;

        await update(ref(db), updates);

        toast({
            title: 'Nickname Saved',
            description: `The nickname for the device has been updated. It will appear on the dashboard shortly.`,
        });
        onClose();
    } catch (error) {
      console.error('Failed to save nickname:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'Could not save the nickname.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (!id || !userId || !db) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: 'Cannot delete device without user context.' });
        return;
    }
    setIsDeleting(true);
    try {
        const deviceRef = ref(db, `users/${userId}/bms_devices/${id}`);
        await remove(deviceRef);
        toast({ title: 'Device Removed', description: `${nickname || id} has been unregistered from your account.` });
        onClose();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: error.message || 'Could not unregister the device.' });
    } finally {
        setIsDeleting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{device.deviceNickname || device.device_name || device.id}</DialogTitle>
          <DialogDescription>Detailed Battery Management System Information</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[65vh] pr-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nickname">Device Nickname</Label>
              <div className="flex items-center gap-2">
                <Input 
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g., Main Power Bank"
                />
                <Button onClick={handleSaveNickname} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" asChild>
                    <Link href={`/history?deviceId=${id}`}>
                        <History className="mr-2 h-4 w-4" />
                        History
                    </Link>
                </Button>
              </div>
            </div>

            <Separator />
            
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-4"><Battery className="mr-2 h-5 w-5 text-primary" />Cell Voltages</h3>
              <CellVoltageChart data={decodedData.cellVoltages} />
            </div>

            <Separator />
            
            <div>
              <h3 className="text-lg font-semibold flex items-center mb-4"><Thermometer className="mr-2 h-5 w-5 text-primary" />Temperatures</h3>
              <TemperatureChart temps={decodedData.temps} mosT1={decodedData.mosT1} mosT2={decodedData.mosT2} />
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold flex items-center mb-4"><Info className="mr-2 h-5 w-5 text-primary" />Battery Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 p-4 bg-muted/50 rounded-lg">
                <SummaryItem label="Nominal Capacity" value={`${(decodedData.capacity / 1000).toFixed(1)} Ah`} />
                <SummaryItem label="Remaining Capacity" value={`${decodedData.remCap} Ah`} />
                <SummaryItem label="Total Voltage" value={`${decodedData.totalVoltage} V`} />
                <SummaryItem label="Average Voltage" value={`${decodedData.avgVolt} V`} />
                <SummaryItem label="Current" value={`${decodedData.current} A`} />
                <SummaryItem label="Power" value={`${decodedData.power} kW`} />
                <SummaryItem label="State of Charge (SOC)" value={`${decodedData.soc}%`} />
                <SummaryItem label="Cycles" value={decodedData.cycles} />
                <SummaryItem label="Max Cell Voltage" value={`${decodedData.maxCell} V`} />
                <SummaryItem label="Min Cell Voltage" value={`${decodedData.minCell} V`} />
                <SummaryItem label="Avg Cell Voltage" value={`${decodedData.avgCellVolt} V`} />
                <SummaryItem label="Cell Count" value={decodedData.cellCount} />
                <SummaryItem label="Temp Sensors" value={decodedData.tempCount} />
                <SummaryItem label="MOS Temp 1 / 2" value={`${decodedData.mosT1}°C / ${decodedData.mosT2}°C`} />
                <SummaryItem label="Balancing" value={decodedData.balance ? 'ON' : 'OFF'} />
                <SummaryItem label="Charge MOS" value={decodedData.chgMos ? 'ON' : 'OFF'} />
                <SummaryItem label="Discharge MOS" value={decodedData.dischgMos ? 'ON' : 'OFF'} />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeleting ? 'Archiving...' : 'Archive Device'}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will archive the device, hiding it from the main dashboard. You can manage archived devices from the User Info page. This action can be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteDevice} className="bg-destructive hover:bg-destructive/80">
                        Confirm Archive
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
