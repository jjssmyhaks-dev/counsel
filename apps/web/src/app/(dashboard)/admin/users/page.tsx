'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const serif = 'font-serif';
import type { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';

function RoleBadge({ role }: { role: User['role'] }) {
 const variant = role === 'admin' ? 'danger' : role === 'partner' ? 'info' : role === 'associate' ? 'success' : role === 'paralegal' ? 'warning' : 'neutral';
 return <Badge variant={variant}>{role.charAt(0).toUpperCase() + role.slice(1)}</Badge>;
}

function formatDate(d: string | undefined) {
 if (!d) return 'Never';
 return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function UsersPage() {
 const [users, setUsers] = useState<User[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [showInvite, setShowInvite] = useState(false);
 const [editRoleId, setEditRoleId] = useState<string | null>(null);
 const [deactivateId, setDeactivateId] = useState<string | null>(null);
 const [removeId, setRemoveId] = useState<string | null>(null);

 // Invite form
 const [inviteName, setInviteName] = useState('');
 const [inviteEmail, setInviteEmail] = useState('');
 const [inviteRole, setInviteRole] = useState<User['role']>('associate');

 useEffect(() => { loadUsers(); }, []);

 async function loadUsers() {
 setLoading(true);
 setError('');
 try {
 const resp = await api.get<{ data: User[] }>('/admin/users');
 setUsers(resp.data);
 } catch {
 setError('Failed to load users.');
 } finally {
 setLoading(false);
 }
 }

 function handleInvite() {
 if (!inviteName.trim() || !inviteEmail.trim()) return;
 const newUser: User = {
 id: `user-${Date.now()}`,
 email: inviteEmail,
 name: inviteName,
 role: inviteRole,
 firmId: 'firm-001',
 createdAt: new Date().toISOString(),
 lastLoginAt: undefined,
 };
 setUsers((prev) => [...prev, newUser]);
 setShowInvite(false);
 setInviteName('');
 setInviteEmail('');
 setInviteRole('associate');
 }

 function handleEditRole(userId: string, newRole: User['role']) {
 setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
 setEditRoleId(null);
 }

 function handleDeactivate(userId: string) {
 setUsers((prev) => prev.filter((u) => u.id !== userId));
 setDeactivateId(null);
 }

 function handleRemove(userId: string) {
 setUsers((prev) => prev.filter((u) => u.id !== userId));
 setRemoveId(null);
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="page-header !mb-0">
 <h1>User Management</h1>
 <p>Manage firm members, roles, and access permissions</p>
 </div>
 <Button onClick={() => setShowInvite(true)}>
 <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
 </svg>
 Invite User
 </Button>
 </div>

 {/* Error */}
 {error && <ErrorState message={error} onRetry={loadUsers} />}

 {/* Loading */}
 {loading && (
 <div className="bg-white dark:bg-slate-900 rounded-xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm overflow-hidden">
 <div className="p-5 space-y-4 animate-pulse">
 {[1, 2, 3, 4, 5].map((i) => (
 <div key={i} className="flex items-center gap-4">
 <div className="h-5 bg-black/[0.04] rounded w-1/4" />
 <div className="h-5 bg-black/[0.03] rounded w-1/3" />
 <div className="h-5 bg-black/[0.04] rounded-full w-16" />
 <div className="h-5 bg-black/[0.03] rounded w-24" />
 <div className="h-5 bg-black/[0.03] rounded-full w-16 ml-auto" />
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Table */}
 {!loading && !error && users.length > 0 && (
 <Card padding="none">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-black/[0.04] dark:border-white/[0.06] bg-[#fefdfb]/50">
 <th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] dark:text-slate-500 uppercase">Name</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] dark:text-slate-500 uppercase hidden md:table-cell">Email</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] dark:text-slate-500 uppercase">Role</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] dark:text-slate-500 uppercase hidden lg:table-cell">Last Login</th>
 <th className="text-left px-5 py-3 text-xs font-semibold text-[#969e9b] dark:text-slate-500 uppercase">Status</th>
 <th className="text-right px-5 py-3 text-xs font-semibold text-[#969e9b] dark:text-slate-500 uppercase">Actions</th>
 </tr>
 </thead>
 <tbody>
 {users.map((user) => (
 <tr key={user.id} className="border-b border-slate-100 hover:bg-[#fefdfb] transition-colors">
 <td className="px-5 py-3.5">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-[#eaf7f0] text-[#0a8a5f] flex items-center justify-center text-sm font-bold">
 {user.name.charAt(0)}
 </div>
 <p className="text-sm font-medium text-[#0c0a09] dark:text-white">{user.name}</p>
 </div>
 </td>
 <td className="px-5 py-3.5 text-sm text-[#717d79] dark:text-slate-400 hidden md:table-cell">{user.email}</td>
 <td className="px-5 py-3.5"><RoleBadge role={user.role} /></td>
 <td className="px-5 py-3.5 text-sm text-[#969e9b] dark:text-slate-500 hidden lg:table-cell">
 {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
 </td>
 <td className="px-5 py-3.5">
 <Badge variant="success" dot>Active</Badge>
 </td>
 <td className="px-5 py-3.5 text-right">
 <div className="relative group inline-block">
 <Button size="sm" variant="ghost">
 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
 </svg>
 </Button>
 <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.06] rounded-lg shadow-lg py-1 w-40 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
 <button
 onClick={() => setEditRoleId(user.id)}
 className="w-full text-left px-3 py-2 text-sm text-[#717d79] dark:text-slate-300 hover:bg-[#fefdfb]"
 >
 Edit Role
 </button>
 <button
 onClick={() => setDeactivateId(user.id)}
 className="w-full text-left px-3 py-2 text-sm text-[#717d79] dark:text-slate-300 hover:bg-[#fefdfb]"
 >
 Deactivate
 </button>
 <button
 onClick={() => setRemoveId(user.id)}
 className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-[#fdf0ee]"
 >
 Remove
 </button>
 </div>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </Card>
 )}

 {/* Empty state */}
 {!loading && !error && users.length === 0 && (
 <div className="bg-white dark:bg-slate-900 rounded-xl border border-black/[0.04] dark:border-white/[0.06] shadow-sm">
 <EmptyState
 title="No users yet"
 description="Invite team members to your firm to get started with collaborative legal work."
 actionLabel="Invite User"
 onAction={() => setShowInvite(true)}
 />
 </div>
 )}

 {/* Invite Modal */}
 <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite User">
 <div className="space-y-4">
 <Input
 label="Full Name"
 placeholder="e.g., Jennifer Walsh"
 value={inviteName}
 onChange={(e) => setInviteName(e.target.value)}
 />
 <Input
 label="Email Address"
 type="email"
 placeholder="e.g., jennifer@sterling-law.com"
 value={inviteEmail}
 onChange={(e) => setInviteEmail(e.target.value)}
 />
 <Select
 label="Role"
 options={[
 { value: 'admin', label: 'Admin — Full system access' },
 { value: 'partner', label: 'Partner — Full firm access' },
 { value: 'associate', label: 'Associate — Matter access' },
 { value: 'paralegal', label: 'Paralegal — Limited access' },
 { value: 'viewer', label: 'Viewer — Read only' },
 ]}
 value={inviteRole}
 onChange={(e) => setInviteRole(e.target.value as User['role'])}
 />
 </div>
 <div className="flex justify-end gap-3 mt-6">
 <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
 <Button onClick={handleInvite} disabled={!inviteName.trim() || !inviteEmail.trim()}>
 Send Invitation
 </Button>
 </div>
 </Modal>

 {/* Edit Role Modal */}
 <Modal open={!!editRoleId} onClose={() => setEditRoleId(null)} title="Edit Role">
 <Select
 label="Select New Role"
 options={[
 { value: 'admin', label: 'Admin' },
 { value: 'partner', label: 'Partner' },
 { value: 'associate', label: 'Associate' },
 { value: 'paralegal', label: 'Paralegal' },
 { value: 'viewer', label: 'Viewer' },
 ]}
 value={users.find((u) => u.id === editRoleId)?.role || 'associate'}
 onChange={(e) => {
 if (editRoleId) handleEditRole(editRoleId, e.target.value as User['role']);
 }}
 />
 <div className="flex justify-end gap-3 mt-6">
 <Button variant="secondary" onClick={() => setEditRoleId(null)}>Cancel</Button>
 <Button onClick={() => {
 if (editRoleId) {
 const current = users.find((u) => u.id === editRoleId);
 if (current) handleEditRole(editRoleId, current.role);
 }
 }}>
 Save Changes
 </Button>
 </div>
 </Modal>

 {/* Deactivate Confirmation */}
 <Modal open={!!deactivateId} onClose={() => setDeactivateId(null)} title="Deactivate User" size="sm">
 <p className="text-sm text-[#717d79] dark:text-slate-400">
 Are you sure you want to deactivate this user? They will lose access to the platform immediately.
 </p>
 <div className="flex justify-end gap-3 mt-6">
 <Button variant="secondary" onClick={() => setDeactivateId(null)}>Cancel</Button>
 <Button variant="danger" onClick={() => deactivateId && handleDeactivate(deactivateId)}>Deactivate</Button>
 </div>
 </Modal>

 {/* Remove Confirmation */}
 <Modal open={!!removeId} onClose={() => setRemoveId(null)} title="Remove User" size="sm">
 <p className="text-sm text-[#717d79] dark:text-slate-400">
 This will permanently remove the user and all their associations. This action cannot be undone.
 </p>
 <div className="flex justify-end gap-3 mt-6">
 <Button variant="secondary" onClick={() => setRemoveId(null)}>Cancel</Button>
 <Button variant="danger" onClick={() => removeId && handleRemove(removeId)}>Remove Permanently</Button>
 </div>
 </Modal>
 </div>
 );
}
