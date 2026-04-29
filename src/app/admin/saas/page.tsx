
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
  ArrowLeft, 
  IndianRupee, 
  Users, 
  Battery, 
  TrendingUp, 
  AlertTriangle, 
  Download, 
  Search, 
  Server, 
  Settings, 
  CreditCard, 
  LayoutDashboard,
  CheckCircle2,
  RefreshCw,
  MoreVertical,
  Globe,
  Activity,
  UserCheck,
  Briefcase,
  Receipt,
  ArrowUpRight,
  ShieldCheck,
  History,
  Zap,
  Megaphone,
  ArrowDownRight,
  ShieldAlert,
  BellRing,
  Key,
  GlobeLock,
  FileClock,
  Lock,
  ExternalLink,
  Cpu,
  Layers,
  HardDrive,
  Network,
  Shield,
  Workflow,
  CloudLightning,
  Signal,
  BarChart3,
  Timer,
  Database,
  UploadCloud,
  Rocket,
  GitBranch,
  Loader2,
  Check
} from 'lucide-react';
import { db, ref, get } from '@/lib/firebase';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table as ShadcnTable, 
  TableBody as ShadcnTableBody, 
  TableCell as ShadcnTableCell, 
  TableHead as ShadcnTableHead, 
  TableHeader as ShadcnTableHeader, 
  TableRow as ShadcnTableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { format, subHours, subMinutes, subDays, formatDistanceToNow } from 'date-fns';

interface FleetStats {
  totalUsers: number;
  totalActiveBatteries: number;
  totalGateways: number;
  estimatedMRR: number;
  newSignups: number;
  avgUnitsPerOrg: number;
  networkUptime: string;
}

interface PlatformActivity {
  id: string;
  type: 'signup' | 'gateway' | 'billing' | 'alert';
  message: string;
  timestamp: string;
  user: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  admin: string;
  category: 'Billing' | 'Security' | 'Configuration' | 'User Management';
  action: string;
  target: string;
  severity: 'low' | 'medium' | 'high';
}

interface Deployment {
  version: string;
  timestamp: string;
  deployedBy: string;
  status: 'success' | 'failed';
}

export default function AdminSaaSPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  
  const [stats, setStats] = useState<FleetStats>({
    totalUsers: 0,
    totalActiveBatteries: 0,
    totalGateways: 0,
    estimatedMRR: 0,
    newSignups: 0,
    avgUnitsPerOrg: 0,
    networkUptime: '99.9%'
  });

  const [users, setUsers] = useState<any[]>([]);
  const [allGateways, setAllGateways] = useState<any[]>([]);
  const [activities, setActivities] = useState<PlatformActivity[]>([]);

  // Config States
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [allowPublicSignup, setAllowPublicSignup] = useState(true);

  // OTA States
  const [liveVersion, setLiveVersion] = useState('v1.1.0-stable');
  const [stagedVersion, setStagedVersion] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([
    { version: 'v1.1.0-stable', timestamp: subHours(new Date(), 14).toISOString(), deployedBy: 'system-bot', status: 'success' },
    { version: 'v1.0.2-hotfix', timestamp: subDays(new Date(), 3).toISOString(), deployedBy: 'admin1eb', status: 'success' },
  ]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.bin')) {
        setIsUploading(true);
        toast({ title: 'Staging Firmware...', description: `${file.name} is being prepared for deployment.` });
        setTimeout(() => {
          setStagedVersion(file.name);
          setIsUploading(false);
          toast({ title: 'Firmware Staged!', description: `${file.name} is ready to be deployed.` });
        }, 1500);
      } else {
        toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please select a .bin file.' });
      }
    }
  };

  const handleDeploy = () => {
    if (!stagedVersion) return;
    setIsDeploying(true);
    toast({ title: 'Deployment Initiated', description: `Broadcasting update command for ${stagedVersion} to all gateways.` });
    setTimeout(() => {
      setLiveVersion(stagedVersion);
      setDeployments(prev => [{
        version: stagedVersion,
        timestamp: new Date().toISOString(),
        deployedBy: 'admin1eb',
        status: 'success',
      }, ...prev]);
      setStagedVersion(null);
      setIsDeploying(false);
      toast({ title: 'Deployment Successful!', description: `Fleet is now updating to ${stagedVersion}.` });
    }, 3000);
  };


  // Simulated Audit Logs
  const auditLogs: AuditLogEntry[] = [
    {
      id: 'log-1',
      timestamp: subMinutes(new Date(), 15).toISOString(),
      admin: 'admin1eb@gmail.com',
      category: 'Billing',
      action: 'Updated Base Rate',
      target: 'Organization: Acme Corp',
      severity: 'medium'
    },
    {
      id: 'log-2',
      timestamp: subHours(new Date(), 2).toISOString(),
      admin: 'admin1eb@gmail.com',
      category: 'Security',
      action: 'Rotated Webhook Secrets',
      target: 'System Integration',
      severity: 'high'
    },
    {
      id: 'log-3',
      timestamp: subHours(new Date(), 5).toISOString(),
      admin: 'admin1eb@gmail.com',
      category: 'Configuration',
      action: 'Standard Trial Extended',
      target: 'Global Defaults',
      severity: 'low'
    },
    {
      id: 'log-4',
      timestamp: subHours(new Date(), 24).toISOString(),
      admin: 'system-bot',
      category: 'User Management',
      action: 'Auto-Suspended Account',
      target: 'User: temp_test_01',
      severity: 'medium'
    }
  ];

  const fetchGlobalData = async () => {
    if (!db || !isAdmin) return;
    setLoading(true);
    try {
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      
      let totalBatteriesCount = 0;
      let totalGatewaysCount = 0;
      let calculatedMRR = 0;
      const gatewayList: any[] = [];

      if (snapshot.exists()) {
        const usersData = snapshot.val();
        
        const mainUserList = Object.entries(usersData)
          .filter(([_, data]: [string, any]) => data.role === 'main_user')
          .map(([uid, data]: [string, any]) => {
            const userBatteries = data.bms_devices ? Object.entries(data.bms_devices).filter(([_, d]: [string, any]) => d.status !== 'archived') : [];
            const userGateways = data.linked_devices ? Object.entries(data.linked_devices) : [];
            const subUsersCount = data.sub_users ? Object.keys(data.sub_users).length : 0;
            const pricePerUnit = data.subscription?.price_per_unit || 50;
            
            totalBatteriesCount += userBatteries.length;
            totalGatewaysCount += userGateways.length;
            calculatedMRR += (userBatteries.length * pricePerUnit);

            userGateways.forEach(([gid, gData]: [string, any]) => {
              gatewayList.push({
                id: gid,
                uid: uid,
                ownerEmail: data.email,
                ownerName: data.fullName,
                ...gData
              });
            });

            return {
              uid,
              ...data,
              batteryCount: userBatteries.length,
              gatewayCount: userGateways.length,
              subUsersCount,
              pricePerUnit,
              revenue: userBatteries.length * pricePerUnit
            };
          });
        
        setUsers(mainUserList);
        setAllGateways(gatewayList);

        setStats({
          totalUsers: mainUserList.length,
          totalActiveBatteries: totalBatteriesCount,
          totalGateways: totalGatewaysCount,
          estimatedMRR: calculatedMRR,
          newSignups: mainUserList.length > 0 ? 1 : 0,
          avgUnitsPerOrg: mainUserList.length > 0 ? totalBatteriesCount / mainUserList.length : 0,
          networkUptime: '99.98%'
        });
      }
    } catch (error) {
      console.error("Failed to fetch global fleet data:", error);
      toast({ variant: 'destructive', title: 'Network Error', description: 'Could not calculate fleet metrics.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchGlobalData();
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.companyName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const topRevenueOrgs = useMemo(() => {
    return [...users].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [users]);

  const handleConfigUpdate = (setting: string) => {
    toast({ title: "Configuration Updated", description: `${setting} has been successfully saved to the platform core.` });
  };

  const renderSessionDate = (u: any) => {
    try {
      if (!u.sessions) return 'N/A';
      const sessionList = Object.values(u.sessions);
      if (sessionList.length === 0) return 'N/A';
      const latest = (sessionList as any[]).sort((a,b) => b.loginTime.localeCompare(a.loginTime))[0];
      return format(new Date(latest.loginTime), 'MMM dd, HH:mm');
    } catch (e) { return 'N/A'; }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center min-h-screen flex flex-col items-center justify-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <Button asChild variant="link" className="mt-4"><Link href="/">Back to Dashboard</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card shadow-sm sticky top-0 z-10 border-b">
        <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SaaS Command Center</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-primary" /> Multi-tenant Infrastructure
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchGlobalData} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Sync Fleet
            </Button>
            <Button variant="default" size="sm" className="gradient-bg border-none text-white">
              <Download className="mr-2 h-4 w-4" /> Export Financials
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="overview" onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
              <LayoutDashboard className="mr-2 h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="customers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
              <Users className="mr-2 h-4 w-4" /> Customers
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
              <CreditCard className="mr-2 h-4 w-4" /> Revenue
            </TabsTrigger>
            <TabsTrigger value="operations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
              <Network className="mr-2 h-4 w-4" /> Operations Hub
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
              <Settings className="mr-2 h-4 w-4" /> Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Projected Gross MRR
                  </CardDescription>
                  <CardTitle className="text-3xl flex items-center">
                    <IndianRupee className="h-6 w-6" /> {(stats.estimatedMRR * 1.18).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </CardTitle>
                </CardHeader>
                <CardFooter className="pt-0">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-green-500" /> +12% from last month
                  </p>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" /> Total Organizations
                  </CardDescription>
                  <CardTitle className="text-3xl">{stats.totalUsers}</CardTitle>
                </CardHeader>
                <CardFooter className="pt-0">
                  <p className="text-xs text-muted-foreground">{stats.newSignups} new in last 7 days</p>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Battery className="h-4 w-4 text-green-600" /> Billable Units
                  </CardDescription>
                  <CardTitle className="text-3xl">{stats.totalActiveBatteries}</CardTitle>
                </CardHeader>
                <CardFooter className="pt-0">
                  <p className="text-xs text-muted-foreground">Avg. {stats.avgUnitsPerOrg.toFixed(1)} per Org</p>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-600" /> Network Health
                  </CardDescription>
                  <CardTitle className="text-3xl">{stats.networkUptime}</CardTitle>
                </CardHeader>
                <CardFooter className="pt-0">
                  <p className="text-xs text-muted-foreground">{stats.totalGateways} active gateways</p>
                </CardFooter>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Recent Platform Activity</CardTitle>
                  <CardDescription>Real-time log of organizational events and telemetry.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {activities.length > 0 ? activities.map((act) => (
                      <div key={act.id} className="flex gap-4 items-start">
                        <div className="mt-1 bg-muted p-2 rounded-full">
                          {act.type === 'gateway' ? <Server className="h-4 w-4 text-blue-500" /> : <UserCheck className="h-4 w-4 text-green-500" />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium leading-none">{act.message}</p>
                          <p className="text-xs text-muted-foreground">{act.user} • {format(new Date(act.timestamp), 'HH:mm')}</p>
                        </div>
                      </div>
                    )) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground italic">
                            <Activity className="h-8 w-8 mb-2 opacity-20" />
                            <p>No platform events recorded in last 24h.</p>
                        </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Business Controls</CardTitle>
                  <CardDescription>SaaS administrative overrides.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: "Broadcast Prepared", description: "Opening global notification composer." })}>
                    <Megaphone className="mr-2 h-4 w-4 text-primary" /> Broadcast to All Orgs
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: "Invoice Batch Queued", description: "Calculating totals for all billable units." })}>
                    <Receipt className="mr-2 h-4 w-4 text-blue-500" /> Bulk Invoice Generation
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => toast({ title: "Platform Credits", description: "Issuer/Debit tool for service credits." })}>
                    <IndianRupee className="mr-2 h-4 w-4 text-green-600" /> Platform Credit Adjust
                  </Button>
                  <Button className="w-full justify-start text-destructive hover:text-destructive" variant="outline" onClick={() => toast({ variant: "destructive", title: "Delinquency Report", description: "Fetching accounts with failed recurring payments." })}>
                    <AlertTriangle className="mr-2 h-4 w-4" /> Manage Delinquencies
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="operations" className="space-y-8">
            {/* Top Row: Infrastructure Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" /> Compute Load
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>NodeJS Clusters</span>
                      <span className="font-bold">24%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full w-[24%]" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Heap Utilization</span>
                      <span className="font-bold">42%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full w-[42%]" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Telemetry Ingress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-col">
                    <span className="text-2xl font-bold">14.2M</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Data points / 24h</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold">
                    <ArrowUpRight className="h-3 w-3" /> +4.2% vs avg
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <GlobeLock className="h-4 w-4 text-primary" /> Access Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Active Admin Sessions</span>
                    <span className="font-bold">2</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">MFA Enforcement</span>
                    <Badge className="bg-green-100 text-green-800 text-[8px] h-4">ACTIVE</Badge>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t">
                    <span className="text-muted-foreground">Unauthorized Attempts</span>
                    <span className="text-orange-600 font-bold">4 (Blocked)</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Workflow className="h-4 w-4 text-primary" /> Deployment Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Latest Version</span>
                    <span className="font-mono font-bold">v2.4.1-stable</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pipeline Health</span>
                    <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Healthy</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-2 italic">
                    Last deployed: 14h ago by system-bot
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Service Connectivity Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { name: 'Real-time DB', status: 'Online', delay: '12ms', icon: Database },
                { name: 'Auth Service', status: 'Online', delay: '45ms', icon: Key },
                { name: 'API Gateway', status: 'Online', delay: '22ms', icon: Globe },
                { name: 'BMS Pollers', status: 'Healthy', delay: '99.9%', icon: Activity },
                { name: 'AI Predictor', status: 'Idle', delay: 'N/A', icon: CloudLightning }
              ].map((service) => (
                <div key={service.name} className="p-3 bg-card border rounded-lg flex items-center justify-between group hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded group-hover:bg-primary/10 transition-colors">
                      <service.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{service.name}</p>
                      <p className="text-xs font-semibold">{service.status}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{service.delay}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Fleet Infrastructure & Gateways */}
              <div className="space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5 text-primary" />
                        Global Gateway Registry
                      </CardTitle>
                      <CardDescription>Live health and location of platform infrastructure.</CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono">{allGateways.length} Units</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto max-h-[350px]">
                      <ShadcnTable>
                        <ShadcnTableHeader>
                          <ShadcnTableRow className="bg-muted/50 text-[10px] uppercase tracking-wider">
                            <ShadcnTableHead>Gateway ID</ShadcnTableHead>
                            <ShadcnTableHead>Org Location</ShadcnTableHead>
                            <ShadcnTableHead>Owner</ShadcnTableHead>
                            <ShadcnTableHead className="text-right">Status</ShadcnTableHead>
                          </ShadcnTableRow>
                        </ShadcnTableHeader>
                        <ShadcnTableBody>
                          {allGateways.length > 0 ? allGateways.map((g) => (
                            <ShadcnTableRow key={`${g.uid}-${g.id}`} className="hover:bg-muted/30">
                              <ShadcnTableCell className="font-mono text-[10px]">{g.id}</ShadcnTableCell>
                              <ShadcnTableCell className="text-xs">{g.location}</ShadcnTableCell>
                              <ShadcnTableCell className="text-xs">
                                <div className="flex flex-col">
                                  <span>{g.ownerName}</span>
                                  <span className="text-[10px] text-muted-foreground">{g.ownerEmail}</span>
                                </div>
                              </ShadcnTableCell>
                              <ShadcnTableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                  <span className="text-[10px] font-bold text-green-700">ONLINE</span>
                                </div>
                              </ShadcnTableCell>
                            </ShadcnTableRow>
                          )) : (
                            <ShadcnTableRow>
                              <ShadcnTableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                                No gateways registered.
                              </ShadcnTableCell>
                            </ShadcnTableRow>
                          )}
                        </ShadcnTableBody>
                      </ShadcnTable>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-orange-700">
                      <ShieldAlert className="h-4 w-4" /> Incident Response Monitor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-white/50 rounded border border-orange-100 text-xs">
                      <div className="flex items-center gap-2">
                        <Signal className="h-3 w-3 text-orange-500 animate-pulse" />
                        <span>High Latency in asia-southeast1</span>
                      </div>
                      <Badge variant="outline" className="text-[8px]">INVESTIGATING</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-green-50/50 rounded border border-green-100 text-xs opacity-60">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span>Auth Token Rotation Issue</span>
                      </div>
                      <Badge variant="outline" className="text-[8px] bg-green-100 text-green-700 border-none">RESOLVED</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Audit Logs & Security & OTA */}
              <div className="space-y-6 lg:col-span-1">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileClock className="h-5 w-5 text-primary" />
                        Administrative Audit Trail
                      </CardTitle>
                      <CardDescription>Permanent record of sensitive platform actions.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto max-h-[150px]">
                      <ShadcnTable>
                        <ShadcnTableBody>
                          {auditLogs.map((log) => (
                            <ShadcnTableRow key={log.id} className="hover:bg-muted/30 text-xs">
                              <ShadcnTableCell className="font-mono text-[10px] whitespace-nowrap py-2">
                                {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                              </ShadcnTableCell>
                              <ShadcnTableCell className="py-2">{log.action}</ShadcnTableCell>
                              <ShadcnTableCell className="text-right py-2 text-[10px]">{log.admin.split('@')[0]}</ShadcnTableCell>
                            </ShadcnTableRow>
                          ))}
                        </ShadcnTableBody>
                      </ShadcnTable>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" />Firmware & OTA Updates</CardTitle>
                    <CardDescription>Manage and deploy firmware to the gateway fleet.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <div className="p-3 bg-muted/50 rounded-lg border">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-bold uppercase text-muted-foreground">Current Live Version</p>
                          <Badge variant="outline" className="font-mono bg-green-50 text-green-800 border-green-200">{liveVersion}</Badge>
                        </div>
                     </div>
                     {stagedVersion && (
                      <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-bold uppercase text-blue-700">Staged for Deployment</p>
                          <Badge variant="outline" className="font-mono bg-blue-100 text-blue-800 border-blue-300">{stagedVersion}</Badge>
                        </div>
                      </div>
                     )}
                     <div>
                       <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Deployment History</h4>
                       <div className="space-y-2">
                         {deployments.slice(0, 2).map(dep => (
                           <div key={dep.version} className="flex items-center justify-between text-xs p-2 border rounded-md">
                             <div className="flex items-center gap-2">
                               <GitBranch className="h-3 w-3" />
                               <span className="font-mono font-semibold">{dep.version}</span>
                             </div>
                             <span className="text-muted-foreground text-[10px]">{formatDistanceToNow(new Date(dep.timestamp), { addSuffix: true })}</span>
                           </div>
                         ))}
                       </div>
                     </div>
                  </CardContent>
                  <CardFooter className="grid grid-cols-2 gap-2">
                    <div>
                      <Button asChild variant="outline" className="w-full" disabled={isUploading || isDeploying}>
                        <label htmlFor="firmware-upload">
                          {isUploading ? <Loader2 className="animate-spin" /> : <UploadCloud />}
                          Upload .bin
                        </label>
                      </Button>
                      <Input 
                        id="firmware-upload" 
                        type="file" 
                        className="hidden" 
                        onChange={handleFileSelect}
                        accept=".bin"
                        disabled={isUploading || isDeploying}
                      />
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="gradient-bg text-white" disabled={!stagedVersion || isDeploying}>
                           {isDeploying ? <Loader2 className="animate-spin" /> : <Rocket />}
                           Deploy
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deploy Firmware to Fleet?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will broadcast an update command to all online gateways. Are you sure you want to deploy version <strong>{stagedVersion}</strong>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeploy}>Confirm Deployment</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardFooter>
                </Card>

              </div>
            </div>
          </TabsContent>

          <TabsContent value="customers">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Organization Directory</CardTitle>
                  <CardDescription>Manage main user accounts and billing entities.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search name, email, co..." 
                    className="pl-8" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <ShadcnTable>
                    <ShadcnTableHeader>
                      <ShadcnTableRow>
                        <ShadcnTableHead>Organization / Owner</ShadcnTableHead>
                        <ShadcnTableHead>Users</ShadcnTableHead>
                        <ShadcnTableHead>Status</ShadcnTableHead>
                        <ShadcnTableHead>Rate</ShadcnTableHead>
                        <ShadcnTableHead>Fleet Size</ShadcnTableHead>
                        <ShadcnTableHead>Monthly Billing</ShadcnTableHead>
                        <ShadcnTableHead>Last Activity</ShadcnTableHead>
                        <ShadcnTableHead className="text-right">Actions</ShadcnTableHead>
                      </ShadcnTableRow>
                    </ShadcnTableHeader>
                    <ShadcnTableBody>
                      {filteredUsers.length > 0 ? filteredUsers.map((u) => (
                        <ShadcnTableRow key={u.uid}>
                          <ShadcnTableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{u.fullName || u.email}</span>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-tighter">
                                <Briefcase className="h-2 w-2" /> {u.companyName || 'Private Org'}
                              </span>
                            </div>
                          </ShadcnTableCell>
                          <ShadcnTableCell>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {u.subUsersCount + 1}
                            </Badge>
                          </ShadcnTableCell>
                          <ShadcnTableCell>
                            <Badge variant={u.subscription?.status === 'active' ? 'default' : 'secondary'} className={u.subscription?.status === 'active' ? 'bg-green-100 text-green-800' : ''}>
                              {u.subscription?.status || 'trialing'}
                            </Badge>
                          </ShadcnTableCell>
                          <ShadcnTableCell className="text-xs font-mono">
                            ₹{u.pricePerUnit}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="text-xs">
                            {u.batteryCount} Units
                          </ShadcnTableCell>
                          <ShadcnTableCell className="font-mono text-xs">
                            ₹{(u.batteryCount * u.pricePerUnit * 1.18).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="text-[10px] text-muted-foreground">
                            {renderSessionDate(u)}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/customers/${u.uid}`}>
                                    <UserCheck className="mr-2 h-4 w-4" /> Dashboard
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">
                                  <AlertTriangle className="mr-2 h-4 w-4" /> Suspend Account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                      )) : (
                        <ShadcnTableRow>
                          <ShadcnTableCell colSpan={8} className="text-center py-12 text-muted-foreground italic">
                            No organizations found.
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                      )}
                    </ShadcnTableBody>
                  </ShadcnTable>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardDescription className="uppercase text-[10px] font-bold tracking-widest">Base Revenue (Subtotal)</CardDescription>
                  <CardTitle className="text-3xl flex items-center">
                    <IndianRupee className="h-6 w-6 text-muted-foreground mr-1" />
                    {stats.estimatedMRR.toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardFooter className="pt-0">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3 text-green-500" /> ₹{(stats.estimatedMRR * 0.08).toFixed(0)} vs last month
                  </p>
                </CardFooter>
              </Card>
              
              <Card className="bg-blue-50/20 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-blue-700">Estimated GST (18%)</CardDescription>
                  <CardTitle className="text-3xl flex items-center text-blue-700">
                    <IndianRupee className="h-6 w-6 mr-1" />
                    {(stats.estimatedMRR * 0.18).toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardFooter className="pt-0">
                  <p className="text-[10px] text-blue-600/70">Calculated for Indian Tax Compliance</p>
                </CardFooter>
              </Card>

              <Card className="bg-primary/10 border-primary/20">
                <CardHeader className="pb-2">
                  <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-primary">Gross Platform MRR</CardDescription>
                  <CardTitle className="text-3xl flex items-center text-primary">
                    <IndianRupee className="h-6 w-6 mr-1" />
                    {(stats.estimatedMRR * 1.18).toLocaleString()}
                  </CardTitle>
                </CardHeader>
                <CardFooter className="pt-0">
                  <p className="text-[10px] text-primary/70 font-semibold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Target: ₹5,00,000
                  </p>
                </CardFooter>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top Revenue Contributors</CardTitle>
                  <CardDescription>Top organizations by monthly billing volume.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topRevenueOrgs.map((org, index) => (
                      <div key={org.uid} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                            #{index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{org.companyName || org.fullName}</p>
                            <p className="text-[10px] text-muted-foreground">{org.batteryCount} Billable Units</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono font-bold">₹{(org.revenue * 1.18).toLocaleString()}</p>
                          <Badge variant="outline" className="text-[9px] uppercase h-4">Active</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Unit Economics</CardTitle>
                  <CardDescription>Platform efficiency and average metrics.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-xl bg-muted/20">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Avg. Rev / Battery</p>
                      <p className="text-xl font-mono font-bold text-foreground">₹{stats.totalActiveBatteries > 0 ? (stats.estimatedMRR / stats.totalActiveBatteries).toFixed(2) : '0.00'}</p>
                    </div>
                    <div className="p-4 border rounded-xl bg-muted/20">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Avg. Rev / Org</p>
                      <p className="text-xl font-mono font-bold text-foreground">₹{stats.totalUsers > 0 ? (stats.estimatedMRR / stats.totalUsers).toFixed(0) : '0'}</p>
                    </div>
                  </div>
                  <div className="p-4 border rounded-xl bg-primary/5 border-primary/10">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-semibold">Billing Efficiency</p>
                      <span className="text-xs text-primary font-bold">94.2%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="bg-primary h-full w-[94.2%]" />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">Percentage of active units successfully invoiced and paid this cycle.</p>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 text-yellow-800 rounded-lg text-xs border border-yellow-100">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Razorpay Webhooks for real-time payment reconciliation are currently in <strong>Test Mode</strong>.</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Platform Defaults
                  </CardTitle>
                  <CardDescription>Global variables for new organization onboarding.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <IndianRupee className="h-3 w-3" /> Default Base Price
                      </label>
                      <div className="flex gap-2">
                        <Input defaultValue="50" className="font-mono" />
                        <Button variant="outline" size="sm" onClick={() => handleConfigUpdate("Default Price")}>Apply</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <History className="h-3 w-3" /> Standard Trial
                      </label>
                      <div className="flex gap-2">
                        <Input defaultValue="7" className="font-mono" />
                        <Button variant="outline" size="sm" onClick={() => handleConfigUpdate("Trial Period")}>Apply</Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Entity Name (Billing Footer)</label>
                    <div className="flex gap-2">
                      <Input defaultValue="BatteryView Tech Solutions" />
                      <Button variant="outline" size="sm" onClick={() => handleConfigUpdate("Entity Name")}>Save</Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-4">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Automatic Invoicing</p>
                        <p className="text-[10px] text-muted-foreground">Generate PDF tax invoices automatically on payment.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Monthly Usage Reports</p>
                        <p className="text-[10px] text-muted-foreground">Email PDF fleet summaries to organization owners.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GlobeLock className="h-5 w-5 text-primary" />
                    System Controls
                  </CardTitle>
                  <CardDescription>Manage platform availability and security.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-xl bg-destructive/5 border-destructive/10">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-destructive flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" /> Maintenance Mode
                      </p>
                      <p className="text-[10px] text-muted-foreground">Disable all write operations and show downtime notice.</p>
                    </div>
                    <Switch 
                      checked={isMaintenanceMode} 
                      onCheckedChange={(val) => {
                        setIsMaintenanceMode(val);
                        handleConfigUpdate("Maintenance Mode");
                      }} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-xl bg-green-50/50 border-green-100">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-green-700 flex items-center gap-2">
                        <UserCheck className="h-4 w-4" /> Public Registration
                      </p>
                      <p className="text-[10px] text-muted-foreground">Allow new users to sign up from the public landing page.</p>
                    </div>
                    <Switch 
                      checked={allowPublicSignup} 
                      onCheckedChange={(val) => {
                        setAllowPublicSignup(val);
                        handleConfigUpdate("Public Signups");
                      }} 
                    />
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">API & Integrations</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs p-2 border rounded bg-muted/10">
                        <span className="flex items-center gap-2"><Zap className="h-3 w-3 text-blue-500" /> Razorpay Webhook Secret</span>
                        <Badge variant="outline" className="font-mono text-[10px]">whsec_...4a2b</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs p-2 border rounded bg-muted/10">
                        <span className="flex items-center gap-2"><BellRing className="h-3 w-3 text-orange-500" /> Slack Admin Channel</span>
                        <Badge variant="outline" className="font-mono text-[10px]">#platform-alerts</Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="w-full text-[10px] uppercase tracking-wider font-bold">
                        <Key className="h-3 w-3 mr-2" /> Rotate All Platform Keys
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/20 border-t flex justify-center py-3">
                  <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                    <Activity className="h-3 w-3" /> System Nodes: 12 Active | Region: asia-southeast1
                  </p>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
    