'use client';

import { useState, useEffect } from 'react';
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
import { ArrowLeft, Wifi, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { db, ref, update, get } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BMSEntry {
  id: number;
  value: string;
  nickname: string;
}

export default function RegisterBMSPage() {
  const [entries, setEntries] = useState<BMSEntry[]>([{ id: Date.now(), value: '', nickname: '' }]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [existingMacIds, setExistingMacIds] = useState<string[]>([]);

  useEffect(() => {
    const fetchExistingDevices = async () => {
      if (!user || !db) return;
      try {
        const bmsDevicesRef = ref(db, `users/${user.uid}/bms_devices`);
        const snapshot = await get(bmsDevicesRef);
        if (snapshot.exists()) {
          setExistingMacIds(Object.keys(snapshot.val()));
        }
      } catch (error) {
        console.error("Could not fetch existing BMS devices:", error);
      }
    };

    if (user) {
      fetchExistingDevices();
    }
  }, [user]);

  const handleInputChange = (id: number, inputValue: string, field: 'mac' | 'nickname') => {
    const newEntries = entries.map(entry => {
        if (entry.id === id) {
            if (field === 'mac') {
                // Normalize MAC address: remove non-hex characters, convert to uppercase, use hyphens
                const cleaned = inputValue.replace(/[^0-9A-Fa-f]/g, '').toLowerCase();
                let formatted = '';
                for (let i = 0; i < cleaned.length; i += 2) {
                    if (i > 0) {
                        formatted += '-';
                    }
                    formatted += cleaned.substring(i, i + 2);
                }
                return { ...entry, value: formatted.substring(0, 17) };
            } else {
                return { ...entry, nickname: inputValue };
            }
        }
        return entry;
    });
    setEntries(newEntries);
  };


  const addEntry = () => {
    setEntries([...entries, { id: Date.now(), value: '', nickname: '' }]);
  };

  const removeEntry = (id: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter(entry => entry.id !== id));
    } else {
      setEntries([{ id: Date.now(), value: '', nickname: '' }]);
    }
  };

  const handleRegisterDevices = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be logged in to register devices.' });
      return;
    }

    if (!db) {
      toast({ variant: 'destructive', title: 'Database Error', description: 'Database connection is not available.' });
      return;
    }
    
    const validEntries = entries.filter(entry => entry.value && entry.value.length === 17);

    if (validEntries.length === 0) {
      toast({ variant: 'destructive', title: 'Valid MAC ID Required', description: 'Please enter at least one complete BMS MAC ID.' });
      return;
    }

    setIsLoading(true);

    const newEntries = validEntries.filter(entry => !existingMacIds.includes(entry.value));
    const duplicateEntries = validEntries.filter(entry => existingMacIds.includes(entry.value));

    if (duplicateEntries.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Duplicate Devices Found',
        description: `The following MAC IDs are already registered: ${duplicateEntries.map(d => d.value).join(', ')}`,
      });
    }

    if (newEntries.length === 0) {
        setIsLoading(false);
        return;
    }

    const updates: { [key: string]: any } = {};
    newEntries.forEach(entry => {
        const macId = entry.value;
        const devicePath = `/users/${user.uid}/bms_devices/${macId}`;
        updates[devicePath] = {
            deviceNickname: entry.nickname || `BMS-${macId.substring(macId.length - 5)}`,
            status: 'active' // Set status to active on registration
        };
    });


    try {
        await update(ref(db), updates);
        toast({
          title: 'Registration Complete!',
          description: `${newEntries.length} new BMS device(s) have been registered.`,
        });
        
        if (duplicateEntries.length === 0) {
            router.push('/');
        } else {
            // Update existing devices list and clear successful entries
            setExistingMacIds(prev => [...prev, ...newEntries.map(e => e.value)]);
            setEntries(entries.filter(e => !newEntries.some(ne => ne.id === e.id)));
        }

    } catch (error: any) {
         toast({
          variant: 'destructive',
          title: 'Registration Failed',
          description: error.message || 'An unknown error occurred during registration.',
        });
    }
    
    setIsLoading(false);
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
              Register BMS
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 items-center justify-center py-12 px-4">
        <Card className="w-full max-w-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Wifi className="w-12 h-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">Register BMS by MAC</CardTitle>
            <CardDescription>
              Manually register one or more BMS devices by providing their MAC IDs and an optional nickname.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegisterDevices}>
            <CardContent>
              <ScrollArea className="h-[250px] w-full pr-4">
                <div className="space-y-4">
                  {entries.map((entry, index) => (
                    <div key={entry.id} className="p-4 border rounded-lg relative bg-muted/50">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                              <Label htmlFor={`macId-${index}`}>BMS MAC ID #{index + 1}</Label>
                              <Input
                                  id={`macId-${index}`}
                                  type="text"
                                  placeholder="D0-18-10-01-32-29"
                                  required
                                  value={entry.value}
                                  onChange={(e) => handleInputChange(entry.id, e.target.value, 'mac')}
                                  disabled={isLoading}
                                  className="font-mono mt-1"
                                  maxLength={17}
                              />
                          </div>
                           <div>
                              <Label htmlFor={`nickname-${index}`}>Nickname (Optional)</Label>
                              <Input
                                  id={`nickname-${index}`}
                                  type="text"
                                  placeholder="e.g., Power Bank 1"
                                  value={entry.nickname}
                                  onChange={(e) => handleInputChange(entry.id, e.target.value, 'nickname')}
                                  disabled={isLoading}
                                  className="mt-1"
                              />
                          </div>
                      </div>
                       <Button 
                          type="button" 
                          size="icon" 
                          variant="ghost" 
                          className="absolute top-1 right-1 h-8 w-8 text-destructive" 
                          onClick={() => removeEntry(entry.id)} 
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
               <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full mt-4" 
                  onClick={addEntry} 
                  disabled={isLoading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add another BMS
              </Button>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full gradient-bg text-primary-foreground" disabled={isLoading}>
                {isLoading ? 'Registering...' : `Register ${entries.filter(e=>e.value).length} BMS Device(s)`}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  );
}
