import { useState } from 'react';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
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
import { Users, Trash2, Loader2, RefreshCw, User } from 'lucide-react';

export function UserManagement() {
  const { users, loading, deleting, refresh, deleteUser } = useUsers();
  const { user: currentUser } = useAuth();
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);

  const handleDelete = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete.id);
      setUserToDelete(null);
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
            <h3 className="font-bold text-base">Team</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh} className="rounded-full">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No users found
          </p>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {users.map((user) => {
              const isCurrentUser = user.user_id === currentUser?.id;
              const isDeleting = deleting === user.user_id;

              return (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-accent-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">
                          {user.full_name}
                        </p>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-2xs rounded-full">You</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge
                      className="capitalize rounded-full text-xs"
                      variant={user.role === 'admin' ? 'default' : 'secondary'}
                    >
                      {user.role || 'No role'}
                    </Badge>
                    {!isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={isDeleting}
                        onClick={() => setUserToDelete({ id: user.user_id, name: user.full_name })}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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