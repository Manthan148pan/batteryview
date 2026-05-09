
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Users,
  History,
  PlusCircle,
  LogOut,
  ListPlus,
  Users2,
  Globe,
  Database,
  HelpCircle,
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  Zap,
  Moon,
  QrCode,
  Wand2,
  CreditCard,
  LayoutDashboard,
  BarChart3,
  LayoutGrid,
  Server,
  ChevronRight,
  Menu,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import type { ClaimedDevice } from '@/types/bms';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onSettingsClick: () => void;
  onStartTourClick: () => void;
  claimedDevices: ClaimedDevice[];
  devicesLoading: boolean;
  activeGateway: string | null;
  setActiveGateway: (deviceId: string | null) => void;
  activeGatewayIds: Set<string>;
  alertsCount?: number;
}

interface WeatherData {
  temperature: number;
  weathercode: number;
  is_day: number;
}

const weatherIcons: { [key: number]: React.ElementType } = {
  0: Sun, 1: Sun, 2: Cloud, 3: Cloud, 45: Cloud, 46: Cloud,
  51: CloudRain, 53: CloudRain, 55: CloudRain, 61: CloudRain,
  63: CloudRain, 65: CloudRain, 71: Snowflake, 73: Snowflake,
  75: Snowflake, 80: CloudRain, 81: CloudRain, 82: CloudRain, 95: Zap,
};

const PRIMARY_NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid, exact: true },
  { href: '/history', label: 'History', icon: History, exact: false },
];

const MOBILE_NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/history', label: 'History', icon: History },
  { href: '/scan', label: 'Scan', icon: QrCode },
];

// ── Sidebar link row ────────────────────────────────────────────────────────
function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link href={href} onClick={onClick}>
      <div
        className={cn(
          'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <span className="flex items-center gap-3">
          <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
          {label}
        </span>
        <ChevronRight className={cn('h-3.5 w-3.5 opacity-0 group-hover:opacity-50 transition-opacity', active && 'opacity-50')} />
      </div>
    </Link>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function Header({
  onSettingsClick,
  onStartTourClick,
  claimedDevices,
  devicesLoading,
  activeGateway,
  setActiveGateway,
  activeGatewayIds,
  alertsCount = 0,
}: HeaderProps) {
  const logo = PlaceHolderImages.find((img) => img.id === 'logo');
  const { user, userProfile, logout, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    const fetchWeather = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async ({ coords }) => {
            try {
              const res = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weather_code,is_day`
              );
              const data = await res.json();
              if (data.current) {
                setWeatherData({
                  temperature: Math.round(data.current.temperature_2m),
                  weathercode: data.current.weather_code,
                  is_day: data.current.is_day,
                });
              }
            } catch { /* silent */ }
          },
          () => setWeatherData({ temperature: 25, weathercode: 1, is_day: 1 })
        );
      }
    };
    updateDateTime();
    fetchWeather();
    const t1 = setInterval(updateDateTime, 60000);
    const t2 = setInterval(fetchWeather, 600000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const handleLogout = async () => {
    setSidebarOpen(false);
    await logout();
    router.push('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  const isMainUser = userProfile?.role === 'main_user';
  const isSubUser = userProfile?.role === 'sub_user';

  const WeatherIcon = weatherData
    ? weatherData.is_day === 0 && weatherData.weathercode === 0
      ? Moon
      : weatherIcons[weatherData.weathercode] || Sun
    : null;

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const PulseDot = ({ active }: { active: boolean }) =>
    active ? (
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
    ) : (
      <span className="relative inline-flex rounded-full h-2 w-2 bg-muted-foreground/30" />
    );

  const renderSelectedGateway = () => {
    if (activeGateway === 'all')
      return (
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-sm">All Gateways</span>
        </div>
      );
    const dev = claimedDevices.find((d) => d.id === activeGateway);
    if (dev)
      return (
        <div className="flex items-center gap-2 min-w-0">
          <PulseDot active={activeGatewayIds.has(dev.id)} />
          <span className="truncate text-sm">
            {dev.assigned_name}{dev.scooter_no ? ` [${dev.scooter_no}]` : ''}
          </span>
        </div>
      );
    return <span className="text-muted-foreground text-sm">Select gateway…</span>;
  };

  const initials = userProfile?.fullName
    ? userProfile.fullName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <>
      {/* ── TOP HEADER ──────────────────────────────────────────────────── */}
      <header className="bg-card border-b sticky top-0 z-50 shadow-sm transition-all duration-300">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 h-20 md:h-26">

          {/* LEFT: Logo */}
          <div className="flex items-center gap-2 shrink-0">
            {logo && (
              <Link href="/" passHref>
                <Image
                  src={logo.imageUrl}
                  alt={logo.description}
                  width={250}
                  height={70}
                  priority
                  className="cursor-pointer w-auto h-16 md:h-20 object-contain"
                  data-ai-hint={logo.imageHint}
                />
              </Link>
            )}
          </div>

          {/* CENTER: Primary Nav (desktop) */}
          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {PRIMARY_NAV.map(({ href, label, icon: Icon, exact }) => (
                <Link key={href} href={href}>
                  <Button
                    variant="ghost"
                    size="default"
                    className={cn(
                      'gap-2 px-4 text-sm text-muted-foreground font-medium transition-all',
                      isActive(href, exact) && 'text-primary bg-primary/10 font-semibold'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Button>
                </Link>
              ))}
            </nav>
          )}

          {/* RIGHT: Gateway + Weather + Avatar (Sheet trigger) */}
          {user && (
            <div className="flex items-center gap-2">

              {/* Gateway Selector */}
              <div id="gateway-selector" className="hidden md:flex flex-1 md:flex-none">
                <Select
                  value={activeGateway || ''}
                  onValueChange={setActiveGateway}
                  disabled={devicesLoading || claimedDevices.length === 0}
                >
                  <SelectTrigger className="h-9 gap-2 border-dashed text-sm w-full md:w-[220px]">
                    <Server className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue className="truncate">{renderSelectedGateway()}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {devicesLoading ? (
                      <SelectItem value="loading" disabled>Loading…</SelectItem>
                    ) : claimedDevices.length > 0 ? (
                      <>
                        {claimedDevices.length > 1 && (
                          <SelectItem value="all">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-primary" />
                              <span>All Gateways</span>
                            </div>
                          </SelectItem>
                        )}
                        {claimedDevices.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            <div className="flex items-center gap-2">
                              <PulseDot active={activeGatewayIds.has(d.id)} />
                              <span>
                                {d.assigned_name}
                                {d.scooter_no ? ` [${d.scooter_no}]` : ''}{' '}
                                <span className="text-muted-foreground text-xs">({d.location})</span>
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    ) : (
                      <SelectItem value="no-devices" disabled>No gateways linked</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Weather pill */}
              {weatherData && WeatherIcon && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-muted/40 text-sm font-semibold cursor-default select-none">
                        <WeatherIcon className="h-4 w-4 text-primary" />
                        <span>{weatherData.temperature}°C</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-xs">{currentDate} · {currentTime}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* ── NOTIFICATIONS BELL ─────────────────────────────────── */}
              <div className="relative">
                <Link href="/alerts" passHref>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full h-10 w-10 md:h-12 md:w-12 hover:bg-muted"
                  >
                    <Bell className={cn(
                      "h-6 w-6 md:h-7 md:w-7 transition-colors", 
                      alertsCount > 0 ? "text-destructive" : "text-muted-foreground"
                    )} />
                    {alertsCount > 0 && (
                      <span className="absolute top-2 right-2 flex h-3.5 w-3.5">
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-destructive text-[8px] font-bold text-white items-center justify-center">
                          {alertsCount}
                        </span>
                      </span>
                    )}
                  </Button>
                </Link>
              </div>

              {/* ── USER PROFILE & MENU ──────────────────────────────────── */}
              {/* User Avatar - Always Visible */}
              <Link href="/users">
                <Avatar className="h-10 w-10 md:h-13 md:w-13 cursor-pointer">
                  <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Link>

              {/* Sidebar Menu Trigger (Hamburger) */}
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-primary/10 transition-colors h-12 w-12 md:h-14 md:w-14"
                    aria-label="Open navigation menu"
                  >
                    <Menu className="h-7 w-7 md:h-8 md:h-8 text-foreground" />
                  </Button>
                </SheetTrigger>

                {/* Sidebar Panel */}
                <SheetContent
                  side="right"
                  className="w-72 sm:w-80 p-0 flex flex-col gap-0 overflow-y-auto"
                >
                  {/* Required by Radix for screen reader accessibility */}
                  <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                  <SheetDescription className="sr-only">
                    Access platform navigation, account settings, and administration tools.
                  </SheetDescription>
                  {/* ── Profile header ── */}
                  <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b px-5 py-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-base truncate">
                          {userProfile?.fullName || 'User'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {isAdmin && (
                            <Badge className="text-[10px] h-4 bg-primary/20 text-primary border-0 font-semibold">
                              Admin
                            </Badge>
                          )}
                          {isMainUser && (
                            <Badge variant="outline" className="text-[10px] h-4 font-medium">
                              Main User
                            </Badge>
                          )}
                          {isSubUser && (
                            <Badge variant="outline" className="text-[10px] h-4 font-medium">
                              Rider
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Date / Weather row */}
                    {weatherData && WeatherIcon && (
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground bg-background/60 rounded-lg px-3 py-2">
                        <span>{currentDate}</span>
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <WeatherIcon className="h-3.5 w-3.5 text-primary" />
                          {weatherData.temperature}°C
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Nav sections ── */}
                  <div className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">

                    {/* Navigation */}
                    <SidebarSection title="Navigation">
                      {PRIMARY_NAV.map(({ href, label, icon: Icon, exact }) => (
                        <SidebarLink
                          key={href}
                          href={href}
                          icon={Icon}
                          label={label}
                          active={isActive(href, exact)}
                          onClick={closeSidebar}
                        />
                      ))}
                      <SidebarLink href="/scan" icon={QrCode} label="Scan QR" active={pathname === '/scan'} onClick={closeSidebar} />
                    </SidebarSection>

                    <Separator />

                    {/* Admin Panel */}
                    {isAdmin && (
                      <>
                        <SidebarSection title="Admin Panel">
                          <SidebarLink href="/admin/saas" icon={LayoutDashboard} label="SaaS Dashboard" active={pathname.startsWith('/admin/saas')} onClick={closeSidebar} />
                          <SidebarLink href="/admin/database" icon={Database} label="Database Viewer" active={pathname.startsWith('/admin/database')} onClick={closeSidebar} />
                          <SidebarLink href="/admin/data-converter" icon={Wand2} label="Data Converter" active={pathname.startsWith('/admin/data-converter')} onClick={closeSidebar} />
                        </SidebarSection>
                        <Separator />
                      </>
                    )}

                    {/* Account */}
                    {isMainUser && (
                      <>
                        <SidebarSection title="Account">
                          <SidebarLink href="/billing" icon={CreditCard} label="Subscription" active={pathname === '/billing'} onClick={closeSidebar} />
                          <SidebarLink href="/manage-users" icon={Users2} label="Manage Sub-Users" active={pathname === '/manage-users'} onClick={closeSidebar} />
                          <SidebarLink href="/users" icon={Users} label="User Info" active={pathname === '/users'} onClick={closeSidebar} />
                        </SidebarSection>
                        <Separator />

                        <SidebarSection title="Actions">
                          <SidebarLink href="/add-gateway" icon={PlusCircle} label="Add Gateway" active={pathname === '/add-gateway'} onClick={closeSidebar} />
                          <SidebarLink href="/register-bms" icon={ListPlus} label="Register BMS" active={pathname === '/register-bms'} onClick={closeSidebar} />
                        </SidebarSection>
                        <Separator />
                      </>
                    )}

                    {/* Help */}
                    <SidebarSection title="Help">
                      <button
                        onClick={() => { onSettingsClick(); closeSidebar(); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all group"
                      >
                        <span className="flex items-center gap-3">
                          <Settings className="h-4 w-4" />
                          Settings
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                      </button>
                      <button
                        onClick={() => { onStartTourClick(); closeSidebar(); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all group"
                      >
                        <span className="flex items-center gap-3">
                          <HelpCircle className="h-4 w-4" />
                          Start Tour
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
                      </button>
                    </SidebarSection>
                  </div>

                  {/* ── Logout footer ── */}
                  <div className="border-t px-3 py-4">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </header>

      {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────────── */}
      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-3 h-16 max-w-md mx-auto">
            {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'group flex flex-col items-center justify-center transition-all duration-300 relative',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className={cn(
                    'p-1.5 rounded-2xl transition-all relative z-10',
                    active ? 'bg-primary/20 scale-110' : 'group-active:scale-90'
                  )}>
                    <Icon className={cn("h-5 w-5", active && "animate-in zoom-in-50 duration-300")} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold mt-1 transition-all",
                    active ? "opacity-100 translate-y-0" : "opacity-70"
                  )}>{label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full mb-1 animate-in fade-in duration-500" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
