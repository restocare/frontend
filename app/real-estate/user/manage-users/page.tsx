'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { userApi, type ApiUser, type UpdateUserPayload, type UserRoleRef } from '@/app/api/api'
import { getApiErrorMessage } from '@/app/api/errors'
import { X, Mail, Phone, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'


const formatRoleName = (name: string): string => {
    if (!name) return "";
    return name
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

const normalizeRole = (name: string) =>
    (name || "").toLowerCase().replace(/[_\s]/g, "");

// True if any of the user's roles is super_admin. Used to keep super admins
// out of any list shown to a non-super-admin (the backend enforces this too).
const userHasSuperAdmin = (roles: UserRoleRef[] | undefined): boolean => {
    if (!roles) return false;
    return roles.some((r) => {
        const n = typeof r === "string" ? r : (r?.role?.name || r?.name || "");
        return normalizeRole(n) === "superadmin";
    });
}

const Page = () => {
    const queryClient = useQueryClient()
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 5
    const { user: loggedInUser } = useAuthStore()

    const [userToDelete, setUserToDelete] = useState<ApiUser | null>(null)
    const [userToEdit, setUserToEdit] = useState<ApiUser | null>(null)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editFormData, setEditFormData] = useState({
        name: "",
        email: "",
        phone: "",
        roleId: ""
    })

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users', loggedInUser?.tenantId],
        queryFn: () => userApi.getUsers(loggedInUser?.tenantId),
        enabled: !!loggedInUser,
    })


    // A non-super-admin must NEVER see a super admin anywhere — filter them out
    // of the list (defence in depth; the backend already excludes them).
    // The logged-in admin also shouldn't see their own account in this list.
    const visibleUsers = useMemo(() => {
        const firstUserRole = loggedInUser?.roles?.[0];
        const loggedInUserRoleName = typeof firstUserRole === "string"
          ? firstUserRole
          : (firstUserRole?.role?.name || firstUserRole?.name || "");
        const isSuperAdmin = normalizeRole(loggedInUserRoleName) === "superadmin";
        const withoutSelf = users.filter((u) => u.id !== loggedInUser?.id);
        if (isSuperAdmin) return withoutSelf;
        return withoutSelf.filter((u) => !userHasSuperAdmin(u.roles));
    }, [users, loggedInUser]);

    // Delete User Mutation
    const deleteUserMutation = useMutation({
        mutationFn: (userId: string) => userApi.deleteUser(userId),
        onSuccess: () => {
            toast.success("User deleted successfully")
            queryClient.invalidateQueries({ queryKey: ['users'] })
        },
        onError: (err: unknown) => {
            toast.error(getApiErrorMessage(err, "Failed to delete user"))
        }
    })

    // Edit User Mutation
    const editUserMutation = useMutation({
        mutationFn: async ({ id, payload, roleIds }: { id: string, payload: UpdateUserPayload, roleIds: string[] }) => {
            // Update core user details
            await userApi.updateUser(id, payload);
            // Sync roles
            if (roleIds && roleIds.length > 0) {
                await userApi.syncUserRoles(id, roleIds);
            }
        },
        onSuccess: () => {
            toast.success("User updated successfully")
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setIsEditModalOpen(false)
            setUserToEdit(null)
        },
        onError: (err: unknown) => {
            toast.error(getApiErrorMessage(err, "Failed to update user"))
        }
    })

    const handleEditClick = (user: ApiUser) => {
        setUserToEdit(user)
        const userRole = user.roles?.[0];
        const roleId = typeof userRole === 'object' ? userRole.role?.id ?? userRole.id ?? "" : "";
        
        setEditFormData({
            name: user.name || "",
            email: user.email || "",
            phone: user.phoneNumber || user.phone || "",
            roleId: roleId || ""
        })
        setIsEditModalOpen(true)
    }

    const getRoleName = (roles: UserRoleRef[] | undefined): string => {
        if (!roles || roles.length === 0) return 'User';
        const firstRole = roles[0];
        if (typeof firstRole === 'string') return firstRole;
        if (firstRole && typeof firstRole === 'object') {
            if (firstRole.role && typeof firstRole.role.name === 'string') {
                return firstRole.role.name;
            }
            if (typeof firstRole.name === 'string') {
                return firstRole.name;
            }
        }
        return 'User';
    }

    const totalPages = Math.ceil(visibleUsers.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const currentUsers = visibleUsers.slice(startIndex, startIndex + itemsPerPage)

    const handlePrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
    const handleNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))
    const handlePageClick = (pageNumber: number) => setCurrentPage(pageNumber)

    return (
        <div className="flex flex-col gap-6">
            {/* Page Header */}
            <div>
                <h1 className="text-xl font-semibold text-foreground tracking-tight">Manage Users</h1>
                <p className="text-sm text-muted-foreground mt-0.5">View, edit, and manage all users registered on the platform</p>
            </div>

            {/* Contacts Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-foreground">Registered Users</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left md:min-w-175">
                        <thead className="hidden md:table-header-group">
                            <tr className="border-b border-border">
                                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">S.No</th>
                                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Contact Details</th>
                                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border block md:table-row-group">
                            {isLoading ? (
                                Array.from({ length: 5 }, (_, i) => (
                                    <tr key={i} className="block md:table-row p-4 md:p-0">
                                        <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4"><div className="h-4 w-6 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 60}ms` }} /></td>
                                        <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4"><div className="h-4 w-28 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 60}ms` }} /></td>
                                        <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="h-4 w-40 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                                                <div className="h-3 w-24 bg-muted/60 rounded animate-pulse" style={{ animationDelay: `${i * 60 + 30}ms` }} />
                                            </div>
                                        </td>
                                        <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4"><div className="h-4 w-20 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 60}ms` }} /></td>
                                        <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4"><div className="h-6 w-16 bg-muted rounded-md animate-pulse" style={{ animationDelay: `${i * 60}ms` }} /></td>
                                        <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4 border-t border-border md:border-none mt-2 md:mt-0">
                                            <div className="flex gap-2 md:justify-center">
                                                <div className="h-8 w-12 bg-muted rounded-md animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                                                <div className="h-8 w-16 bg-muted rounded-md animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : visibleUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <div className="py-12 text-center text-sm text-muted-foreground">No users found.</div>
                                    </td>
                                </tr>
                            ) : (
                                currentUsers.map((user, index) => {
                                    const roleName = formatRoleName(getRoleName(user.roles));
                                    const userStatus = user.status || (user.isPasswordSet ? 'Active' : 'Pending');
                                    const userName = user.name || user.email.split('@')[0];

                                    return (
                                        <tr key={user.id} className="block md:table-row hover:bg-accent/30 transition-colors p-4 md:p-0">
                                            <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                                                <div className="flex md:block items-center justify-between gap-4">
                                                    <span className="md:hidden font-medium text-muted-foreground text-xs uppercase">S.No</span>
                                                    <span className="text-sm text-muted-foreground tabular-nums">{startIndex + index + 1}</span>
                                                </div>
                                            </td>
                                            <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                                                <div className="flex md:block items-center justify-between gap-4">
                                                    <span className="md:hidden font-medium text-muted-foreground text-xs uppercase">Name</span>
                                                    <span className="text-sm font-medium text-foreground text-right md:text-left">{userName}</span>
                                                </div>
                                            </td>
                                            <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                                                <div className="flex md:block items-center justify-between gap-4">
                                                    <span className="md:hidden font-medium text-muted-foreground text-xs uppercase">Contact</span>
                                                    <div className="flex flex-col text-right md:text-left">
                                                        <span className="text-sm text-foreground">{user.email}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">{user.phoneNumber || user.phone || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                                                <div className="flex md:block items-center justify-between gap-4">
                                                    <span className="md:hidden font-medium text-muted-foreground text-xs uppercase">Role</span>
                                                    <span className="text-sm text-foreground font-medium text-right md:text-left">{roleName}</span>
                                                </div>
                                            </td>
                                            <td className="block md:table-cell px-0 md:px-5 py-2 md:py-4">
                                                <div className="flex md:block items-center justify-between gap-4">
                                                    <span className="md:hidden font-medium text-muted-foreground text-xs uppercase">Status</span>
                                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                                                        userStatus === 'Active' ? 'bg-[#4ade80]/10 text-[#4ade80]' :
                                                        userStatus === 'Inactive' ? 'bg-red-500/10 text-red-500' :
                                                        'bg-amber-500/10 text-amber-500'
                                                    }`}>
                                                        {userStatus}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="block md:table-cell px-0 md:px-5 pt-4 pb-2 md:py-4 border-t border-border md:border-none mt-2 md:mt-0">
                                                <div className="flex flex-col sm:flex-row md:justify-center gap-2">
                                                    <button 
                                                        onClick={() => handleEditClick(user)}
                                                        className="h-9 md:h-8 px-3 text-sm md:text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap w-full sm:w-auto"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button 
                                                        onClick={() => setUserToDelete(user)}
                                                        className="h-9 md:h-8 px-3 text-sm md:text-xs font-medium rounded-md border border-red-500/20 text-red-500 bg-red-500/5 hover:bg-red-500/10 transition-colors whitespace-nowrap w-full sm:w-auto"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {visibleUsers.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-border text-xs text-muted-foreground gap-3">
                        <span>
                            Showing <span className="text-foreground font-medium">{startIndex + 1}</span> to{' '}
                            <span className="text-foreground font-medium">{Math.min(startIndex + itemsPerPage, visibleUsers.length)}</span> of{' '}
                            <span className="text-foreground font-medium">{visibleUsers.length}</span> entries
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={handlePrevPage}
                                disabled={currentPage === 1}
                                className="h-8 px-3 rounded-md border border-border text-muted-foreground text-xs hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => handlePageClick(page)}
                                    className={`h-8 w-8 rounded-md border text-xs transition-colors hidden sm:flex items-center justify-center ${currentPage === page
                                        ? 'bg-foreground text-background font-medium'
                                        : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                                        }`}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                                className="h-8 px-3 rounded-md border border-border text-muted-foreground text-xs hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit User Modal */}
            {isEditModalOpen && userToEdit && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/60 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-[500px] rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center pb-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-foreground">Edit User Details</h2>
                            <button
                                onClick={() => {
                                    setIsEditModalOpen(false)
                                    setUserToEdit(null)
                                }}
                                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={(e) => {
                            e.preventDefault()
                            editUserMutation.mutate({
                                id: userToEdit.id,
                                payload: {
                                    name: editFormData.name,
                                    email: editFormData.email,
                                    phoneNumber: editFormData.phone,
                                },
                                roleIds: []
                            })
                        }} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                    <UserIcon className="size-3.5" /> Full Name
                                </label>
                                <input
                                    type="text"
                                    className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editFormData.name}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                    <Mail className="size-3.5" /> Email Address
                                </label>
                                <input
                                    type="email"
                                    className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editFormData.email}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                    <Phone className="size-3.5" /> Phone Number
                                </label>
                                <input
                                    type="text"
                                    className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    value={editFormData.phone}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                                />
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditModalOpen(false)
                                        setUserToEdit(null)
                                    }}
                                    className="h-9 px-4 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editUserMutation.isPending}
                                    className="h-9 px-4 bg-foreground text-background hover:opacity-90 rounded-md text-sm font-medium transition-colors"
                                >
                                    {editUserMutation.isPending ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete User Modal */}
            {userToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/60 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-[450px] rounded-xl border border-border bg-card p-6 shadow-xl animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setUserToDelete(null)}
                            className="absolute right-4 top-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                            <X className="size-4" />
                        </button>

                        <div className="flex flex-col text-left mt-1 mb-6">
                            <h2 className="text-lg font-semibold text-foreground mb-2">Delete User</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Are you sure you want to delete <span className="font-semibold text-foreground">{userToDelete.name || userToDelete.email}</span>? This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 w-full">
                            <button
                                onClick={() => setUserToDelete(null)}
                                className="h-9 px-4 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    deleteUserMutation.mutate(userToDelete.id, {
                                        onSuccess: () => {
                                            setUserToDelete(null)
                                        }
                                    })
                                }}
                                disabled={deleteUserMutation.isPending}
                                className="h-9 px-4 bg-red-500 text-white hover:bg-red-600 rounded-md text-sm font-medium transition-colors"
                            >
                                {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Page
