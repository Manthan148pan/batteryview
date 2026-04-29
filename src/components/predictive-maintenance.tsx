
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wrench, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PredictiveMaintenanceProps {
  activeGateway: string | null;
}

export default function PredictiveMaintenance({ activeGateway }: PredictiveMaintenanceProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [prediction, setPrediction] = useState<{ healthScore: number; recommendation: string; explanation: string; } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRunPrediction = async () => {
    if (!activeGateway) {
      toast({
        variant: 'destructive',
        title: 'No Gateway Selected',
        description: 'Please select an active gateway to run a prediction.',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setPrediction(null);

    // AI functionality is temporarily disabled to fix a package issue.
    // This will be re-enabled shortly.
    setTimeout(() => {
        setError('The AI prediction service is temporarily unavailable. Please try again later.');
        setIsLoading(false);
    }, 1500);

  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <Wrench className="mr-2 h-6 w-6 text-primary" />
          Predictive Maintenance
        </CardTitle>
        <CardDescription>
          Use AI to predict maintenance needs based on historical usage patterns.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {!prediction && !error && (
            <p className="mb-4 text-sm text-muted-foreground">
                Click the button to run the AI prediction for the active gateway.
            </p>
        )}
        
        {error && (
            <Alert variant="destructive" className="mb-4 text-left">
                <AlertTitle>Prediction Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {prediction && (
            <Alert className="mb-4 text-left">
                <AlertTitle className="font-bold text-primary">AI Prediction Result</AlertTitle>
                <AlertDescription>
                    <p className="font-semibold mt-2">Health Score: {prediction.healthScore}/100</p>
                    <p className="mt-2"><strong>Recommendation:</strong> {prediction.recommendation}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{prediction.explanation}</p>
                </AlertDescription>
            </Alert>
        )}

        <Button onClick={handleRunPrediction} disabled={isLoading || !activeGateway} className="w-full sm:w-auto" style={{backgroundColor: '#1E3A8A'}}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wrench className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Analyzing...' : 'Run Prediction'}
        </Button>
      </CardContent>
    </Card>
  );
}
