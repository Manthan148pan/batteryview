'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <HelpCircle className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="mt-4 text-2xl">Frequently Asked Questions</CardTitle>
          <CardDescription>This page is under construction. Please check back later.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">We are compiling a list of frequently asked questions.</p>
          <Button asChild variant="link" className="mt-4">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
