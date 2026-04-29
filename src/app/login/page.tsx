'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

// ShadCN UI components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Lucide Icons
import {
  LogIn,
  BookOpen,
  UserRound,
  Lock,
  BatteryCharging,
  Thermometer,
  Repeat,
  Gauge,
  Phone,
  ArrowRight,
  Smartphone
} from 'lucide-react';
import Link from 'next/link';

export default function ModernLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [isRiderLogin, setIsRiderLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithAdmin, login, loginWithPhone, verifyOTP } = useAuth();
  const router = useRouter();
  const { toast: toastFn } = useToast();
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // --- Rider Phone Login Logic ---
    if (isRiderLogin) {
      if (!showOTP) {
        // Send OTP
        try {
          if (!phoneNumber.startsWith('+')) {
            toastFn({ variant: 'destructive', title: 'Invalid Phone Number', description: 'Please include country code (e.g., +91)' });
            setIsLoading(false);
            return;
          }
          await loginWithPhone(phoneNumber, 'recaptcha-container');
          setShowOTP(true);
          toastFn({ title: 'OTP Sent', description: 'Check your mobile for the verification code.' });
        } catch (error: any) {
          console.error("Phone login failed:", error);
          toastFn({ variant: 'destructive', title: 'Login Failed', description: error.message || 'Failed to send OTP.' });
        } finally {
          setIsLoading(false);
        }
      } else {
        // Verify OTP
        try {
          await verifyOTP(otp);
          toastFn({ title: 'Login Successful', description: 'Welcome back, Rider!' });
          router.push('/scan');
        } catch (error: any) {
          console.error("OTP verification failed:", error);
          toastFn({ variant: 'destructive', title: 'Verification Failed', description: 'Invalid OTP. Please try again.' });
        } finally {
          setIsLoading(false);
        }
      }
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    // ... rest of email logic ...
    if (normalizedEmail === 'admin1eb@gmail.com') {
      try {
        await loginWithAdmin(email, password);
        toastFn({ title: 'Login Successful', description: 'Welcome back, Admin!' });
        router.push('/');
        return;
      } catch (error) {
        console.error("Admin login failed:", error);
        toastFn({
          variant: 'destructive',
          title: 'Login Failed',
          description: 'Invalid admin credentials. Please check your password.'
        });
        setIsLoading(false);
        return;
      }
    }

    try {
      await login(email, password);
      toastFn({ title: 'Login Successful', description: 'Welcome back!' });
      router.push('/');
    } catch (error: any) {
      console.error("User login failed:", error);
      toastFn({
        variant: 'destructive',
        title: 'Login Failed',
        description: 'Invalid email or password. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
    // --- End Authentication Logic ---
  };

  const circumference = 2 * Math.PI * 120; // 2 * pi * radius
  const percentage = 85;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;


  return (
    // Main Container: Fixed height, no overflow
    <div className="flex w-full h-screen overflow-hidden bg-white dark:bg-gray-950">

      {/* LEFT SIDE: Simulated Battery Health Dashboard (Height fixed) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-[#1A1F36] dark:bg-gray-900 text-white p-12 relative h-full">
        {/* Top Header */}
        <div className="mb-16">
          <h1 className="text-3xl font-bold mb-2">BatteryVIEW</h1>
          <p className="text-gray-400 text-base">Real-time Performance & Insights.</p>
        </div>

        {/* Central Battery Status */}
        <div className="flex-grow flex items-center justify-center relative">
          <div className="flex flex-col items-center">
            {/* RING */}
            <div className="relative w-[260px] h-[260px] flex justify-center items-center">
              <svg width="260" height="260" className="-rotate-90">
                <circle
                  stroke="#334155"
                  strokeWidth="16"
                  fill="transparent"
                  r="120"
                  cx="130"
                  cy="130"
                />
                <circle
                  stroke="#4ade80"
                  strokeWidth="16"
                  strokeLinecap="round"
                  fill="transparent"
                  r="120"
                  cx="130"
                  cy="130"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: strokeDashoffset,
                    transition: 'stroke-dashoffset 0.5s',
                  }}
                />
              </svg>

              {/* CENTER TEXT */}
              <div className="absolute text-center flex flex-col items-center">
                <BatteryCharging className="w-20 h-20 text-[#4ade80]" />
                <span className="text-5xl font-extrabold text-white">{percentage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status Cards */}
        <div className="grid grid-cols-3 gap-6 mt-9">
          <div className="flex flex-col items-center bg-[#282D46] p-4 rounded-lg">
            <Thermometer className="w-8 h-8 text-[#2ECC71] mb-2" />
            <span className="text-lg font-semibold">35°C</span>
            <p className="text-sm text-gray-400">Temperature</p>
          </div>
          <div className="flex flex-col items-center bg-[#282D46] p-4 rounded-lg">
            <Repeat className="w-8 h-8 text-[#2ECC71] mb-2" />
            <span className="text-lg font-semibold">450/1000</span>
            <p className="text-sm text-gray-400">Cycle Count</p>
          </div>
          <div className="flex flex-col items-center bg-[#282D46] p-4 rounded-lg">
            <Gauge className="w-8 h-8 text-[#2ECC71] mb-2" />
            <span className="text-lg font-semibold">15%</span>
            <p className="text-sm text-gray-400">Capacity Loss</p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Login Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 
                      bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 h-full">

        <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-[2rem] shadow-xl transition-all duration-300 border border-gray-200 dark:border-gray-700 p-8 
                      max-h-[90vh] overflow-y-auto">

          <div className="text-center pt-2 pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 mb-1">
              Welcome Back!
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Sign in to access your dashboard.
            </p>
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl mb-6">
            <button
              onClick={() => { setIsRiderLogin(false); setShowOTP(false); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isRiderLogin ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600' : 'text-gray-500'}`}
            >
              Company
            </button>
            <button
              onClick={() => setIsRiderLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isRiderLogin ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600' : 'text-gray-500'}`}
            >
              Rider
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {!isRiderLogin ? (
              <>
                {/* Email Input */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </Label>
                  <div className="relative">
                    <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="pl-10 h-11 rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400 dark:bg-gray-50 dark:text-gray-900 text-gray-900"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="pl-10 h-11 rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400 dark:bg-gray-50 dark:text-gray-900 text-gray-900"
                    />
                  </div>
                  <Link href="/forgot-password" disabled={isLoading} className="block text-sm text-right text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors mt-1">
                    Forgot password?
                  </Link>
                </div>
              </>
            ) : (
              <>
                {/* Phone Input */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mobile Number
                  </Label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 XXXXX XXXXX"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={isLoading || showOTP}
                      className="pl-10 h-11 rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400 dark:bg-gray-50 dark:text-gray-900 text-gray-900"
                    />
                  </div>
                </div>

                {showOTP && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Label htmlFor="otp" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Verification Code
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                      <Input
                        id="otp"
                        type="text"
                        placeholder="6-digit code"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        disabled={isLoading}
                        className="pl-10 h-11 rounded-lg border-gray-300 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-indigo-400 dark:bg-gray-50 dark:text-gray-900 text-gray-900 text-center tracking-[0.5em] font-bold"
                        maxLength={6}
                      />
                    </div>
                  </div>
                )}
                
                <div id="recaptcha-container"></div>
              </>
            )}

            {/* Log In Button */}
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (isRiderLogin && !showOTP ? 'Sending OTP...' : 'Verifying...') : (
                <>
                  <LogIn className="mr-2 h-4 w-4" /> 
                  {isRiderLogin ? (showOTP ? 'Verify & Login' : 'Send OTP') : 'Log In'} 
                </>
              )}
            </Button>

            {/* Guide Button */}
            <Button
              asChild
              variant="outline"
              className="w-full h-11 rounded-lg border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
            >
              <Link href="/guide">
                <BookOpen className="mr-2 h-4 w-4" />
                Guide
              </Link>
            </Button>

            <p className="text-sm text-center text-gray-600 dark:text-gray-400 mt-2">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="underline font-semibold text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors">
                Sign Up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
