
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Timer, Power, Wifi } from 'lucide-react';
import type { ClaimedDevice } from '@/types/bms';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from './ui/skeleton';
import ClaimedDeviceEditor from './claimed-device-editor';
import { ScrollArea } from './ui/scroll-area';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanInterval: number;
  setScanInterval: (value: number) => void;
  autoConnectInterval: number;
  setAutoConnectInterval: (value: number) => void;
  claimedDevices: ClaimedDevice[];
  devicesLoading: boolean;
  hasFullControl?: boolean;
  onDeviceUpdate: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  scanInterval,
  setScanInterval,
  autoConnectInterval,
  setAutoConnectInterval,
  claimedDevices,
  devicesLoading,
  hasFullControl,
  onDeviceUpdate,
}: SettingsModalProps) {
  const scanIntervalOptions = [10, 15, 30, 60];
  const autoConnectIntervalOptions = [5, 10, 12];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage application and device settings.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="pr-6">
          <div className="py-4 space-y-6">
            {hasFullControl && (
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-foreground">Automation Settings</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                  <Label
                    htmlFor="scan-interval"
                    className="sm:text-right sm:col-span-1 flex items-center"
                  >
                    <Timer className="mr-2 h-4 w-4" />
                    Auto Scan
                  </Label>
                  <div className="sm:col-span-3 flex items-center gap-2">
                    <Select
                      value={String(scanInterval)}
                      onValueChange={(value) => setScanInterval(Number(value))}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {scanIntervalOptions.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                  <Label
                    htmlFor="auto-connect-interval"
                    className="sm:text-right sm-col-span-1 flex items-center"
                  >
                    <Power className="mr-2 h-4 w-4" />
                    Auto Connect
                  </Label>
                  <div className="sm:col-span-3 flex items-center gap-2">
                     <Select
                      value={String(autoConnectInterval)}
                      onValueChange={(value) => setAutoConnectInterval(Number(value))}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {autoConnectIntervalOptions.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">seconds</span>
                  </div>
                </div>
              </div>
            )}

            {hasFullControl && (
              <div className="space-y-4">
                <Separator />
                <h4 className="text-md font-semibold text-foreground flex items-center">
                  <Wifi className="mr-2 h-5 w-5" />
                  My Registered Gateways
                </h4>
                {devicesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : claimedDevices.length > 0 ? (
                  <div className="space-y-4">
                    {claimedDevices.map((device) => (
                      <ClaimedDeviceEditor key={device.id} device={device} onUpdateSuccess={onDeviceUpdate} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No gateways have been registered yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
