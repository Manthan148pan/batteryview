
'use client';

import { useState } from 'react';
import type { ClaimedDevice } from '@/types/bms';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ref, update } from '@/lib/firebase';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';

interface ClaimedDeviceEditorProps {
  device: ClaimedDevice;
  onUpdateSuccess: () => void;
}

export default function ClaimedDeviceEditor({ device, onUpdateSuccess }: ClaimedDeviceEditorProps) {
  const [name, setName] = useState(device.assigned_name);
  const [location, setLocation] = useState(device.location);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSave = async () => {
    if (!name) {
      toast({
        variant: 'destructive',
        title: 'Name Required',
        description: 'Device name cannot be empty.',
      });
      return;
    }
    if (!user) {
        toast({
            variant: 'destructive',
            title: 'Authentication Error',
            description: 'You must be logged in to save changes.',
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

    setIsSaving(true);
    try {
      const updates: { [key: string]: any } = {};
      const deviceData = {
        assigned_name: name,
        location: location || 'Not set',
      };

      // Path for user-specific data
      updates[`/users/${user.uid}/linked_devices/${device.id}/assigned_name`] = deviceData.assigned_name;
      updates[`/users/${user.uid}/linked_devices/${device.id}/location`] = deviceData.location;
      
      // Path for the top-level, separate node
      updates[`/linked_devices/${device.id}/assigned_name`] = deviceData.assigned_name;
      updates[`/linked_devices/${device.id}/location`] = deviceData.location;

      await update(ref(db), updates);

      toast({
        title: 'Device Updated',
        description: `The details for ${device.id} have been saved.`,
      });
      onUpdateSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message || 'Could not update the device details.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanged = name !== device.assigned_name || location !== device.location;

  return (
    <div className="p-3 border rounded-lg bg-muted/20">
      <div className="flex flex-col gap-3">
        <div>
          <Label htmlFor={`device-name-${device.id}`} className="text-xs font-mono text-muted-foreground">
            {device.id}
          </Label>
          <div className="flex items-center gap-2 mt-1">
             <Input
              id={`device-name-${device.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Garage Gateway"
              disabled={isSaving}
            />
          </div>
        </div>
         <div>
          <Label htmlFor={`device-location-${device.id}`} className="text-xs font-normal text-muted-foreground">
            Location
          </Label>
          <div className="flex items-center gap-2 mt-1">
             <Input
              id={`device-location-${device.id}`}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Workshop"
              disabled={isSaving}
            />
          </div>
        </div>
        <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanged} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            Save Changes
        </Button>
      </div>
    </div>
  );
}
