import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, LogIn, Eye, EyeOff, ShoppingCart } from 'lucide-react';
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

  useEffect(() => {
    async function fetchUsers() {
      try {
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
    <div className="min-h-screen flex items-center justify-center bg-warm-gradient p-4 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bento-card !p-0 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-8 pb-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-foreground flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">Ruinu General Merchants</h1>
          <p className="text-muted-foreground text-sm mt-1">Point of Sale System</p>
        </div>

        <div className="p-8 pt-4">
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
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
                <Label className="text-sm font-semibold">Role</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(value) => handleRoleChange(value as 'admin' | 'cashier')}
                  className="flex gap-3"
                >
                  <label
                    htmlFor="cashier"
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all press-effect ${
                      role === 'cashier' ? 'border-foreground bg-foreground/5' : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <RadioGroupItem value="cashier" id="cashier" />
                    <span className="font-medium text-sm">Cashier</span>
                  </label>
                  <label
                    htmlFor="admin"
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all press-effect ${
                      role === 'admin' ? 'border-foreground bg-foreground/5' : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <RadioGroupItem value="admin" id="admin" />
                    <span className="font-medium text-sm">Admin</span>
                  </label>
                </RadioGroup>
              </div>

              {/* User Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  {role === 'admin' ? 'Select Admin' : 'Select Cashier'}
                </Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-border/50">
                    <SelectValue placeholder={currentUsers.length === 0 ? `No ${role}s available` : `Choose a ${role}...`} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {currentUsers.map((user) => (
                      <SelectItem key={user.user_id} value={user.email!} className="rounded-lg">
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-10 rounded-xl bg-muted/30 border-border/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Sign In */}
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl press-effect bg-foreground text-background hover:bg-foreground/90"
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
        </div>
      </div>
    </div>
  );
}