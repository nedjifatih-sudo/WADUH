"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Profile, Organization, OrganizationMember, UserRole } from "@/types";
import { AppPermission, hasPermission, isAtLeastRole } from "@/lib/permissions/roles";
import { toast } from "sonner";

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  currentOrg: Organization | null;
  currentRole: UserRole | null;
  memberships: (OrganizationMember & { organization: Organization })[];
  isLoading: boolean;
  switchOrganization: (orgId: string) => void;
  can: (permission: AppPermission) => boolean;
  isRole: (role: UserRole) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  currentOrg: null,
  currentRole: null,
  memberships: [],
  isLoading: true,
  switchOrganization: () => {},
  can: () => false,
  isRole: () => false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const supabase = createClient();

  const loadUserData = async (currentUser: any) => {
    try {
      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setCurrentOrg(null);
        setCurrentRole(null);
        setMemberships([]);
        setIsLoading(false);
        return;
      }

      setUser(currentUser);

      // Fetch profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (prof) {
        setProfile(prof);
      } else {
        // Fallback profile if just created
        setProfile({
          id: currentUser.id,
          full_name: currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "User",
          email: currentUser.email || "",
          avatar_url: currentUser.user_metadata?.avatar_url || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Fetch organization memberships
      const { data: memberRows, error: memberErr } = await supabase
        .from("organization_members")
        .select("*, organization:organizations(*)")
        .eq("user_id", currentUser.id);

      if (memberRows && memberRows.length > 0) {
        setMemberships(memberRows);

        // Check stored preferred org in localStorage
        const storedOrgId = typeof window !== "undefined" ? localStorage.getItem("inventory_os_org_id") : null;
        const matchingMembership = memberRows.find((m) => m.organization_id === storedOrgId) || memberRows[0];

        setCurrentOrg(matchingMembership.organization);
        setCurrentRole(matchingMembership.role);
        if (typeof window !== "undefined") {
          localStorage.setItem("inventory_os_org_id", matchingMembership.organization_id);
        }
      } else {
        // Fallback default organization for initial onboarding / demo
        const defaultOrgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || "11111111-1111-1111-1111-111111111111";
        const { data: defaultOrg } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", defaultOrgId)
          .maybeSingle();

        if (defaultOrg) {
          setCurrentOrg(defaultOrg);
          setCurrentRole("super_admin");
        }
      }
    } catch (err) {
      console.error("Error loading user profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserData(session?.user || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUserData(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const switchOrganization = (orgId: string) => {
    const target = memberships.find((m) => m.organization_id === orgId);
    if (target) {
      setCurrentOrg(target.organization);
      setCurrentRole(target.role);
      localStorage.setItem("inventory_os_org_id", target.organization_id);
      toast.success(`Switched to ${target.organization.name}`);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCurrentOrg(null);
    setCurrentRole(null);
    setMemberships([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("inventory_os_org_id");
      window.location.href = "/login";
    }
  };

  const can = (permission: AppPermission): boolean => {
    return hasPermission(currentRole, permission);
  };

  const isRole = (role: UserRole): boolean => {
    return isAtLeastRole(currentRole, role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        currentOrg,
        currentRole,
        memberships,
        isLoading,
        switchOrganization,
        can,
        isRole,
        signOut,
        refreshProfile: () => loadUserData(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
