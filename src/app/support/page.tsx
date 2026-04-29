'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LifeBuoy, ArrowLeft, Send, Mail, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function SupportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    setTimeout(() => {
      toast({
        title: 'Request Submitted',
        description: "We've received your support request and will get back to you shortly.",
      });
      setName('');
      setEmail('');
      setMessage('');
      setIsSubmitting(false);
    }, 1000);
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
              Support Center
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 items-center justify-center py-12 px-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <LifeBuoy className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">How can we help?</CardTitle>
            <CardDescription>
              Fill out the form below or contact us directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Contact Us Directly</h3>
                  <div className="flex items-center gap-4">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <div>
                          <p className="font-medium">Email</p>
                          <a href="mailto:support@batteryview.tech" className="text-sm text-primary hover:underline">
                          support@batteryview.tech
                          </a>
                      </div>
                  </div>
                   <div className="flex items-center gap-4">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                          <p className="font-medium">Phone</p>
                          <p className="text-sm text-muted-foreground">+91 9724731414</p>
                      </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                      <p>Our support team is available from 10 AM to 5 PM, Monday to Friday.</p>
                  </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                   <h3 className="text-lg font-semibold">Send a Message</h3>
                  <div className="space-y-2">
                      <Label htmlFor="name">Your Name</Label>
                      <Input id="name" placeholder=" " required value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="email">Your Email</Label>
                      <Input id="email" type="email" placeholder=" " required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="message">Your Message</Label>
                      <Textarea id="message" placeholder="Please describe your issue..." required value={message} onChange={(e) => setMessage(e.target.value)} />
                  </div>
                   <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                          <>
                              <Send className="mr-2 h-4 w-4 animate-pulse" />
                              Submitting...
                          </>
                      ) : (
                         <>
                           <Send className="mr-2 h-4 w-4" />
                           Submit Request
                         </>
                      )}
                  </Button>
              </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
