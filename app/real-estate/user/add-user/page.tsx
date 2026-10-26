"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, Phone, Lock, User, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/store/authStore";
import { userApi, type CreateUserPayload } from "@/app/api/api";
import { getApiErrorMessage } from "@/app/api/errors";
import { toast } from "sonner";


export default function AddUserPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "phone") {
      const numericValue = value.replace(/\D/g, "");
      setFormData((prev) => ({ ...prev, [name]: numericValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Fetch all roles
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => userApi.getRoles(),
  });

  // Filter roles based on user permissions/role and tenantId
  const filteredRoles = useMemo(() => {
    if (!roles) return [];
    
    const firstUserRole = user?.roles?.[0];
    const loggedInUserRoleName = typeof firstUserRole === "string"
      ? firstUserRole
      : (firstUserRole?.role?.name || firstUserRole?.name || "");
    const normalizedLoggedInRole = loggedInUserRoleName.toLowerCase().replace(/_/g, "").replace(/\s/g, "");
    const isSuperAdmin = normalizedLoggedInRole === "superadmin" || normalizedLoggedInRole === "super_admin";

    return roles.filter((role) => {
      const nameLower = role.name.toLowerCase().replace(/_/g, "").replace(/\s/g, "");
      
      // Regular admins shouldn't create superadmins
      if (nameLower === "superadmin" && !isSuperAdmin) {
        return false;
      }
      
      // Return system roles or roles belonging to this tenant
      return role.isSystem || role.tenantId === user?.tenantId;
    });
  }, [roles, user]);

  // Auto-select a default role when the list loads
  useEffect(() => {
    if (filteredRoles.length > 0 && !selectedRoleId) {
      // Prefer sales_executive as a default, otherwise choose first role that is not admin/super_admin
      const defaultRole = 
        filteredRoles.find((r) => r.name.toLowerCase() === "sales_executive") ||
        filteredRoles.find((r) => !r.name.toLowerCase().includes("admin")) ||
        filteredRoles[0];

      if (defaultRole) {
        Promise.resolve().then(() => {
          setSelectedRoleId(defaultRole.id);
        });
      }
    }
  }, [filteredRoles, selectedRoleId]);

  const createUserMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => userApi.createUser(payload),
    onSuccess: () => {
      toast.success("User created successfully!");
      setFormData({
        name: "",
        phone: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      router.push("/real-estate/user/manage-users");
    },
    onError: (error: unknown) => {
      console.error("Create User Error:", error);
      toast.error(getApiErrorMessage(error, "Failed to create user"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (!selectedRoleId) {
      toast.error("Please select a role for the user");
      return;
    }

    const payload = {
      name: formData.name,
      email: formData.email,
      phoneNumber: formData.phone,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      tenantId: user?.tenantId,
      roleId: selectedRoleId,
    };

    console.log("Payload:", payload);

    createUserMutation.mutate(payload);
  };

  const isLoading = createUserMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Add User</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Create a new user account by filling out the details below.
        </p>
      </div>

      {/* User Details Form Container */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex justify-between items-center">
          <h2 className="text-sm font-semibold text-foreground">User Details</h2>
          <span className="text-xs text-destructive font-medium">* All fields are mandatory</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="size-3.5 text-muted-foreground" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>

              {/* Phone Number Field */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="size-3.5 text-muted-foreground" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  maxLength={10}
                  required
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john.doe@example.com"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="size-3.5 text-muted-foreground" />
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                  <Lock className="size-3.5 text-muted-foreground" />
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                />
              </div>

            </div>
          </div>

          <div className="px-5 py-4 border-t border-border flex items-center justify-end bg-muted/10">
            <Button type="submit" disabled={isLoading} className="gap-2">
              <Send className="size-4" />
              {isLoading ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
