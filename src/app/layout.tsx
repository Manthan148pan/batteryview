import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/use-auth';

export const metadata: Metadata = {
  title: 'BatteryView',
  description: 'A modern dashboard for monitoring Battery Management Systems.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen">
        <AuthProvider>
          <main className="flex-grow">{children}</main>
          <Toaster />
          <footer className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 lg:px-8 py-4 pb-20 md:pb-4 text-sm text-muted-foreground bg-card border-t">
            <div className="flex items-center gap-x-6 gap-y-2 flex-wrap justify-center mb-4 sm:mb-0">
              <Link href="/support" className="hover:text-primary">Support</Link>
              <Link href="/contact" className="hover:text-primary">Contact</Link>
              <Link href="/privacy-policy" className="hover:text-primary">Privacy Policy</Link>
              <Link href="/faq" className="hover:text_primary">FAQ</Link>
            </div>
            <div className="text-center sm:text-right">
              BatteryView
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
