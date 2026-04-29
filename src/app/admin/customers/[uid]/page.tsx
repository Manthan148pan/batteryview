'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { db, ref, get, update } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
  ArrowLeft, 
  User, 
  Battery, 
  Server, 
  CreditCard, 
  Mail, 
  Building, 
  Phone, 
  Calendar,
  Download,
  AlertTriangle,
  Activity,
  History,
  Users as UsersIcon,
  ShieldCheck,
  IndianRupee,
  Edit2,
  Check,
  TicketPercent,
  UserCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { Invoice } from '@/types/bms';

export default function CustomerDetailPage() {
  const { uid } = useParams();
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subUsers, setSubUsers] = useState<any[]>([]);
  
  // Price edit state
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [newPrice, setNewPrice] = useState('50');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }

    const fetchCustomerData = async () => {
      if (!db || !uid) return;
      setLoading(true);
      try {
        const userRef = ref(db, `users/${uid}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          
          if (data.role === 'sub_user' && data.main_user_uid) {
            toast({ 
              title: 'Sub-User Account', 
              description: 'Redirecting to organization main account for comprehensive view.' 
            });
            router.push(`/admin/customers/${data.main_user_uid}`);
            return;
          }

          setCustomer(data);
          setNewPrice(data.subscription?.price_per_unit?.toString() || '50');
          
          // Fetch sub-users
          if (data.sub_users) {
            setSubUsers(Object.values(data.sub_users));
          }

          // Fetch invoices
          const invRef = ref(db, `users/${uid}/invoices`);
          const invSnapshot = await get(invRef);
          if (invSnapshot.exists()) {
            setInvoices(Object.values(invSnapshot.val()));
          } else {
            setInvoices([
              { id: 'INV-2024-001', date: '2024-05-01', amount: 177.0, status: 'paid', batteryCount: 3, billingPeriod: 'April 2024' },
              { id: 'INV-2024-002', date: '2024-06-01', amount: 236.0, status: 'paid', batteryCount: 4, billingPeriod: 'May 2024' }
            ]);
          }
        } else {
          toast({ variant: 'destructive', title: 'User Not Found', description: 'The requested customer profile does not exist.' });
          router.push('/admin/saas');
        }
      } catch (error) {
        console.error("Error fetching customer:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [uid, isAdmin, router, toast]);

  const handleUpdatePrice = async () => {
    if (!db || !uid) return;
    setIsUpdatingPrice(true);
    try {
      const priceNum = parseFloat(newPrice);
      if (isNaN(priceNum) || priceNum < 0) {
        throw new Error("Invalid price value");
      }

      await update(ref(db, `users/${uid}/subscription`), {
        price_per_unit: priceNum
      });

      setCustomer((prev: any) => ({
        ...prev,
        subscription: {
          ...prev.subscription,
          price_per_unit: priceNum
        }
      }));

      toast({
        title: "Price Updated",
        description: `Billing rate for this organization set to ₹${priceNum} + GST.`,
      });
      setIsPriceModalOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update subscription price."
      });
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8 space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-1" />
          <Skeleton className="h-64 col-span-2" />
        </div>
      </div>
    );
  }

  const sub = customer?.subscription;
  const batteries = customer?.bms_devices ? Object.entries(customer.bms_devices).filter(([_, d]: any) => d.status !== 'archived') : [];
  const gateways = customer?.linked_devices ? Object.entries(customer.linked_devices) : [];
  
  const pricePerUnit = sub?.price_per_unit || 50;
  const subtotal = batteries.length * pricePerUnit;
  const gst = subtotal * 0.18;
  const total = subtotal + gst;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card shadow-sm sticky top-0 z-10 border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/admin/saas">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Organization Profile</h1>
              <p className="text-xs text-muted-foreground">{customer?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Mail className="mr-2 h-4 w-4" /> Contact Owner
            </Button>
            <Button variant="destructive" size="sm">
              <AlertTriangle className="mr-2 h-4 w-4" /> Suspend
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sidebar: Profile Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{customer?.fullName || 'N/A'}</CardTitle>
                    <CardDescription>ID: {customer?.custom_id || uid}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{customer?.companyName || 'Private Organization'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{customer?.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{customer?.mobileNumber || 'No Phone'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <span>Account: <Badge variant="outline" className="ml-1 bg-blue-50 text-blue-700 border-blue-200">Main Account</Badge></span>
                </div>
                
                {customer?.referralSource && (
                  <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                      <TicketPercent className="h-3 w-3" /> Referral Mentioned
                    </p>
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      {customer.referralSource}
                      <UserCheck className="h-3 w-3 text-green-500" />
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Review this reference to decide on custom pricing.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Status</span>
                  <Badge className={sub?.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                    {sub?.status || 'trialing'}
                  </Badge>
                </div>
                <div className="space-y-2 py-2 border-b">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Monthly Rate</span>
                      <Dialog open={isPriceModalOpen} onOpenChange={setIsPriceModalOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-primary">
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Adjust Billing Rate</DialogTitle>
                            <DialogDescription>
                              Set a custom price per battery for this organization.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="flex items-center space-x-2 py-4">
                            <div className="grid flex-1 gap-2">
                              <Label htmlFor="price" className="sr-only">Price (INR)</Label>
                              <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="price"
                                  type="number"
                                  value={newPrice}
                                  onChange={(e) => setNewPrice(e.target.value)}
                                  className="pl-9"
                                />
                              </div>
                            </div>
                            <Button type="button" size="sm" className="px-3" onClick={handleUpdatePrice} disabled={isUpdatingPrice}>
                              {isUpdatingPrice ? <Activity className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                          </div>
                          <DialogFooter className="sm:justify-start">
                            <p className="text-[10px] text-muted-foreground italic">
                              * Default is ₹50. Changes reflect on next automated invoice.
                            </p>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <span className="font-medium text-primary">₹{pricePerUnit}/unit</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Units Billed</span>
                    <span className="font-medium">{batteries.length} Batteries</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">₹{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">GST (18%)</span>
                    <span className="font-medium">₹{gst.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t">
                    <span className="text-sm font-bold">Total MRR</span>
                    <span className="font-bold text-lg text-primary">₹{total.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant="outline" size="sm">Modify Subscription Status</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-primary" />
                  Organization Members
                </CardTitle>
                <CardDescription>{subUsers.length} sub-users registered.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {subUsers.map((su: any) => (
                    <li key={su.uid} className="flex flex-col p-2 border rounded-md bg-muted/20 text-xs">
                      <span className="font-medium">{su.email}</span>
                      <div className="flex gap-2 mt-1 opacity-70">
                        <span>Gateway: {su.permissions?.canAddGateway ? '✅' : '❌'}</span>
                        <span>BMS: {su.permissions?.canRegisterBms ? '✅' : '❌'}</span>
                      </div>
                    </li>
                  ))}
                  {subUsers.length === 0 && <li className="text-center text-muted-foreground text-xs italic py-4">No team members.</li>}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Main Content: Fleet & Billing */}
          <div className="lg:col-span-2 space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Server className="h-4 w-4" /> Organization Gateways
                  </CardDescription>
                  <CardTitle className="text-2xl">{gateways.length}</CardTitle>
                </CardHeader>
                <CardContent className="max-h-48 overflow-y-auto pt-4 border-t">
                  <ul className="space-y-2">
                    {gateways.map(([gid, gData]: any) => (
                      <li key={gid} className="flex justify-between items-center text-xs p-2 bg-muted/30 rounded border">
                        <div className="flex flex-col">
                          <span className="font-mono">{gid}</span>
                          <span className="text-[10px] text-muted-foreground">{gData.assigned_name}</span>
                        </div>
                        <span className="text-muted-foreground">{gData.location}</span>
                      </li>
                    ))}
                    {gateways.length === 0 && <li className="text-center text-muted-foreground text-xs italic">No gateways linked.</li>}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Battery className="h-4 w-4" /> Active Batteries
                  </CardDescription>
                  <CardTitle className="text-2xl">{batteries.length}</CardTitle>
                </CardHeader>
                <CardContent className="max-h-48 overflow-y-auto pt-4 border-t">
                  <ul className="space-y-2">
                    {batteries.map(([mac, bData]: any) => (
                      <li key={mac} className="flex justify-between items-center text-xs p-2 bg-muted/30 rounded border">
                        <span>{bData.deviceNickname || mac}</span>
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">Active</Badge>
                      </li>
                    ))}
                    {batteries.length === 0 && <li className="text-center text-muted-foreground text-xs italic">No batteries registered.</li>}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Billing History</CardTitle>
                    <CardDescription>Past invoices generated for this organization.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <History className="mr-2 h-4 w-4" /> Log Manual Credit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Invoice ID</th>
                        <th className="px-4 py-3 text-left font-medium">Period</th>
                        <th className="px-4 py-3 text-left font-medium">Amount (Incl. GST)</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs">{inv.id}</td>
                          <td className="px-4 py-3">{inv.billingPeriod}</td>
                          <td className="px-4 py-3 font-mono text-xs">₹{inv.amount.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className={inv.status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' : ''}>
                              {inv.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {invoices.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground italic">
                            No billing history available for this customer.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}
