
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto flex flex-1 flex-col items-center justify-center py-12 px-4">
          <Card className="w-full max-w-4xl">
            <CardHeader className="text-center">
              <Shield className="mx-auto h-12 w-12 text-primary" />
              <CardTitle className="mt-4 text-2xl">Privacy Policy</CardTitle>
              <CardDescription>Last Updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
                    <p>
                        BatteryView ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our BatteryView application (the "Application"). This policy is framed in compliance with the applicable laws of India, including the Digital Personal Data Protection Act, 2023 (DPDPA).
                    </p>
                    
                    <div className="p-4 border-l-4 border-destructive bg-destructive/10 rounded-md">
                        <p className="font-bold text-destructive">Disclaimer:</p>
                        <p className="text-xs text-destructive/90">This document is for informational purposes only and does not constitute legal advice. You should consult with a qualified legal professional to ensure compliance with all applicable laws and regulations.</p>
                    </div>

                    <section>
                        <h3 className="font-semibold text-lg">1. Information We Collect</h3>
                        <p>We may collect information about you in a variety of ways. The information we may collect via the Application includes:</p>
                        <ul>
                            <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, company name, mobile number, and designation, that you voluntarily give to us when you register with the Application.</li>
                            <li><strong>Device and Usage Data:</strong> Information our servers automatically collect when you access the Application, such as your device ID, gateway information, BMS data (including but not limited to voltage, current, temperature, state of charge), and the timestamps of your activities.</li>
                            <li><strong>Location Data:</strong> We may request one-time access to your device's geographical location to provide localized features, such as displaying the current weather on your dashboard. This information is used ephemerally to fetch weather data and is not stored on our servers or linked to your account.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-semibold text-lg">2. How We Use Your Information</h3>
                        <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Application to:</p>
                        <ul>
                            <li>Create and manage your account.</li>
                            <li>Provide and manage our services, including displaying historical data and real-time monitoring.</li>
                            <li>Enhance your user experience by providing contextual information, such as local weather.</li>
                            <li>Email you regarding your account or order.</li>
                            <li>Improve the efficiency and operation of the Application.</li>
                            <li>Monitor and analyze usage and trends to improve your experience.</li>
                            <li>Comply with legal and regulatory requirements.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-semibold text-lg">3. Disclosure of Your Information</h3>
                        <p>We do not share, sell, rent, or trade your information with third parties for their commercial purposes. We may share information we have collected about you in certain situations:</p>
                        <ul>
                            <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
                            <li><strong>Business Transfers:</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
                        </ul>
                    </section>
                    
                    <section>
                        <h3 className="font-semibold text-lg">4. Your Rights as a Data Principal under DPDPA</h3>
                        <p>As per the Digital Personal Data Protection Act, 2023, you have certain rights as a "Data Principal":</p>
                        <ul>
                            <li><strong>Right to Access:</strong> You have the right to obtain a summary of your personal data that is being processed by us.</li>
                            <li><strong>Right to Correction and Erasure:</strong> You have the right to request the correction of inaccurate or misleading personal data and the erasure of personal data that is no longer necessary for the purpose for which it was processed.</li>
                            <li><strong>Right to Grievance Redressal:</strong> You have the right to a readily available means of grievance redressal. You can contact our Grievance Officer for any concerns.</li>
                            <li><strong>Right to Nominate:</strong> You have the right to nominate any other individual who shall, in the event of your death or incapacity, exercise your rights.</li>
                        </ul>
                        <p>To exercise these rights, please contact us using the contact information provided below.</p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-lg">5. Data Security</h3>
                        <p>We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.</p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-lg">6. Children's Privacy</h3>
                        <p>We do not knowingly solicit information from or market to children under the age of 18. If you become aware of any data we have collected from children under age 18, please contact us using the contact information provided below.</p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-lg">7. Changes to This Privacy Policy</h3>
                        <p>We may update this Privacy Policy from time to time in order to reflect, for example, changes to our practices or for other operational, legal, or regulatory reasons.</p>
                    </section>
                    
                    <section>
                        <h3 className="font-semibold text-lg">8. Grievance Officer</h3>
                        <p>In accordance with the Information Technology Act 2000 and rules made thereunder, and the DPDPA, the name and contact details of the Grievance Officer are provided below:</p>
                        <div className="p-4 bg-muted/50 rounded-md border">
                            <p>
                                Name: [Grievance Officer Name]<br />
                                Email: <a href="mailto:grievance@batteryview.com" className="text-primary hover:underline">grievance@batteryview.com</a><br />
                                Address: 123 Innovation Drive, Tech Park, Cityville, ST 54321
                            </p>
                        </div>
                    </section>

                    <section>
                        <h3 className="font-semibold text-lg">9. Contact Us</h3>
                        <p>If you have questions or comments about this Privacy Policy, please contact us at: <a href="mailto:info@batteryview.com" className="text-primary hover:underline">info@batteryview.com</a></p>
                    </section>
                </div>
            </CardContent>
          </Card>
      </main>
    </div>
  );
}
