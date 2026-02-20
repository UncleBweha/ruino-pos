import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cacheProfiles, getCachedProfiles } from '@/lib/offlineDb';

interface UserWithRole {
  user_id: string;
  full_name: string;
  email: string | null;
  role: 'admin' | 'cashier' | null;
  created_at: string;
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, created_at')
        .order('created_at', { ascending: true });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => ({
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        role: roleMap.get(profile.user_id) as 'admin' | 'cashier' | null,
        created_at: profile.created_at,
      }));

      setUsers(usersWithRoles);
      cacheProfiles(usersWithRoles).catch(console.error);
    } catch (error) {
      console.error('Error fetching users, checking cache:', error);
      try {
        const cached = await getCachedProfiles();
        if (cached && cached.length > 0) {
          setUsers(cached as UserWithRole[]);
          return;
        }
      } catch (cacheErr) {
        console.error('Profile cache access failed:', cacheErr);
      }
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    }
  }

  async function deleteUser(userId: string) {
    setDeleting(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      toast({
        title: 'User Deleted',
        description: 'The user has been removed successfully',
      });

      // Refresh the list
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    async function init() {
      // 1. Load from cache immediately
      try {
        const cached = await getCachedProfiles();
        if (cached && cached.length > 0) {
          setUsers(cached as UserWithRole[]);
          setLoading(false);
        }
      } catch (err) {
        console.error('Initial profile cache load error:', err);
      }
      // 2. Refresh in background
      await fetchUsers();
    }
    init();
  }, []);

  return {
    users,
    loading,
    deleting,
    refresh: fetchUsers,
    deleteUser,
  };
}
