'use client'

import { memo, useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { rolesApi, permissionsApi } from '@/app/api/api'
import { usePermissions } from '@/hooks/usePermissions'
import type { Role, GroupedPermissions } from '@/types/rbac'
import { IconType } from 'react-icons'
import {
  FiUsers,
  FiShield,
  FiKey,
  FiLayers,
  FiShoppingCart,
  FiTrendingUp,
  FiPhone,
  FiFileText,
  FiSliders,
  FiPackage,
  FiEye,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiDownload,
  FiUnlock,
  FiSettings,
  FiHelpCircle,
  FiHome,
  FiUserCheck
} from 'react-icons/fi'

// ── Presentation metadata (icon / colour) keyed by backend module + action ──────
// Falls back gracefully for any module/action the backend adds later.

const MODULE_META: Record<string, { icon: IconType; color: string; bg: string; desc: string }> = {
  users:             { icon: FiUsers, color: '#4f7cff', bg: 'rgba(79,124,255,0.12)',  desc: 'Manage system users' },
  roles:             { icon: FiShield, color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', desc: 'Role configuration' },
  permissions:       { icon: FiKey, color: '#f472b6', bg: 'rgba(244,114,182,0.12)', desc: 'Permission catalogue' },
  tenants:           { icon: FiLayers, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  desc: 'Client organisations' },
  orders:            { icon: FiShoppingCart, color: '#3dd68c', bg: 'rgba(61,214,140,0.12)',  desc: 'Sales orders & deals' },
  reports:           { icon: FiTrendingUp, color: '#ffc845', bg: 'rgba(255,200,69,0.12)',  desc: 'Generate & export reports' },
  calls:             { icon: FiPhone, color: '#ff7eb3', bg: 'rgba(255,126,179,0.12)', desc: 'Voice agent calls' },
  forms:             { icon: FiFileText, color: '#34d399', bg: 'rgba(52,211,153,0.12)',  desc: 'Dynamic forms & responses' },
  leads:             { icon: FiUserCheck, color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  desc: 'Lead capture & follow-ups' },
  projects:          { icon: FiHome, color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  desc: 'Property projects & inventory' },
  'user-management': { icon: FiSliders, color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  desc: 'User management access' },
}

const ACTION_META: Record<string, { icon: IconType; iconCls: string }> = {
  view:   { icon: FiEye, iconCls: 'text-[#4f7cff] border-[rgba(79,124,255,0.2)]' },
  create: { icon: FiPlus, iconCls: 'text-[#3dd68c] border-[rgba(61,214,140,0.2)]' },
  update: { icon: FiEdit2,  iconCls: 'text-[#ffc845] border-[rgba(255,200,69,0.2)]' },
  edit:   { icon: FiEdit2,  iconCls: 'text-[#ffc845] border-[rgba(255,200,69,0.2)]' },
  delete: { icon: FiTrash2,  iconCls: 'text-[#ff5e6b] border-[rgba(255,94,107,0.2)]' },
  export: { icon: FiDownload,  iconCls: 'text-[#38bdf8] border-[rgba(56,189,248,0.2)]' },
  access: { icon: FiUnlock, iconCls: 'text-[#a78bfa] border-[rgba(167,139,250,0.2)]' },
  manage: { icon: FiSettings,  iconCls: 'text-[#fb923c] border-[rgba(251,146,60,0.2)]' },
}

function moduleMeta(id: string) {
  return (
    MODULE_META[id] ?? {
      icon: FiPackage,
      color: '#818cf8',
      bg: 'rgba(129,140,248,0.12)',
      desc: 'Module access',
    }
  )
}

function actionMeta(action: string) {
  return ACTION_META[action] ?? { icon: FiHelpCircle, iconCls: 'text-[#9398b0] border-white/10' }
}

const titleCase = (s: string) =>
  s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// Matches "super admin" in any casing/spacing/punctuation variant
// (e.g. "Super Admin", "SUPER-ADMIN", "super_admin").
const isSuperAdminName = (name: string) =>
  name.toLowerCase().replace(/[\s_-]/g, '') === 'superadmin'

// ── A single module card ────────────────────────────────────────────────────────

interface CardProps {
  module:   string
  actions:  { id: string; action: string }[]
  selected: Set<string>
  onTogglePerm:   (permId: string, on: boolean) => void
  onToggleModule: (permIds: string[], on: boolean) => void
}

const ModuleCard = memo(function ModuleCard({
  module,
  actions,
  selected,
  onTogglePerm,
  onToggleModule,
}: CardProps) {
  const meta = moduleMeta(module)
  const ModuleIcon = meta.icon
  const permIds = actions.map((a) => a.id)
  const onCount = permIds.filter((id) => selected.has(id)).length
  const enabled = onCount > 0

  return (
    <div className={`relative overflow-hidden rounded-[14px] p-5 border transition-all duration-300 bg-card hover:bg-muted/40 ${
      enabled ? 'border-primary/30' : 'border-border hover:border-border/80'
    }`}>
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#4f7cff] to-transparent transition-opacity duration-300 ${
        enabled ? 'opacity-100' : 'opacity-0'
      }`} />

      {/* Card header */}
      <div className="flex items-start justify-between mb-[18px] gap-3">
        <div className="flex items-center gap-[11px] flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-[10px] grid place-items-center flex-shrink-0"
            style={{ background: meta.bg, color: meta.color }}
          >
            <ModuleIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14.5px] font-semibold tracking-[-0.2px] truncate text-foreground">{titleCase(module)}</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{meta.desc}</div>
          </div>
        </div>

        {/* Module enable toggle — selects/clears every permission */}
        <label className="relative w-10 h-[22px] flex-shrink-0 cursor-pointer inline-flex" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            className="peer absolute opacity-0 w-0 h-0"
            checked={enabled}
            onChange={(e) => onToggleModule(permIds, e.target.checked)}
          />
          <span className="absolute inset-0 rounded-full bg-muted border border-border peer-checked:bg-blue-500 peer-checked:border-blue-500/40 transition-all duration-[250ms]" />
          <span className="absolute top-[3px] left-[2px] w-4 h-4 rounded-full bg-muted-foreground shadow-[0_1px_4px_rgba(0,0,0,0.2)] peer-checked:left-[21px] peer-checked:bg-background transition-all duration-[250ms]" />
        </label>
      </div>

      <div className="h-px bg-border mb-[14px]" />

      {/* Permission rows — one per backend action */}
      <div className="flex flex-col gap-1.5">
        {actions.map((a) => {
          const am = actionMeta(a.action)
          const ActionIcon = am.icon
          const on = selected.has(a.id)
          return (
            <div key={a.id} className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-[9px]">
                <div className={`w-[26px] h-[26px] rounded-[6px] grid place-items-center flex-shrink-0 bg-muted/60 border ${am.iconCls}`}>
                  <ActionIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[12.5px] font-medium text-muted-foreground">{titleCase(a.action)}</span>
              </div>

              <label className="relative w-[34px] h-[18px] flex-shrink-0 cursor-pointer inline-flex" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="peer absolute opacity-0 w-0 h-0"
                  checked={on}
                  onChange={(e) => onTogglePerm(a.id, e.target.checked)}
                />
                <span className="absolute inset-0 rounded-full bg-muted border border-border peer-checked:bg-emerald-500 peer-checked:border-emerald-500/35 transition-all duration-[250ms]" />
                <span className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-muted-foreground shadow-[0_1px_3px_rgba(0,0,0,0.2)] peer-checked:left-[18px] peer-checked:bg-background transition-all duration-[250ms]" />
              </label>
            </div>
          )
        })}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between mt-[14px] pt-3 border-t border-border">
        <span className="text-[11px] text-muted-foreground font-mono">
          <span className="text-blue-500 font-semibold">{onCount}</span>/{permIds.length} permissions
        </span>
      </div>
    </div>
  )
})

// ── New-role modal ───────────────────────────────────────────────────────────────

function NewRoleModal({
  onClose,
  onCreate,
  saving,
  isSuperAdmin,
}: {
  onClose: () => void
  onCreate: (name: string, description: string) => void
  saving: boolean
  isSuperAdmin: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // A regular admin must never be able to mint a role that impersonates the
  // all-powerful super_admin role — only an actual super admin may do that.
  const blockedName = !isSuperAdmin && isSuperAdminName(name.trim())

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-[14px] border border-border bg-card p-6 shadow-[0_24px_64px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[17px] font-bold text-foreground mb-1">Create New Role</h3>
        <p className="text-[12.5px] text-muted-foreground mb-5">Add a custom role, then assign its permissions.</p>

        <label className="block text-[11px] font-semibold uppercase tracking-[1px] text-muted-foreground mb-1.5">Role name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Regional Manager"
          className={`w-full rounded-[8px] border bg-background px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-primary transition-colors ${
            blockedName ? 'border-destructive/60 mb-1.5' : 'border-border mb-4'
          }`}
        />
        {blockedName && (
          <p className="text-[11.5px] text-destructive mb-2.5">
            This role name isn&apos;t available. Please choose a different name.
          </p>
        )}

        <label className="block text-[11px] font-semibold uppercase tracking-[1px] text-muted-foreground mb-1.5">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this role can do (optional)"
          rows={3}
          className="w-full mb-5 rounded-[8px] border border-border bg-background px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-primary transition-colors resize-none"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground border border-border hover:text-foreground hover:border-foreground/40 transition-all"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || saving || blockedName}
            onClick={() => onCreate(name.trim(), description.trim())}
            className="px-4 py-2 rounded-lg text-[13px] font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? 'Creating…' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────────

const RolesPermissionsPanel = memo(function RolesPermissionsPanel() {
  const qc = useQueryClient()
  const { has, isSuperAdmin, permissions: myPerms, roleNames } = usePermissions()
  const canManageRoles = has('roles.update')
  const canCreate = has('roles.create')
  const canDelete = has('roles.delete')

  const [activeRoleId, setActiveRoleId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [syncKey, setSyncKey] = useState('')
  const [showNewRole, setShowNewRole] = useState(false)

  const rolesQuery = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => rolesApi.getRoles(),
  })

  const groupedQuery = useQuery<GroupedPermissions>({
    queryKey: ['permissions', 'grouped'],
    queryFn: () => permissionsApi.getGrouped(),
  })

  // The super_admin role is the all-powerful god role — never list it as an
  // editable tab (prevents accidental permission changes / lockout).
  const roles = useMemo(
    () => (rolesQuery.data ?? []).filter((r) => r.name !== 'super_admin'),
    [rolesQuery.data]
  )
  const grouped = useMemo(() => groupedQuery.data ?? {}, [groupedQuery.data])

  // You can only grant permissions you hold yourself. A non-super-admin therefore
  // only sees modules it has at least one permission in — this hides Tenants from
  // an admin and prevents privilege escalation via the role editor.
  const myModules = useMemo(
    () => new Set(myPerms.map((p) => p.split('.')[0])),
    [myPerms]
  )
  const modules = useMemo(() => {
    const all = Object.keys(grouped)
    return isSuperAdmin ? all : all.filter((m) => myModules.has(m))
  }, [grouped, isSuperAdmin, myModules])

  // Fall back to the first role until the user explicitly picks one — derived,
  // so no effect is needed to "default" the selection.
  const effectiveRoleId = activeRoleId ?? roles[0]?.id ?? null

  const activeRole = useMemo(
    () => roles.find((r) => r.id === effectiveRoleId) ?? null,
    [roles, effectiveRoleId]
  )

  // You cannot edit a role you yourself hold — it would let you strip your own
  // access and lock yourself out (the backend rejects this too). You can still
  // use "Restore Defaults" on it, which only ever re-grants permissions.
  const isOwnRole = !!activeRole && roleNames.includes(activeRole.name)
  // System roles (admin, super_admin, …) are global and shared across every
  // tenant — only a super admin may edit them. For everyone else this panel is
  // read-only on those roles. Mirrors the backend guard and closes the
  // escalation where a manager with roles.update edits the shared admin role.
  const isProtectedSystemRole = !!activeRole?.isSystem && !isSuperAdmin
  const canEdit = canManageRoles && !isOwnRole && !isProtectedSystemRole

  // The permission set that lives on the server for the active role.
  const serverSelected = useMemo(() => {
    const s = new Set<string>()
    activeRole?.permissions?.forEach((rp) => s.add(rp.permissionId))
    return s
  }, [activeRole])

  // Reset the editable selection whenever the active role (or its server-side
  // permissions) change. This is React's "adjust state during render" pattern —
  // it avoids the cascading re-renders an effect-based sync would cause.
  const serverKey = effectiveRoleId
    ? `${effectiveRoleId}:${[...serverSelected].sort().join(',')}`
    : ''
  if (serverKey !== syncKey) {
    setSyncKey(serverKey)
    setSelected(new Set(serverSelected))
  }

  const dirty = useMemo(() => {
    if (selected.size !== serverSelected.size) return true
    for (const id of selected) if (!serverSelected.has(id)) return true
    return false
  }, [selected, serverSelected])

  const togglePerm = useCallback((permId: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(permId)
      else next.delete(permId)
      return next
    })
  }, [])

  const toggleModule = useCallback((permIds: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      permIds.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })
  }, [])

  const allPermIds = useMemo(
    () => modules.flatMap((m) => grouped[m].map((p) => p.id)),
    [modules, grouped]
  )

  const toggleAll = useCallback(
    (on: boolean) =>
      setSelected((prev) => {
        // Only touch permissions in the visible modules; preserve any selection
        // in hidden modules (e.g. a role's existing tenant perms an admin can't see).
        const visible = new Set(allPermIds)
        const next = new Set([...prev].filter((id) => !visible.has(id)))
        if (on) allPermIds.forEach((id) => next.add(id))
        return next
      }),
    [allPermIds]
  )

  const resetSelection = useCallback(() => {
    setSelected(new Set(serverSelected))
    toast.info('Changes reverted')
  }, [serverSelected])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () => rolesApi.syncPermissions(effectiveRoleId!, [...selected]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Permissions saved')
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to save permissions'),
  })

  const createMutation = useMutation({
    mutationFn: (vars: { name: string; description: string }) => {
      // Defense in depth: even if the modal's own check is bypassed, never
      // let a non-super-admin's create request reach the API with this name.
      if (!isSuperAdmin && isSuperAdminName(vars.name)) {
        return Promise.reject(new Error('This role name isn\'t available. Please choose a different name.'))
      }
      return rolesApi.createRole({ name: vars.name, description: vars.description || undefined })
    },
    onSuccess: (created: Role) => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      setActiveRoleId(created.id)
      setShowNewRole(false)
      toast.success(`Role "${created.name}" created`)
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || e?.message || 'Failed to create role'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.deleteRole(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      if (effectiveRoleId === id) setActiveRoleId(null)
      toast.success('Role deleted')
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to delete role'),
  })

  const handleDelete = useCallback(() => {
    if (!activeRole) return
    if (activeRole.isSystem) {
      toast.error('System roles cannot be deleted')
      return
    }
    if (window.confirm(`Delete role "${activeRole.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(activeRole.id)
    }
  }, [activeRole, deleteMutation])

  const restoreMutation = useMutation({
    mutationFn: (id: string) => rolesApi.restoreDefaults(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role permissions restored to defaults')
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to restore defaults'),
  })

  const handleRestore = useCallback(() => {
    if (!activeRole) return
    if (
      window.confirm(
        `Restore "${titleCase(activeRole.name)}" to its default permissions? This replaces its current permissions.`
      )
    ) {
      restoreMutation.mutate(activeRole.id)
    }
  }, [activeRole, restoreMutation])

  // ── Derived stats ────────────────────────────────────────────────────────────

  const activeModuleCount = modules.filter((m) =>
    grouped[m].some((p) => selected.has(p.id))
  ).length
  const allEnabled = allPermIds.length > 0 && allPermIds.every((id) => selected.has(id))

  const loading = rolesQuery.isLoading || groupedQuery.isLoading
  const loadError = rolesQuery.isError || groupedQuery.isError

  return (
    <div className="flex flex-col gap-6">
      {/* Page head */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Roles &amp; Permissions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage module access and permission levels per role</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            className="inline-flex items-center gap-[7px] h-9 px-4 rounded-md text-[13px] font-medium cursor-pointer bg-background text-muted-foreground border border-border hover:bg-muted/50 hover:text-foreground transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={resetSelection}
            disabled={!dirty}
          >
            ↺ Reset
          </button>
          {canCreate && (
            <button
              className="inline-flex items-center gap-[7px] h-9 px-4 rounded-md text-[13px] font-medium cursor-pointer bg-background text-muted-foreground border border-border hover:bg-muted/50 hover:text-foreground transition-all whitespace-nowrap"
              onClick={() => setShowNewRole(true)}
            >
              + Create Role
            </button>
          )}
          {canDelete && activeRole && !activeRole.isSystem && (
            <button
              className="inline-flex items-center gap-[7px] h-9 px-4 rounded-md text-[13px] font-medium cursor-pointer bg-background text-destructive border border-destructive/20 hover:bg-destructive/10 transition-all whitespace-nowrap disabled:opacity-40"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              ✕ Delete Role
            </button>
          )}
          {isSuperAdmin && activeRole?.isSystem && (
            <button
              className="inline-flex items-center gap-[7px] h-9 px-4 rounded-md text-[13px] font-medium cursor-pointer bg-background text-amber-600 border border-amber-500/20 hover:bg-amber-500/10 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
              title="Reset this role's permissions to the built-in defaults"
            >
              {restoreMutation.isPending ? 'Restoring…' : '↻ Restore Defaults'}
            </button>
          )}
          {canEdit && (
            <button
              className="inline-flex items-center gap-[7px] h-9 px-5 rounded-md text-[13px] font-medium cursor-pointer bg-foreground text-background hover:opacity-90 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => saveMutation.mutate()}
              disabled={!effectiveRoleId || !dirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : '✓ Save Changes'}
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="px-4 py-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Failed to load roles or permissions. You may not have access, or the server is unavailable.
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-24 text-muted-foreground text-sm">Loading roles &amp; permissions…</div>
      ) : (
        <>
          {/* Role tabs */}
          <div className="flex gap-2 flex-wrap">
            {roles.map((r) => (
              <button
                key={r.id}
                className={`flex items-center gap-2 px-[18px] py-[7px] rounded-full text-[13px] font-medium cursor-pointer border transition-all ${
                  effectiveRoleId === r.id
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
                onClick={() => setActiveRoleId(r.id)}
              >
                <span className="w-[7px] h-[7px] rounded-full bg-current opacity-70 flex-shrink-0" />
                {titleCase(r.name)}
                {r.isSystem && (
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">sys</span>
                )}
              </button>
            ))}
            {roles.length === 0 && (
              <span className="text-sm text-muted-foreground">No roles yet. Create one to get started.</span>
            )}
          </div>

          {/* Stats bar */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-[7px] bg-card border border-border rounded-full text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-500" />
              Modules Active: <strong className="text-foreground font-semibold ml-1">{activeModuleCount}</strong>
            </div>
            <div className="flex items-center gap-2 px-4 py-[7px] bg-card border border-border rounded-full text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-blue-500" />
              Permissions On: <strong className="text-foreground font-semibold ml-1">{selected.size}</strong>
            </div>
            <div className="flex items-center gap-2 px-4 py-[7px] bg-card border border-border rounded-full text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500" />
              Role: <strong className="text-foreground font-semibold ml-1">{activeRole ? titleCase(activeRole.name) : '—'}</strong>
            </div>
            {activeRole?._count && (
              <div className="flex items-center gap-2 px-4 py-[7px] bg-card border border-border rounded-full text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-purple-500" />
                Users: <strong className="text-foreground font-semibold ml-1">{activeRole._count.users}</strong>
              </div>
            )}
          </div>

          {isOwnRole && canManageRoles && (
            <div className="px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-500">
              This is your own role — editing is locked to prevent you from removing your own access. Use <span className="font-semibold">↻ Restore Defaults</span> if its permissions need resetting, or have a super admin change it.
            </div>
          )}
          {isProtectedSystemRole && !isOwnRole && canManageRoles && (
            <div className="px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600 dark:text-amber-500">
              This is a system role shared across all tenants — only a super admin can change its permissions. You have a read-only view.
            </div>
          )}
          {!canManageRoles && (
            <div className="px-4 py-2.5 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground">
              You have read-only access to roles. Editing requires the <span className="font-mono text-foreground">roles.update</span> permission.
            </div>
          )}

          {/* Section head */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold tracking-[1.2px] uppercase text-muted-foreground font-mono">
              Modules
            </span>
            {canEdit && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Enable All</span>
                <label className="relative w-10 h-[22px] flex-shrink-0 cursor-pointer inline-flex">
                  <input
                    type="checkbox"
                    className="peer absolute opacity-0 w-0 h-0"
                    checked={allEnabled}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  <span className="absolute inset-0 rounded-full bg-muted border border-border peer-checked:bg-blue-500 peer-checked:border-blue-500/40 transition-all duration-[250ms]" />
                  <span className="absolute top-[3px] left-[2px] w-4 h-4 rounded-full bg-muted-foreground shadow-[0_1px_4px_rgba(0,0,0,0.2)] peer-checked:left-[21px] peer-checked:bg-background transition-all duration-[250ms]" />
                </label>
              </div>
            )}
          </div>

          {/* Modules grid */}
          <div
            className={`grid gap-4 ${!canEdit ? 'pointer-events-none opacity-90' : ''}`}
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
          >
            {modules.map((m) => (
              <ModuleCard
                key={m}
                module={m}
                actions={grouped[m]}
                selected={selected}
                onTogglePerm={togglePerm}
                onToggleModule={toggleModule}
              />
            ))}
          </div>
        </>
      )}

      {showNewRole && (
        <NewRoleModal
          onClose={() => setShowNewRole(false)}
          onCreate={(name, description) => createMutation.mutate({ name, description })}
          saving={createMutation.isPending}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  )
})

export default RolesPermissionsPanel
