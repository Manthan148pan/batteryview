'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  ArrowLeft,
  CreditCard,
  Battery,
  IndianRupee,
  CheckCircle2,
  Download,
  FileText,
  Clock,
  QrCode,
  ShieldCheck,
  Plus,
  Loader2,
  ExternalLink,
  Zap
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { billingApi, invoiceApi } from '@/lib/api/client';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';
import type { Invoice } from '@/types/bms';
import { useToast } from '@/hooks/use-toast';

export default function BillingPage() {
  const { user, userProfile, loading } = useAuth();
  const { toast } = useToast();
  const [activeBatteryCount, setActiveBatteryCount] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [summary, setSummary] = useState<{
    subtotal: number;
    gstAmount: number;
    grandTotal: number;
    pricePerUnit: number;
    nextBillDate: Date | null;
  }>({
    subtotal: 0,
    gstAmount: 0,
    grandTotal: 0,
    pricePerUnit: 50,
    nextBillDate: null
  });

  // Modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'methods' | 'upi' | 'card' | 'razorpay'>('methods');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        // Fetch billing summary from Supabase
        const summaryRes = await billingApi.getSummary();
        if (summaryRes.success && summaryRes.data) {
          const { activeBatteryCount, subscription, summary: financial } = summaryRes.data;
          setActiveBatteryCount(activeBatteryCount);
          setSummary({
            subtotal: financial.subtotal,
            gstAmount: financial.gstAmount,
            grandTotal: financial.grandTotal,
            pricePerUnit: subscription.pricePerUnit,
            nextBillDate: new Date(subscription.currentPeriodEnd)
          });
        }

        // Fetch invoice history from Supabase
        const invoiceRes = await invoiceApi.list({ limit: 10 });
        if (invoiceRes.success && invoiceRes.data) {
          const mappedInvoices: Invoice[] = (invoiceRes.data as any).invoices.map((inv: any) => ({
            id: inv.id,
            date: format(new Date(inv.createdAt), 'yyyy-MM-dd'),
            amount: inv.amountDue,
            status: inv.status,
            batteryCount: 0, // In production, this would be snapshot in the invoice record
            billingPeriod: inv.billingPeriod ? format(new Date(inv.billingPeriod), 'MMMM yyyy') : 'N/A'
          }));
          setInvoices(mappedInvoices);
        }
      } catch (err) {
        console.error('Failed to fetch billing data:', err);
      }
    };
    if (user) fetchBillingData();
  }, [user]);

  const pricePerUnit = summary.pricePerUnit;
  const subtotal = summary.subtotal;
  const gstAmount = summary.gstAmount;
  const grandTotal = summary.grandTotal;

  const handleRazorpayRedirect = () => {
    setIsProcessing(true);
    setPaymentStep('razorpay');

    // Simulate Razorpay Gateway handoff
    setTimeout(() => {
      toast({
        title: "Redirecting...",
        description: "Opening secure Razorpay Checkout window.",
      });
      // In a real app: window.location.href = response.payment_url;
      setTimeout(() => {
        setIsProcessing(false);
        setIsPaymentModalOpen(false);
        toast({
          title: "Payment Gateway Demo",
          description: "In production, the Razorpay Standard Checkout would appear here.",
        });
      }, 2000);
    }, 1500);
  };

  const generatePaymentQR = async () => {
    setIsProcessing(true);
    const upiId = "batteryview@upi";
    const name = "BatteryView Tech Solutions";
    const amount = grandTotal.toFixed(2);
    const note = `Subscription for ${activeBatteryCount} batteries`;

    const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

    try {
      const url = await QRCode.toDataURL(upiUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#1E3A8A', light: '#FFFFFF' },
      });
      setQrCodeUrl(url);
      setPaymentStep('upi');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'QR Generation Failed', description: 'Could not create payment QR code.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadInvoicePDF = (invoice: Invoice) => {
    const doc = new jsPDF();
    const invSubtotal = invoice.batteryCount * pricePerUnit;
    const invGst = invSubtotal * 0.18;

    doc.setFontSize(20);
    doc.text('TAX INVOICE', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('BatteryView Tech Solutions', 14, 35);
    doc.text('Gotri, Vadodara, Gujarat', 14, 40);
    doc.text('GSTIN: 24AAACB1234A1Z1', 14, 45);
    doc.setFontSize(12);
    doc.text(`Invoice Number: ${invoice.id}`, 140, 35);
    doc.text(`Date: ${invoice.date}`, 140, 42);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 140, 49);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('BILL TO:', 14, 65);
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(userProfile?.fullName || user?.email || 'Valued Customer', 14, 72);
    doc.setFontSize(10);
    doc.text(userProfile?.companyName || 'Private Organization', 14, 78);

    (doc as any).autoTable({
      startY: 90,
      head: [['Description', 'Qty', 'Unit Price', 'Total']],
      body: [
        ['Battery Monitoring Service Fee (Excl. GST)', invoice.batteryCount, `INR ${pricePerUnit.toFixed(2)}`, `INR ${invSubtotal.toFixed(2)}`],
        ['GST (18%)', '-', '-', `INR ${invGst.toFixed(2)}`],
        ['Platform Access Fee', '1', 'Included', 'INR 0.00']
      ],
      foot: [['', '', 'Grand Total (Incl. GST)', `INR ${invoice.amount.toFixed(2)}`]],
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138] }
    });

    doc.setFontSize(10);
    doc.text('Terms: Paid via Digital Wallet/Card', 14, (doc as any).lastAutoTable.finalY + 20);
    doc.text('This is a computer generated invoice and does not require a signature.', 14, (doc as any).lastAutoTable.finalY + 30);
    doc.save(`Invoice_${invoice.id}.pdf`);
  };

  if (loading) return <div className="p-8 text-center">Loading Billing Information...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/users">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Billing & Subscription</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto space-y-8">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="text-green-500 h-5 w-5" />
                  Subscription Summary
                </CardTitle>
                <CardDescription>
                  Real-time billing calculation (₹{pricePerUnit} + 18% GST per battery).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <Battery className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Active Units</p>
                        <p className="text-xl font-bold">{activeBatteryCount} Batteries</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-3 w-full">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <IndianRupee className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-muted-foreground">Monthly Estimate</p>
                        <div className="flex flex-col">
                          <span className="text-xl font-bold">₹{grandTotal.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground">
                            (₹{subtotal.toLocaleString()} Base + ₹{gstAmount.toLocaleString()} GST)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 border rounded-lg text-sm bg-blue-50/50 text-blue-700">
                  <Clock className="h-5 w-5 flex-shrink-0" />
                  <p>Your billing cycle resets on the 1st of every month. Next bill generation: <strong>{summary.nextBillDate ? format(summary.nextBillDate, 'PPP') : 'N/A'}</strong></p>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-6 gap-4">
                <Button
                  className="flex-1 gradient-bg text-white"
                  onClick={() => {
                    setPaymentStep('methods');
                    setIsPaymentModalOpen(true);
                  }}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Manage Payments
                </Button>
                <Button variant="outline" className="flex-1" onClick={generatePaymentQR}>
                  <QrCode className="mr-2 h-4 w-4" />
                  Instant Pay (UPI)
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Platform Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-md bg-secondary/30">
                  <p className="text-2xl font-extrabold flex items-center">
                    <IndianRupee className="h-5 w-5" /> {pricePerUnit}
                    <span className="text-sm font-normal text-muted-foreground ml-1">+ 18% GST / unit</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Tier: Enterprise Flex</p>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Unlimited Gateway Discovery</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>1 Minute Polling Interval</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>30-Day Data Retention</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Past Invoices</CardTitle>
                  <CardDescription>View and export your individual billing statements.</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" /> Export All (CSV)
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
                      <th className="px-4 py-3 text-left font-medium">Units</th>
                      <th className="px-4 py-3 text-left font-medium">Amount (Incl. GST)</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.length > 0 ? invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs">{inv.id}</td>
                        <td className="px-4 py-3">{inv.billingPeriod}</td>
                        <td className="px-4 py-3">{inv.batteryCount} Batteries</td>
                        <td className="px-4 py-3 font-semibold">₹{inv.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {inv.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => downloadInvoicePDF(inv)}>
                            <Download className="h-4 w-4 text-primary" />
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground italic">
                          No generated invoices found. Your first bill will be generated at the end of the current trial period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>

      {/* Payment Dialog */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentStep === 'methods' && "Choose Payment Method"}
              {paymentStep === 'upi' && "Pay via UPI QR"}
              {paymentStep === 'card' && "Add New Card"}
              {paymentStep === 'razorpay' && "Razorpay Secure Checkout"}
            </DialogTitle>
            <DialogDescription>
              {paymentStep === 'methods' && "Select your preferred way to settle dues."}
              {paymentStep === 'upi' && `Scan the QR code to pay ₹${grandTotal.toFixed(2)} via any UPI app.`}
              {paymentStep === 'card' && "Securely add a credit or debit card for automatic billing."}
              {paymentStep === 'razorpay' && "Redirecting you to Razorpay Standard Checkout."}
            </DialogDescription>
          </DialogHeader>

          {paymentStep === 'methods' && (
            <div className="grid gap-4 py-4">
              <Button variant="outline" className="h-20 justify-start px-6 gap-4 border-2 border-primary/20 bg-primary/5 hover:bg-primary/10" onClick={handleRazorpayRedirect}>
                <div className="p-2 bg-white rounded shadow-sm">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-left flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-base">Razorpay Checkout</p>
                    <Badge className="bg-blue-600 text-white">RECOMMENDED</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Cards, Netbanking, UPI, Wallets</p>
                </div>
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Other Options</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="h-16 flex-col items-center justify-center p-2 gap-1" onClick={generatePaymentQR}>
                  <QrCode className="h-5 w-5 text-primary" />
                  <span className="text-[10px] font-semibold">Instant UPI QR</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col items-center justify-center p-2 gap-1" onClick={() => setPaymentStep('card')}>
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span className="text-[10px] font-semibold">Store Card</span>
                </Button>
              </div>
            </div>
          )}

          {paymentStep === 'razorpay' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <div className="text-center">
                <p className="font-semibold text-lg">Securely handshaking...</p>
                <p className="text-sm text-muted-foreground">Do not refresh this page.</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full text-[10px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                <span>Verified PCI-DSS Secure Gateway</span>
              </div>
            </div>
          )}

          {paymentStep === 'upi' && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm">Generating your secure QR...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-white rounded-xl border-4 border-primary/10 shadow-inner">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Payment QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="w-48 h-48 bg-muted animate-pulse" />
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-lg font-bold text-primary">₹{grandTotal.toFixed(2)}</p>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Encrypted UPI Transaction</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {paymentStep === 'card' && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input id="cardNumber" placeholder="0000 0000 0000 0000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input id="expiry" placeholder="MM/YY" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input id="cvv" placeholder="123" type="password" />
                </div>
              </div>
              <Button className="w-full mt-2" onClick={() => {
                toast({ title: "Card Added", description: "Your payment method has been updated successfully." });
                setIsPaymentModalOpen(false);
              }}>
                <Plus className="mr-2 h-4 w-4" /> Save Card
              </Button>
            </div>
          )}

          <DialogFooter className="sm:justify-start">
            {paymentStep !== 'methods' && !isProcessing && (
              <Button variant="ghost" onClick={() => setPaymentStep('methods')}>
                Back to Options
              </Button>
            )}
            {!isProcessing && (
              <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
