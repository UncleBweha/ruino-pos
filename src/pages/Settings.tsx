import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Receipt,
  Users,
  Loader2,
  Plus,
  Trash2,
  Save,
  UserCheck,
  Building2,
  Upload,
  Image,
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
import { CasualManagement } from '@/components/settings/CasualManagement';
import type { Profile } from '@/types/database';

interface UserWithRole extends Profile {
  role?: 'admin' | 'cashier';
}

export default function SettingsPage() {
  const { receiptSettings, loading, updateReceiptSettings } = useSettings();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [companyForm, setCompanyForm] = useState({
    company_name: '',
    phone: '',
    email: '',
    address: '',
    building: '',
    website: '',
    tax_pin: '',
    logo_url: '',
  });
  const [receiptForm, setReceiptForm] = useState({
    footer_text: '',
  });
  const [companySaving, setCompanySaving] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

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
      setCompanyForm({
        company_name: receiptSettings.company_name || '',
        phone: receiptSettings.phone || '',
        email: receiptSettings.email || '',
        address: receiptSettings.address || '',
        building: (receiptSettings as any).building || '',
        website: (receiptSettings as any).website || '',
        tax_pin: receiptSettings.tax_pin || '',
        logo_url: receiptSettings.logo_url || '',
      });
      setReceiptForm({
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

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setCompanySaving(true);
    try {
      await updateReceiptSettings(companyForm as any);
      toast({ title: 'Company Info Saved', description: 'Company information has been updated' });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save', variant: 'destructive' });
    } finally {
      setCompanySaving(false);
    }
  }

  async function handleSaveReceipt(e: React.FormEvent) {
    e.preventDefault();
    setReceiptSaving(true);
    try {
      await updateReceiptSettings(receiptForm as any);
      toast({ title: 'Settings Saved', description: 'Receipt settings have been updated' });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save settings', variant: 'destructive' });
    } finally {
      setReceiptSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Logo must be under 2MB', variant: 'destructive' });
      return;
    }

    setLogoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `company-logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('invoice-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('invoice-logos')
        .getPublicUrl(fileName);

      const logoUrl = urlData.publicUrl;
      setCompanyForm(prev => ({ ...prev, logo_url: logoUrl }));

      // Save immediately
      await updateReceiptSettings({ logo_url: logoUrl } as any);
      toast({ title: 'Logo Uploaded', description: 'Company logo has been updated' });
    } catch (error) {
      toast({ title: 'Upload Failed', description: error instanceof Error ? error.message : 'Failed to upload logo', variant: 'destructive' });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: newUserForm.email, password: newUserForm.password, full_name: newUserForm.full_name, role: newUserForm.role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'User Created', description: `${newUserForm.full_name} has been added as ${newUserForm.role}` });
      setShowAddUser(false);
      setNewUserForm({ email: '', password: '', full_name: '', role: 'cashier' });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create user', variant: 'destructive' });
    } finally {
      setAddingUser(false);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      const { error } = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (error) throw error;
      toast({ title: 'User Deleted', description: 'The user has been removed from the system' });
      fetchUsers();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete user', variant: 'destructive' });
    }
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your POS configuration</p>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="w-4 h-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="receipt" className="gap-2">
              <Receipt className="w-4 h-4" />
              Receipt
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="users" className="gap-2">
                  <Users className="w-4 h-4" />
                  Users
                </TabsTrigger>
                <TabsTrigger value="casuals" className="gap-2">
                  <UserCheck className="w-4 h-4" />
                  Casuals
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Company Info */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  This information appears on invoices, quotations, receipts, reports, and all printed documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <form onSubmit={handleSaveCompany} className="space-y-6">
                    {/* Logo Section */}
                    <div className="space-y-3">
                      <Label>Company Logo</Label>
                      <div className="flex items-center gap-4">
                        <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/30">
                          {companyForm.logo_url ? (
                            <img src={companyForm.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
                          ) : (
                            <Image className="w-8 h-8 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="space-y-2">
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={logoUploading}
                          >
                            {logoUploading ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="w-4 h-4 mr-2" />
                            )}
                            {companyForm.logo_url ? 'Change Logo' : 'Upload Logo'}
                          </Button>
                          <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                          value={companyForm.company_name}
                          onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                          placeholder="Your Business Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <Input
                          value={companyForm.phone}
                          onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                          placeholder="+254 700 000 000"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={companyForm.email}
                          onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                          placeholder="info@company.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Website</Label>
                        <Input
                          value={companyForm.website}
                          onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                          placeholder="www.company.com"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Location / Address</Label>
                        <Input
                          value={companyForm.address}
                          onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                          placeholder="Street address or area"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Building / Floor</Label>
                        <Input
                          value={companyForm.building}
                          onChange={(e) => setCompanyForm({ ...companyForm, building: e.target.value })}
                          placeholder="e.g. Kimathi House, 2nd Floor"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Tax PIN / KRA PIN</Label>
                      <Input
                        value={companyForm.tax_pin}
                        onChange={(e) => setCompanyForm({ ...companyForm, tax_pin: e.target.value })}
                        placeholder="P000000000X"
                      />
                    </div>

                    <Button type="submit" disabled={companySaving}>
                      {companySaving ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Company Info
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Receipt Settings */}
          <TabsContent value="receipt">
            <Card>
              <CardHeader>
                <CardTitle>Receipt Settings</CardTitle>
                <CardDescription>
                  Customize the footer text displayed on printed receipts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <form onSubmit={handleSaveReceipt} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Receipt Footer</Label>
                      <Textarea
                        value={receiptForm.footer_text}
                        onChange={(e) => setReceiptForm({ ...receiptForm, footer_text: e.target.value })}
                        placeholder="Thank you for shopping with us!"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">This text appears at the bottom of every receipt. Company details are pulled from the Company Info tab.</p>
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
                        <div key={u.id} className="glass-item flex items-center justify-between">
                          <div>
                            <p className="font-medium">{u.full_name}</p>
                            
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

          {/* Casuals Management */}
          {isAdmin && (
            <TabsContent value="casuals">
              <CasualManagement />
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
                onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newUserForm.role}
                onValueChange={(v) => setNewUserForm({ ...newUserForm, role: v as 'admin' | 'cashier' })}
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
                {addingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
