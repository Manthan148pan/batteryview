
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { BookOpen, ArrowLeft, ScanLine, Power, Timer, Info } from 'lucide-react';

export default function GuidePage() {
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
              Application Guide
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 items-center justify-center py-12 px-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <BookOpen className="w-12 h-12 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome to BatteryView</CardTitle>
              <CardDescription>
                Here you can find instructions on how to use the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <h3 className="font-semibold mt-4">1. Getting Started</h3>
                  <p>To begin, you need to register a gateway device. This device acts as a bridge between your BMS devices and the application.</p>
                  
                  <h3 className="font-semibold mt-4">2. Registering a Gateway</h3>
                  <p>Navigate to "Add Gateway Device" from the main menu and enter the unique device ID provided by your gateway.</p>

                  <h3 className="font-semibold mt-4">3. Registering a BMS</h3>
                  <p>Once a gateway is active, you can register your BMS devices by their MAC addresses through the "Register BMS" page.</p>
                  
                  <h3 className="font-semibold mt-4">4. Dashboard Overview</h3>
                  <p>The main dashboard displays all your connected BMS devices. You can initiate a scan, connect to devices, and view real-time data.</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-4 prose prose-sm dark:prose-invert max-w-none">5. Understanding the Dashboard Buttons</h3>
                  <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="item-1">
                        <AccordionTrigger>
                          <div className="flex items-center gap-3">
                            <ScanLine className="h-5 w-5 text-primary"/>
                            <span className="font-medium">Scan Button</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-muted-foreground text-sm pl-8">This initiates a manual search for available BMS devices through your selected gateway. Use this to discover new batteries that are within range.</p>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-2">
                        <AccordionTrigger>
                          <div className="flex items-center gap-3">
                            <Power className="h-5 w-5 text-primary"/>
                            <span className="font-medium">Connect All Button</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-muted-foreground text-sm pl-8">This button sequentially connects to every available BMS device to fetch a snapshot of its current data. The data is then saved to the device's history.</p>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-3">
                        <AccordionTrigger>
                          <div className="flex items-center gap-3">
                            <Timer className="h-5 w-5 text-primary"/>
                            <span className="font-medium">Auto Button</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-muted-foreground text-sm pl-8">Toggles the automatic scan and connect feature. When enabled, the application will periodically scan for devices and connect to them to automatically log historical data.</p>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-4">
                        <AccordionTrigger>
                          <div className="flex items-center gap-3">
                            <Info className="h-5 w-5 text-primary"/>
                            <span className="font-medium">Details Button (on BMS card)</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-muted-foreground text-sm pl-8">Opens a pop-up window showing detailed real-time information for that specific battery, including individual cell voltages and temperatures.</p>
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="item-5">
                        <AccordionTrigger>
                          <div className="flex items-center gap-3">
                            <Power className="h-5 w-5 text-primary"/>
                            <span className="font-medium">Connect Button (on BMS card)</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="text-muted-foreground text-sm pl-8">Connects to a single, specific battery to update its data and save a snapshot to its history log.</p>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                </div>

            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" onClick={() => router.back()}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Previous Page
              </Button>
            </CardFooter>
          </Card>
      </main>
    </div>
  );
}
