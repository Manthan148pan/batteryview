
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getClientDatabase, ref, get } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Database, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import JsonTableView from '@/components/json-table-viewer';

export default function AdminDatabasePage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [dbData, setDbData] = useState<object | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission to view this page.' });
      router.push('/');
    }
  }, [isAdmin, loading, router, toast]);

  useEffect(() => {
    const fetchDatabase = async () => {
      if (!isAdmin) return;

      const db = getClientDatabase();
      if (!db) {
        toast({ variant: 'destructive', title: 'Database Error', description: 'Could not connect to the database.' });
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      try {
        const dbRef = ref(db, '/');
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          setDbData(snapshot.val());
        } else {
          setDbData(null);
        }
      } catch (error: any) {
        console.error("Failed to fetch database:", error);
        toast({ variant: 'destructive', title: 'Fetch Failed', description: error.message || 'Could not load data from Firebase.' });
      } finally {
        setIsFetching(false);
      }
    };

    if (isAdmin) {
      fetchDatabase();
    }
  }, [isAdmin, toast]);

  const flattenJson = (data: any, prefix = ''): { [key: string]: string | number | boolean } => {
    let result: { [key: string]: string | number | boolean } = {};
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        if (typeof data[key] === 'object' && data[key] !== null) {
          Object.assign(result, flattenJson(data[key], newPrefix));
        } else {
          result[newPrefix] = data[key];
        }
      }
    }
    return result;
  };

  const handleDownloadCsv = () => {
    if (!dbData) {
      toast({ variant: 'destructive', title: 'No Data', description: 'There is no data to download.' });
      return;
    }
    setIsDownloading(true);

    try {
      const flattenedData = flattenJson(dbData);

      let csvContent = "Path,Value\n";

      for (const path in flattenedData) {
        let value = flattenedData[path];
        // Escape commas and quotes in value
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        csvContent += `${path},${value}\n`;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const fileName = `firebase_database_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: 'Download Started', description: `Your database has been exported as ${fileName}.` });
    } catch (error) {
      console.error("Error generating CSV:", error);
      toast({ variant: 'destructive', title: 'Download Failed', description: 'An error occurred while generating the CSV file.' });
    } finally {
      setIsDownloading(false);
    }
  };


  if (loading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              Database Viewer
            </h1>
          </div>
          <Button onClick={handleDownloadCsv} disabled={isDownloading || isFetching}>
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {isDownloading ? 'Exporting...' : 'Export as CSV'}
          </Button>
        </div>
      </header>
      <main className="px-4 sm:px-6 lg:px-8 py-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-6 w-6 text-primary" />
              Realtime Database Inspector
            </CardTitle>
            <CardDescription>
              A read-only table view of the entire database structure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 border-l-4 border-yellow-500 bg-yellow-500/10 text-yellow-700 rounded-r-lg mb-6">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mr-3 mt-1" />
                <div>
                  <h4 className="font-bold">Admin Tool</h4>
                  <p className="text-sm">This is a tabular representation of your entire database. No changes can be made from this view.</p>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-md bg-muted/30 overflow-x-auto min-h-[50vh]">
              {isFetching ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/4" />
                  <Skeleton className="h-6 w-1/2 ml-4" />
                  <Skeleton className="h-6 w-1/3 ml-4" />
                  <Skeleton className="h-8 w-1/3 mt-4" />
                  <Skeleton className="h-6 w-3/4 ml-4" />
                </div>
              ) : dbData ? (
                <JsonTableView data={dbData} />
              ) : (
                <p className="text-muted-foreground">No data found in the database.</p>

              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
