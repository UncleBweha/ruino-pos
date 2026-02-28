import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useCasuals } from '@/hooks/useCasuals';
import { supabase } from '@/integrations/supabase/client';
import { User, Lock, Loader2, Eye, EyeOff, UserCheck, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/constants';

export default function ProfilePage() {
  const { profile, role } = useAuth();
  const { toast } = useToast();
  const { activeCasuals, loading: casualsLoading } = useCasuals();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'New passwords do not match',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Password Updated',
        description: 'Your password has been changed successfully',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Profile Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Name</Label>
                <p className="text-lg font-medium">{profile?.full_name || 'N/A'}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Role</Label>
                <span className="inline-block text-sm font-medium capitalize px-3 py-1 rounded-full bg-primary/10 text-primary">
                  {role || 'No role'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change Password
              </CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      minLength={6}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      minLength={6}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Active Casuals Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Active Casuals
            </CardTitle>
            <CardDescription>Workers available for sales attribution</CardDescription>
          </CardHeader>
          <CardContent>
            {casualsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : activeCasuals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No active casuals</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeCasuals.map((casual) => (
                  <div
                    key={casual.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{casual.full_name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {casual.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {casual.phone}
                          </span>
                        )}
                        <span>
                          {casual.commission_type === 'percentage'
                            ? `${casual.commission_rate}%`
                            : `${formatCurrency(casual.commission_rate)}/item`}
                        </span>
                      </div>
                    </div>
                    <Badge variant="default" className="text-2xs rounded-full">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
