'use client';

import { useState } from 'react';
import { Upload, FileText, Table as TableIcon, Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

export default function OCRPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any[] | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const handleConvert = async () => {
    if (!file) return;

    setIsProcessing(true);
    setUploadProgress(20);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadProgress(40);
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(80);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to process document');

      setResult(data.data);
      setUploadProgress(100);
      toast({
        title: "Conversion Successful",
        description: `Extracted ${data.data.length} rows of data.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Conversion Failed",
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const exportToCSV = () => {
    if (!result || result.length === 0) return;
    
    const headers = Object.keys(result[0]);
    const csvContent = [
      headers.join(','),
      ...result.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `extracted_data_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Smart OCR Converter
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              Transform images and PDFs into structured tables using AI.
            </p>
          </div>
          {result && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setFile(null); setPreview(null); setResult(null); }}>
                <RefreshCw className="mr-2 h-4 w-4" /> Start Over
              </Button>
              <Button onClick={exportToCSV} className="bg-green-600 hover:bg-green-700 text-white">
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          )}
        </div>

        {!result ? (
          <Card className="border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <CardContent className="pt-10 pb-10 flex flex-col items-center justify-center space-y-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Upload className="h-10 w-10 text-primary animate-pulse" />
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Upload your document</h3>
                <p className="text-sm text-slate-500">Supports JPG, PNG, and PDF files</p>
              </div>

              <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                <label className="w-full">
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                  />
                  <div className="flex items-center justify-center px-4 py-3 bg-white dark:bg-slate-800 border rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <FileText className="mr-2 h-4 w-4 text-slate-400" />
                    <span className="text-sm font-medium">
                      {file ? file.name : "Select a file"}
                    </span>
                  </div>
                </label>

                {file && (
                  <Button 
                    className="w-full h-12 text-lg shadow-lg shadow-primary/20" 
                    onClick={handleConvert}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <TableIcon className="mr-2 h-5 w-5" />
                        Convert to Table
                      </>
                    )}
                  </Button>
                )}
              </div>

              {isProcessing && (
                <div className="w-full max-w-md space-y-2 text-center">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-slate-500">
                    AI is analyzing your document structure...
                  </p>
                </div>
              )}

              {preview && (
                <div className="mt-8 rounded-xl overflow-hidden border-4 border-white shadow-xl max-w-md w-full">
                  <img src={preview} alt="Preview" className="w-full h-auto" />
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-400">Analysis Complete</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-500/80">
                Successfully extracted structured data from your document.
              </AlertDescription>
            </Alert>

            <Card className="overflow-hidden border-none shadow-2xl">
              <CardHeader className="bg-slate-900 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Extracted Data</CardTitle>
                    <CardDescription className="text-slate-400">
                      Review and export the structured results below.
                    </CardDescription>
                  </div>
                  <TableIcon className="h-6 w-6 text-slate-400" />
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100 dark:bg-slate-800/50">
                      {Object.keys(result[0] || {}).map((header) => (
                        <TableHead key={header} className="font-bold text-slate-700 dark:text-slate-300">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.map((row, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        {Object.values(row).map((value: any, j) => (
                          <TableCell key={j} className="text-slate-600 dark:text-slate-400">
                            {value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
