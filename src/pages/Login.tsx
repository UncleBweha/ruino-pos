import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role?: 'admin' | 'cashier';
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [role, setRole] = useState<'admin' | 'cashier'>('cashier');
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch users from database using security definer function
  useEffect(() => {
    async function fetchUsers() {
      try {
        // Use the get_login_users function which bypasses RLS
        const { data, error } = await supabase.rpc('get_login_users');

        if (error) throw error;

        const usersWithRoles: UserProfile[] = (data || []).map((u: any) => ({
          id: u.user_id,
          user_id: u.user_id,
          full_name: u.full_name,
          email: u.email,
          role: u.role as 'admin' | 'cashier',
        }));

        setUsers(usersWithRoles);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: 'Error',
          description: 'Failed to load users',
          variant: 'destructive',
        });
      } finally {
        setUsersLoading(false);
      }
    }

    fetchUsers();
  }, [toast]);

  const admins = users.filter(u => u.role === 'admin');
  const cashiers = users.filter(u => u.role === 'cashier');
  const currentUsers = role === 'admin' ? admins : cashiers;

  // Reset selected user when role changes
  const handleRoleChange = (newRole: 'admin' | 'cashier') => {
    setRole(newRole);
    setSelectedUser('');
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    
    if (!selectedUser) {
      toast({
        title: 'Select a user',
        description: 'Please select a user to sign in',
        variant: 'destructive',
      });
      return;
    }

    const user = users.find(u => u.email === selectedUser);
    if (!user) return;

    setLoading(true);

    try {
      if (!password) {
        toast({
          title: 'Password required',
          description: 'Please enter your password',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      
      const { error } = await signIn(user.email!, password);
      
      if (error) {
        if (error.message?.includes('Invalid login credentials')) {
          throw new Error('Wrong password. Please try again.');
        }
        throw error;
      }

      toast({
        title: `Welcome, ${user.full_name}!`,
        description: `Logged in as ${user.role}`,
      });
      navigate('/pos');
    } catch (err: any) {
      toast({
        title: 'Login Failed',
        description: err.message || 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 relative overflow-hidden">
      {/* Decorative sparkles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-amber-400/40"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
        {[...Array(20)].map((_, i) => (
          <div
            key={`spark-${i}`}
            className="absolute w-0.5 h-0.5 rounded-full bg-blue-400/30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-2 pt-8">
          <h1 className="text-2xl font-bold text-foreground">Ruinu General Merchants</h1>
          <p className="text-muted-foreground text-sm">Point of Sale System</p>
        </CardHeader>
        
        <CardContent className="space-y-6 px-8 pb-8">
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No users found.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please contact an administrator to set up accounts.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Role Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Role</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(value) => handleRoleChange(value as 'admin' | 'cashier')}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cashier" id="cashier" />
                    <Label htmlFor="cashier" className="font-normal cursor-pointer">
                      Cashier ({cashiers.length})
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="admin" id="admin" />
                    <Label htmlFor="admin" className="font-normal cursor-pointer">
                      Admin ({admins.length})
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* User Selection Dropdown */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {role === 'admin' ? 'Select Admin' : 'Select Cashier'}
                </Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="h-11 bg-background">
                    <SelectValue placeholder={currentUsers.length === 0 ? `No ${role}s available` : `Choose a ${role}...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.email!}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10 bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                disabled={loading || !selectedUser || currentUsers.length === 0}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
