'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, Phone, Building } from 'lucide-react';
import Link from 'next/link';

export default function ContactPage() {
  const router = useRouter();

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
              Contact Information
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 items-center justify-center py-12 px-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Contact Us</CardTitle>
            <CardDescription>
              Get in touch for sales, support, or any other inquiries.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="space-y-6">
                  <h3 className="text-lg font-semibold border-b pb-2">Our Office</h3>
                  <div className="flex items-start gap-4">
                      <Building className="h-6 w-6 text-muted-foreground mt-1" />
                      <div>
                          <p className="font-medium">BatteryView</p>
                          <p className="text-sm text-muted-foreground">
                              Gotri, Vadodara<br />
                              Gujarat, 390021
                          </p>
                      </div>
                  </div>
              </div>
              <div className="space-y-6">
                   <h3 className="text-lg font-semibold border-b pb-2">Departments</h3>
                  <div className="flex items-start gap-4">
                      <Mail className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                          <p className="font-medium">General Inquiries</p>
                          <a href="mailto:info@batteryview.tech" className="text-sm text-primary hover:underline">
                              info@batteryview.tech
                          </a>
                      </div>
                  </div>
                   <div className="flex items-start gap-4">
                      <Phone className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                          <p className="font-medium">Sales Department</p>
                          <p className="text-sm text-muted-foreground">+91 9724731414</p>
                      </div>
                  </div>
              </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
