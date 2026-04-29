
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db, ref, set, get, remove } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth as secondaryAuth } from '@/lib/firebase-secondary'; // Secondary auth instance

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UserPlus, Users, Trash2, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface SubUser {
    uid: string;
    email: string;
    role: 'sub_user';
    permissions: {
        canRegisterBms: boolean;
        canAddGateway: boolean;
        canViewHistory: boolean;
    }
}

export default function ManageUsersPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const [permissions, setPermissions] = useState({
    canRegisterBms: false,
    canAddGateway: false,
    canViewHistory: false,
  });
  const [userToDelete, setUserToDelete] = useState<SubUser | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || (userProfile && userProfile.role !== 'main_user')) {
      toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission to manage users.' });
      router.push('/');
    }
  }, [user, userProfile, loading, router, toast]);

  const fetchSubUsers = async () => {
    if (!user || !db) return;
    setIsFetchingUsers(true);
    try {
        const subUsersRef = ref(db, `users/${user.uid}/sub_users`);
        const snapshot = await get(subUsersRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            setSubUsers(Object.values(data));
        } else {
            setSubUsers([]);
        }
    } catch (error) {
        console.error("Failed to fetch sub-users:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load sub-users.' });
    } finally {
        setIsFetchingUsers(false);
    }
  };

  useEffect(() => {
    if (user) {
        fetchSubUsers();
    }
  }, [user, toast]);

  const handlePermissionChange = (permission: keyof typeof permissions) => {
    setPermissions(prev => ({ ...prev, [permission]: !prev[permission] }));
  }

  const handleAddSubUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !secondaryAuth) return;
    setIsLoading(true);

    try {
        // Create user in the secondary auth instance
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newSubUser = userCredential.user;

        const subUserUID = newSubUser.uid;

        const subUserData = {
            uid: subUserUID,
            email: email,
            role: 'sub_user' as const,
            permissions: permissions,
        };

        // Store sub-user info under main user's node
        const subUserRef = ref(db, `users/${user.uid}/sub_users/${subUserUID}`);
        await set(subUserRef, subUserData);
        
        // Store main user's UID and permissions in sub-user's own user record
        const newUserRef = ref(db, `users/${subUserUID}`);
        await set(newUserRef, {
            email: email,
            role: 'sub_user',
            main_user_uid: user.uid,
            permissions: permissions,
        });

        setSubUsers(prev => [...prev, subUserData]);
        toast({ title: 'Sub-user Created', description: `${email} has been added as a sub-user.` });
        setEmail('');
        setPassword('');
        setPermissions({ canRegisterBms: false, canAddGateway: false, canViewHistory: false });
    } catch (error: any) {
      let description = 'An unexpected error occurred.';
      if (error.code === 'auth/email-already-in-use') {
          description = 'This email is already in use by another account.';
      } else if (error.code === 'auth/weak-password') {
          description = 'The password is too weak. Please use at least 6 characters.';
      }
       toast({ variant: 'destructive', title: 'Creation Failed', description });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSubUser = async () => {
    if (!user || !db || !userToDelete) return;
    
    setIsLoading(true);
    try {
        // Remove sub-user from main user's list
        const mainUserSubUserRef = ref(db, `users/${user.uid}/sub_users/${userToDelete.uid}`);
        await remove(mainUserSubUserRef);

        // Remove the sub-user's own user data node
        const subUserNodeRef = ref(db, `users/${userToDelete.uid}`);
        await remove(subUserNodeRef);

        toast({
            title: 'Sub-user Deleted',
            description: `${userToDelete.email} has been removed from your account.`,
        });

        // Refresh the list
        await fetchSubUsers();

    } catch (error: any) {
        console.error("Failed to delete sub-user:", error);
        toast({
            variant: 'destructive',
            title: 'Deletion Failed',
            description: 'Could not remove the sub-user. Please try again.',
        });
    } finally {
        setIsLoading(false);
        setUserToDelete(null);
    }
  };

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
              Manage Sub-Users
            </h1>
          </div>
        </div>
      </header>
       <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><UserPlus className="mr-2 h-6 w-6 text-primary"/>Add New Sub-User</CardTitle>
                    <CardDescription>Create a new sub-user account and assign permissions.</CardDescription>
                </CardHeader>
                <form onSubmit={handleAddSubUser}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Sub-User Email</Label>
                            <Input id="email" type="email" placeholder="sub.user@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Temporary Password</Label>
                            <Input id="password" type="password" placeholder="Min. 6 characters" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
                        </div>
                         <div className="space-y-3">
                            <Label className="font-medium flex items-center"><ShieldCheck className="mr-2 h-4 w-4 text-primary" />Page Permissions</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="perm-add-gateway" checked={permissions.canAddGateway} onCheckedChange={() => handlePermissionChange('canAddGateway')} />
                                <Label htmlFor="perm-add-gateway" className="text-sm font-normal">Allow adding gateway devices</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="perm-register-bms" checked={permissions.canRegisterBms} onCheckedChange={() => handlePermissionChange('canRegisterBms')} />
                                <Label htmlFor="perm-register-bms" className="text-sm font-normal">Allow registering BMS devices</Label>
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="perm-view-history" checked={permissions.canViewHistory} onCheckedChange={() => handlePermissionChange('canViewHistory')} />
                                <Label htmlFor="perm-view-history" className="text-sm font-normal">Allow viewing device history</Label>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Creating...' : 'Create Sub-User'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center"><Users className="mr-2 h-6 w-6 text-primary"/>Existing Sub-Users</CardTitle>
                    <CardDescription>The list of sub-users linked to your account.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isFetchingUsers ? (
                        <div className="space-y-2">
                           <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
                           <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
                        </div>
                    ) : subUsers.length > 0 ? (
                        <div className="space-y-3">
                           {subUsers.map(su => (
                            <div key={su.uid} className="flex flex-col p-3 bg-muted/50 rounded-md border">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium">{su.email}</span>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" disabled={isLoading} onClick={() => setUserToDelete(su)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure you want to delete this user?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently delete the sub-user <strong>{userToDelete?.email}</strong> and revoke their access. This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteSubUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                                <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
                                    <span>Gateway: {su.permissions?.canAddGateway ? '✅' : '❌'}</span>
                                    <span>BMS: {su.permissions?.canRegisterBms ? '✅' : '❌'}</span>
                                    <span>History: {su.permissions?.canViewHistory ? '✅' : '❌'}</span>
                                </div>
                            </div>
                           ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No sub-users have been created yet.</p>
                    )}
                </CardContent>
            </Card>
          </div>
       </main>
    </div>
  );
}
    

    