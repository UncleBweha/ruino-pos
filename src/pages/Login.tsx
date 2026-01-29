import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Store, Loader2, Shield, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PRECONFIGURED_USERS, DEFAULT_PASSWORD, PreConfiguredUser } from '@/lib/users';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  async function handleLogin(user: PreConfiguredUser) {
    setLoading(user.email);

    try {
      // Try to sign in first
      let { error } = await signIn(user.email, DEFAULT_PASSWORD);
      
      // If user doesn't exist, create them
      if (error?.message?.includes('Invalid login credentials')) {
        const signUpResult = await signUp(user.email, DEFAULT_PASSWORD, user.name, user.role);
        if (signUpResult.error) {
          throw signUpResult.error;
        }
        // Sign in after signup
        const signInResult = await signIn(user.email, DEFAULT_PASSWORD);
        if (signInResult.error) {
          throw signInResult.error;
        }
      } else if (error) {
        throw error;
      }

      toast({
        title: `Welcome, ${user.name}!`,
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
      setLoading(null);
    }
  }

  const admins = PRECONFIGURED_USERS.filter(u => u.role === 'admin');
  const cashiers = PRECONFIGURED_USERS.filter(u => u.role === 'cashier');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg animate-scale-in">
        <CardHeader className="text-center pb-2">
          <div className="w-20 h-20 rounded-2xl bg-primary mx-auto mb-4 flex items-center justify-center">
            <Store className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Ruino General Merchants</CardTitle>
          <CardDescription>Tap your name to sign in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Admins Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Administrators</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {admins.map((user) => (
                <Button
                  key={user.email}
                  variant="outline"
                  className={cn(
                    "h-20 flex-col gap-2 border-2 hover:border-primary hover:bg-primary/5 transition-all",
                    loading === user.email && "border-primary bg-primary/10"
                  )}
                  onClick={() => handleLogin(user)}
                  disabled={loading !== null}
                >
                  {loading === user.email ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {user.initials}
                      </div>
                      <span className="font-medium">{user.name}</span>
                    </>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Cashiers Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShoppingCart className="w-4 h-4" />
              <span>Cashiers</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {cashiers.map((user) => (
                <Button
                  key={user.email}
                  variant="outline"
                  className={cn(
                    "h-20 flex-col gap-2 border-2 hover:border-accent hover:bg-accent/5 transition-all",
                    loading === user.email && "border-accent bg-accent/10"
                  )}
                  onClick={() => handleLogin(user)}
                  disabled={loading !== null}
                >
                  {loading === user.email ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-sm">
                        {user.initials}
                      </div>
                      <span className="font-medium">{user.name}</span>
                    </>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
