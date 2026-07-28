import React from "react";
import { CampusUser } from "../types";
import { ShieldAlert, ArrowLeft, Lock, UserCheck, Key, ShieldX } from "lucide-react";

interface AccessDeniedScreenProps {
  user: CampusUser;
  attemptedPage: string;
  onNavigate: (page: string) => void;
}

export default function AccessDeniedScreen({ user, attemptedPage, onNavigate }: AccessDeniedScreenProps) {
  const getRoleDashboard = () => {
    switch (user.role) {
      case "parent":
        return "parent-portal";
      case "admin":
        return "admin";
      case "student":
      default:
        return "dashboard";
    }
  };

  const getRoleDashboardLabel = () => {
    switch (user.role) {
      case "parent":
        return "Parent Portal";
      case "admin":
        return "Admin Control Panel";
      case "student":
      default:
        return "Student Dashboard";
    }
  };

  const formattedPageName = attemptedPage === "admin" 
    ? "Dean Administrative Control Panel" 
    : attemptedPage === "parent-portal" 
      ? "Parent Supervision Portal"
      : attemptedPage;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
      {/* Icon Badge */}
      <div className="mx-auto h-20 w-20 rounded-3xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm animate-bounce">
        <ShieldX className="h-10 w-10" />
      </div>

      {/* Main Warning Title */}
      <div className="space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
          <Lock className="h-3.5 w-3.5" /> 403 Forbidden Access
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Access Denied
        </h1>
        <p className="text-sm text-slate-600 max-w-lg mx-auto">
          You do not have administrative privileges to view the <strong className="text-slate-900 font-bold">{formattedPageName}</strong>.
        </p>
      </div>

      {/* User Role Details Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 text-left shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Identity Context</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wide bg-blue-100 text-blue-800 border border-blue-200">
            {user.role} Role
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block font-medium mb-0.5">Logged-In User</span>
            <span className="font-bold text-slate-800 block truncate">{user.displayName || user.name}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-slate-400 block font-medium mb-0.5">Email Address</span>
            <span className="font-bold text-slate-800 block truncate">{user.email}</span>
          </div>
        </div>

        {/* Security Rule Explanation */}
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-900 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <Key className="h-4 w-4 text-amber-700" /> Security Policy Enforced
          </div>
          <p className="text-amber-800 text-[11px] leading-relaxed">
            CampEX 2.0 applies strict Role-Based Access Control (RBAC). Only authenticated university administrators with the <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-950">admin</code> role can view or manage administrative controls.
          </p>
        </div>
      </div>

      {/* Safe Return Navigation CTA */}
      <div className="pt-2">
        <button
          onClick={() => onNavigate(getRoleDashboard())}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-md transition active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to {getRoleDashboardLabel()}</span>
        </button>
      </div>
    </div>
  );
}
