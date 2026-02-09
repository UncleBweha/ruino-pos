import { useState, useEffect } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useCasuals } from '@/hooks/useCasuals';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Trash2, Loader2, RefreshCw, User, TrendingUp, ChevronRight } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

interface AccountSummary {
  id: string;
  name: string;
  type: 'admin' | 'cashier' | 'casual';
  totalSales: number;
  totalItems: number;
  totalCommission: number;
}

interface DailyActivity {
  product_name: string;
  quantity: number;
  payment_method: string;
  total: number;
}

export function UserManagement() {
  const { users, loading, deleting, refresh, deleteUser } = useUsers();
  const { casuals } = useCasuals();
  const { user: currentUser } = useAuth();
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<AccountSummary | null>(null);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Fetch today's sales data for all accounts
  useEffect(() => {
    async function fetchAccountSummaries() {
      setAccountsLoading(true);
      try {
        const todayStart = startOfDay(new Date()).toISOString();
        const todayEnd = endOfDay(new Date()).toISOString();

        const { data: salesData } = await supabase
          .from('sales')
          .select('cashier_id, total, profit, payment_method, sold_on_behalf_of, sold_on_behalf_name, commission_amount, sale_items(quantity)')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd)
          .neq('status', 'voided');

        // Build summary for staff (admins + cashiers)
        const staffMap = new Map<string, AccountSummary>();
        users.forEach(u => {
          staffMap.set(u.user_id, {
            id: u.user_id,
            name: u.full_name,
            type: (u.role || 'cashier') as 'admin' | 'cashier',
            totalSales: 0,
            totalItems: 0,
            totalCommission: 0,
          });
        });

        // Build summary for casuals
        const casualMap = new Map<string, AccountSummary>();
        casuals.forEach(c => {
          casualMap.set(c.id, {
            id: c.id,
            name: c.full_name,
            type: 'casual',
            totalSales: 0,
            totalItems: 0,
            totalCommission: 0,
          });
        });

        // Process sales
        (salesData || []).forEach(sale => {
          const itemCount = sale.sale_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0;

          // Attribute to cashier
          const staffEntry = staffMap.get(sale.cashier_id);
          if (staffEntry) {
            staffEntry.totalSales += Number(sale.total);
            staffEntry.totalItems += itemCount;
          }

          // Attribute to casual if sold on behalf
          if (sale.sold_on_behalf_of) {
            const casualEntry = casualMap.get(sale.sold_on_behalf_of);
            if (casualEntry) {
              casualEntry.totalSales += Number(sale.total);
              casualEntry.totalItems += itemCount;
              casualEntry.totalCommission += Number(sale.commission_amount || 0);
            }
          }
        });

        // Combine and sort by total sales
        const allAccounts = [
          ...Array.from(staffMap.values()),
          ...Array.from(casualMap.values()),
        ].sort((a, b) => b.totalSales - a.totalSales);

        setAccounts(allAccounts);
      } catch (error) {
        console.error('Error fetching account summaries:', error);
      } finally {
        setAccountsLoading(false);
      }
    }

    if (!loading) {
      fetchAccountSummaries();
    }
  }, [users, casuals, loading]);

  // Fetch daily activity for selected account
  const fetchDailyActivity = async (account: AccountSummary) => {
    setSelectedAccount(account);
    setActivityLoading(true);

    try {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      let salesQuery;
      if (account.type === 'casual') {
        // Fetch sales where this casual was the seller
        salesQuery = supabase
          .from('sales')
          .select('id, payment_method, sale_items(product_name, quantity, total)')
          .eq('sold_on_behalf_of', account.id)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd)
          .neq('status', 'voided');
      } else {
        // Fetch sales by this cashier
        salesQuery = supabase
          .from('sales')
          .select('id, payment_method, sale_items(product_name, quantity, total)')
          .eq('cashier_id', account.id)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd)
          .neq('status', 'voided');
      }

      const { data } = await salesQuery;

      // Flatten sale items with payment method
      const activities: DailyActivity[] = [];
      (data || []).forEach(sale => {
        (sale.sale_items || []).forEach((item: any) => {
          activities.push({
            product_name: item.product_name,
            quantity: item.quantity,
            payment_method: sale.payment_method,
            total: item.total,
          });
        });
      });

      setDailyActivity(activities);
    } catch (error) {
      console.error('Error fetching daily activity:', error);
    } finally {
      setActivityLoading(false);
    }
  };

  const handleDelete = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'admin':
        return <Badge variant="default" className="capitalize rounded-full text-xs">Admin</Badge>;
      case 'cashier':
        return <Badge variant="secondary" className="capitalize rounded-full text-xs">Cashier</Badge>;
      case 'casual':
        return <Badge variant="outline" className="capitalize rounded-full text-xs border-warning text-warning">Casual</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="bento-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base">Team & Casuals</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh} className="rounded-full">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {accountsLoading || loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No accounts found
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {accounts.map((account) => {
              const isCurrentUser = account.type !== 'casual' && account.id === currentUser?.id;

              return (
                <div
                  key={`${account.type}-${account.id}`}
                  className="glass-item flex items-center justify-between p-3 cursor-pointer"
                  onClick={() => fetchDailyActivity(account)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">
                          {account.name}
                        </p>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-2xs rounded-full">You</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatCurrency(account.totalSales)} sales</span>
                        <span>{account.totalItems} items</span>
                        {account.totalCommission > 0 && (
                          <span className="text-warning">{formatCurrency(account.totalCommission)} comm.</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily Activity Dialog */}
      <Dialog open={!!selectedAccount} onOpenChange={() => setSelectedAccount(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {selectedAccount?.name} — Today's Activity
            </DialogTitle>
          </DialogHeader>
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : dailyActivity.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No sales activity today
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Type</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyActivity.map((activity, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{activity.product_name}</TableCell>
                      <TableCell className="text-right">{activity.quantity}</TableCell>
                      <TableCell className="text-right capitalize">{activity.payment_method}</TableCell>
                      <TableCell className="text-right currency">{formatCurrency(activity.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t mt-2 pt-2 px-4 flex justify-between font-bold text-sm">
                <span>Total</span>
                <span className="currency">
                  {formatCurrency(dailyActivity.reduce((sum, a) => sum + Number(a.total), 0))}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent className="rounded-bento">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
