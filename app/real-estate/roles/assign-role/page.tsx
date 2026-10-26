'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/app/api/errors'
import { usersApi, rolesApi } from '@/app/api/api'
import { usePermissions } from '@/hooks/usePermissions'
import type { ManagedUser, Role } from '@/types/rbac'

const titleCase = (s: string) =>
  s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function roleBadgeColor(role: string) {
  const key = role.toLowerCase().replace(/[_\s]/g, '')
  switch (key) {
    case 'superadmin': return 'bg-violet-500/10 text-violet-400'
    case 'admin': return 'bg-sky-500/10 text-sky-400'
    case 'manager': return 'bg-amber-500/10 text-amber-500'
    case 'teamleader': return 'bg-cyan-500/10 text-cyan-400'
    case 'salesexecutive': return 'bg-emerald-500/10 text-emerald-500'
    case 'supportagent': return 'bg-rose-500/10 text-rose-400'
    default: return 'bg-neutral-500/10 text-neutral-400'
  }
}

export default function AssignRolePage() {
  const qc = useQueryClient()
  const { has, isSuperAdmin } = usePermissions()
  const canAssign = has('users.update')

  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const usersQuery = useQuery<ManagedUser[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.getUsers(),
  })

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => rolesApi.getRoles(),
  })

  // A non-super-admin (e.g. admin) must not see super-admin users anywhere on
  // this page — not in the picker and not in the assignments table.
  const users = useMemo(() => {
    const all = usersQuery.data ?? []
    if (isSuperAdmin) return all
    return all.filter(
      (u) => !(u.roles ?? []).some((ur) => ur.role.name === 'super_admin')
    )
  }, [usersQuery.data, isSuperAdmin])

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    const query = searchQuery.toLowerCase()
    return users.filter(
      (u) =>
        (u.email ?? '').toLowerCase().includes(query) ||
        (u.name ?? '').toLowerCase().includes(query)
    )
  }, [users, searchQuery])

  const filteredUsersForSelect = useMemo(() => {
    if (!userSearchQuery.trim()) return users
    const query = userSearchQuery.toLowerCase()
    return users.filter(
      (u) =>
        (u.email ?? '').toLowerCase().includes(query) ||
        (u.name ?? '').toLowerCase().includes(query)
    )
  }, [users, userSearchQuery])

  const selectedUserObject = useMemo(() => {
    return users.find((u) => u.id === selectedUser) || null
  }, [users, selectedUser])
  // super_admin is not an assignable role — hide it from the picker.
  const roles = useMemo(
    () => (rolesQuery.data ?? []).filter((r) => r.name !== 'super_admin'),
    [rolesQuery.data]
  )

  // Single-role assignment: replace the user's roles with the selected one.
  const assignMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      usersApi.syncRoles(userId, [roleId]),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['roles'] })
      const user = users.find((u) => u.id === vars.userId)
      const role = roles.find((r) => r.id === vars.roleId)
      toast.success(
        `Role "${role ? titleCase(role.name) : 'role'}" assigned to ${user?.email ?? 'user'}`
      )
      setSelectedUser('')
      setSelectedRole('')
    },
    onError: (e: unknown) =>
      toast.error(getApiErrorMessage(e, 'Failed to assign role')),
  })

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !selectedRole) return
    assignMutation.mutate({ userId: selectedUser, roleId: selectedRole })
  }

  const loading = usersQuery.isLoading || rolesQuery.isLoading
  const loadError = usersQuery.isError || rolesQuery.isError

  const currentRoleName = (user: ManagedUser) =>
    user.roles?.[0]?.role?.name ?? null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Assign Role</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Assign or update roles for existing users
        </p>
      </div>

      {loadError && (
        <div className="px-4 py-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          Failed to load users or roles. You may not have permission to view them.
        </div>
      )}

      {/* Assignment Form */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Role Assignment</h2>
        </div>
        <form onSubmit={handleAssign}>
          <div className="px-5 py-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Select User
              </label>
              
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                disabled={loading || !canAssign}
                className="flex items-center justify-between w-full h-9 px-3 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <span className="truncate">
                  {selectedUserObject 
                    ? (selectedUserObject.name 
                        ? `${selectedUserObject.name} (${selectedUserObject.email})` 
                        : selectedUserObject.email)
                    : '— Choose a user —'}
                </span>
                <span className="text-xs text-muted-foreground">▼</span>
              </button>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />
                  <div className="absolute top-[64px] left-0 right-0 z-20 flex flex-col gap-2 rounded-md border border-border bg-card p-2.5 shadow-lg max-h-60 overflow-y-auto">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search user..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="h-8 px-2.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full sticky top-0 z-10"
                    />
                    
                    <div className="flex flex-col gap-0.5 mt-1">
                      {filteredUsersForSelect.length === 0 ? (
                        <div className="px-2.5 py-1.5 text-xs text-muted-foreground text-center">
                          No users found
                        </div>
                      ) : (
                        filteredUsersForSelect.map((u) => {
                          const displayName = u.name ? `${u.name} (${u.email})` : u.email
                          const roleLabel = currentRoleName(u) ? ` — ${titleCase(currentRoleName(u)!)}` : ''
                          const isSelected = selectedUser === u.id
                          
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUser(u.id)
                                setIsDropdownOpen(false)
                                setUserSearchQuery('')
                              }}
                              className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                                isSelected 
                                  ? 'bg-foreground text-background font-medium' 
                                  : 'hover:bg-muted/60 text-foreground'
                              }`}
                            >
                              {displayName}{roleLabel}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Select Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                required
                disabled={loading || !canAssign}
                className="h-9 px-3 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">— Choose a role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{titleCase(r.name)}</option>
                ))}
              </select>
            </div>
          </div>

          {!canAssign && !loadError && (
            <div className="mx-5 mb-4 px-4 py-3 rounded-md bg-muted/30 border border-border text-sm text-muted-foreground">
              You don&apos;t have permission to assign roles. This requires the{' '}
              <span className="font-mono text-foreground">users.update</span> permission.
            </div>
          )}

          <div className="px-5 py-4 border-t border-border flex items-center justify-end bg-muted/10">
            <button
              type="submit"
              disabled={assignMutation.isPending || !canAssign || !selectedUser || !selectedRole}
              className="h-9 px-5 text-sm font-medium rounded-md bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assignMutation.isPending ? 'Assigning…' : 'Assign Role'}
            </button>
          </div>
        </form>
      </div>

      {/* Users & Current Roles Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-sm font-semibold text-foreground">Current Role Assignments</h2>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 px-3 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-full sm:w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left md:min-w-120">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">S.No</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned Roles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border block md:table-row-group">
              {loading ? (
                <tr className="block md:table-row">
                  <td className="px-5 py-8 text-sm text-muted-foreground text-center block md:table-cell" colSpan={4}>
                    Loading users…
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr className="block md:table-row">
                  <td className="px-5 py-8 text-sm text-muted-foreground text-center block md:table-cell" colSpan={4}>
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => (
                  <tr key={user.id} className="block md:table-row hover:bg-accent/30 transition-colors p-4 md:p-0">
                    <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                      <div className="flex md:block items-center justify-between gap-4">
                        <span className="md:hidden font-medium text-muted-foreground text-xs uppercase">S.No</span>
                        <span className="text-sm text-muted-foreground tabular-nums">{index + 1}</span>
                      </div>
                    </td>
                    <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                      <div className="flex md:block items-center justify-between gap-4">
                        <span className="md:hidden font-medium text-muted-foreground text-xs uppercase">Name</span>
                        <span className="text-sm font-medium text-foreground">{user.name || '—'}</span>
                      </div>
                    </td>
                    <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                      <div className="flex md:block items-center justify-between gap-4">
                        <span className="md:hidden font-medium text-muted-foreground text-xs uppercase">Email</span>
                        <span className="text-sm font-medium text-foreground">{user.email}</span>
                      </div>
                    </td>
                    <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                      <div className="flex md:block items-center justify-between gap-4">
                        <span className="md:hidden font-medium text-muted-foreground text-xs uppercase">Roles</span>
                        <div className="flex flex-wrap gap-1.5 justify-end md:justify-start">
                          {user.roles && user.roles.length > 0 ? (
                            user.roles.map((ur) => (
                              <span
                                key={ur.roleId}
                                className={`text-xs font-medium px-2.5 py-1 rounded-md ${roleBadgeColor(ur.role.name)}`}
                              >
                                {titleCase(ur.role.name)}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">No role</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
