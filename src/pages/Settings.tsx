import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Settings as SettingsIcon,
  Receipt,
  Users,
  Loader2,
  Plus,
  Trash2,
  Key,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Profile } from '@/types/database';

interface UserWithRole extends Profile {
  role?: 'admin' | 'cashier';
}

export default function SettingsPage() {
  const { receiptSettings, loading, updateReceiptSettings } = useSettings();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const [receiptForm, setReceiptForm] = useState({
    company_name: '',
    phone: '',
    email: '',
    address: '',
    tax_pin: '',
    logo_url: '',
    footer_text: '',
  });
  const [receiptSaving, setReceiptSaving] = useState(false);

  // Cashier management
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'cashier' as 'admin' | 'cashier',
  });
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    if (receiptSettings) {
      setReceiptForm({
        company_name: receiptSettings.company_name || '',
        phone: receiptSettings.phone || '',
        email: receiptSettings.email || '',
        address: receiptSettings.address || '',
        tax_pin: receiptSettings.tax_pin || '',
        logo_url: receiptSettings.logo_url || '',
        footer_text: receiptSettings.footer_text || '',
      });
    }
  }, [receiptSettings]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch roles for each user
      const usersWithRoles: UserWithRole[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.user_id)
            .maybeSingle();

          return {
            ...profile,
            role: roleData?.role as 'admin' | 'cashier' | undefined,
          };
        })
      );

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleSaveReceipt(e: React.FormEvent) {
    e.preventDefault();
    setReceiptSaving(true);

    try {
      await updateReceiptSettings(receiptForm);
      toast({
        title: 'Settings Saved',
        description: 'Receipt settings have been updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setReceiptSaving(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddingUser(true);

    try {
      // Create user via signup
      const { data, error } = await supabase.auth.signUp({
        email: newUserForm.email,
        password: newUserForm.password,
        options: {
          data: { full_name: newUserForm.full_name },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Add role
        await supabase.from('user_roles').insert({
          user_id: data.user.id,
          role: newUserForm.role,
        });
      }

      toast({
        title: 'User Created',
        description: `${newUserForm.full_name} has been added as ${newUserForm.role}`,
      });

      setShowAddUser(false);
      setNewUserForm({ email: '', password: '', full_name: '', role: 'cashier' });
      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create user',
        variant: 'destructive',
      });
    } finally {
      setAddingUser(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      // Call the edge function to delete the user
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) throw error;

      toast({
        title: 'User Deleted',
        description: 'The user has been removed from the system',
      });

      fetchUsers();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your POS configuration</p>
        </div>

        <Tabs defaultValue="receipt" className="space-y-6">
          <TabsList>
            <TabsTrigger value="receipt" className="gap-2">
              <Receipt className="w-4 h-4" />
              Receipt
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="users" className="gap-2">
                <Users className="w-4 h-4" />
                Users
              </TabsTrigger>
            )}
          </TabsList>

          {/* Receipt Settings */}
          <TabsContent value="receipt">
            <Card>
              <CardHeader>
                <CardTitle>Receipt Settings</CardTitle>
                <CardDescription>
                  Customize the information displayed on receipts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <form onSubmit={handleSaveReceipt} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                          value={receiptForm.company_name}
                          onChange={(e) =>
                            setReceiptForm({ ...receiptForm, company_name: e.target.value })
                          }
                          placeholder="Your Business Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          value={receiptForm.phone}
                          onChange={(e) =>
                            setReceiptForm({ ...receiptForm, phone: e.target.value })
                          }
                          placeholder="+254 700 000 000"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={receiptForm.email}
                          onChange={(e) =>
                            setReceiptForm({ ...receiptForm, email: e.target.value })
                          }
                          placeholder="shop@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tax PIN</Label>
                        <Input
                          value={receiptForm.tax_pin}
                          onChange={(e) =>
                            setReceiptForm({ ...receiptForm, tax_pin: e.target.value })
                          }
                          placeholder="P000000000X"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Address</Label>
                      <Input
                        value={receiptForm.address}
                        onChange={(e) =>
                          setReceiptForm({ ...receiptForm, address: e.target.value })
                        }
                        placeholder="Your Business Address"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Logo URL</Label>
                      <Input
                        value={receiptForm.logo_url}
                        onChange={(e) =>
                          setReceiptForm({ ...receiptForm, logo_url: e.target.value })
                        }
                        placeholder="https://example.com/logo.png"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Receipt Footer</Label>
                      <Textarea
                        value={receiptForm.footer_text}
                        onChange={(e) =>
                          setReceiptForm({ ...receiptForm, footer_text: e.target.value })
                        }
                        placeholder="Thank you for shopping with us!"
                        rows={3}
                      />
                    </div>

                    <Button type="submit" disabled={receiptSaving}>
                      {receiptSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Settings
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Management */}
          {isAdmin && (
            <TabsContent value="users">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage cashiers and admins</CardDescription>
                  </div>
                  <Button onClick={() => setShowAddUser(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {users.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="font-medium">{u.full_name}</p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium capitalize px-3 py-1 rounded-full bg-primary/10 text-primary">
                              {u.role || 'No role'}
                            </span>
                            {u.user_id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteUser(u.user_id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={newUserForm.full_name}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, full_name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, email: e.target.value })
                }
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newUserForm.password}
                onChange={(e) =>
                  setNewUserForm({ ...newUserForm, password: e.target.value })
                }
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(v) =>
                  setNewUserForm({ ...newUserForm, role: v as 'admin' | 'cashier' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashier">Cashier</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddUser(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addingUser}>
                {addingUser ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Create User'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
