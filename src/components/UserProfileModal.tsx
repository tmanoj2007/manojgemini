import React, { useState, useRef } from "react";
import { CampusUser, UserRole } from "../types";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { 
  User, 
  Mail, 
  ShieldCheck, 
  LogOut, 
  X, 
  Wallet, 
  IdCard, 
  CheckCircle2, 
  Sparkles, 
  Loader2,
  RefreshCw,
  Phone,
  Store,
  Camera,
  Upload,
  Link as LinkIcon,
  Trash2,
  Image as ImageIcon
} from "lucide-react";

interface UserProfileModalProps {
  user: CampusUser;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onNavigate: (page: string) => void;
}

const PRESET_AVATARS = [
  { id: "cw-gradient", name: "CampEX 2.0", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><defs><linearGradient id='bg' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231e40af'/><stop offset='100%' stop-color='%233b82f6'/></linearGradient></defs><rect width='200' height='200' rx='40' fill='url(%23bg)'/><text x='50%' y='54%' font-family='system-ui, sans-serif' font-weight='900' font-size='64' fill='%23ffffff' text-anchor='middle' dominant-baseline='middle'>CX</text></svg>" },
  { id: "scholar", name: "Scholar", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80" },
  { id: "techie", name: "Techie", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80" },
  { id: "creative", name: "Creative", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80" },
  { id: "robot", name: "Campus Bot", url: "https://api.dicebear.com/7.x/bottts/svg?seed=Campus" },
  { id: "mascot", name: "Student", url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Student" },
];

export default function UserProfileModal({
  user,
  isOpen,
  onClose,
  onLogout,
  onNavigate,
}: UserProfileModalProps) {
  const [updatingRole, setUpdatingRole] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const currentWallet = user.wallet !== undefined ? user.wallet : (user.balance !== undefined ? user.balance : 1000);
  const userPhoto = user.photoURL || user.profilePic;

  // Save photoURL to Firestore user document
  const handleSavePhoto = async (photoUrl: string | null) => {
    setUpdatingPhoto(true);
    setSuccessMsg("");
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { 
        photoURL: photoUrl || null,
        profilePic: photoUrl || null
      });
      setSuccessMsg(photoUrl ? "Profile picture updated successfully!" : "Profile picture removed!");
      setShowPhotoPicker(false);
      setCustomPhotoUrl("");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error updating profile photo:", err);
    } finally {
      setUpdatingPhoto(false);
    }
  };

  // Process uploaded image file into compressed base64 data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create offscreen canvas for resize
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        handleSavePhoto(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Quick switch role for testing RBAC dynamically
  const handleRoleSwitch = async (newRole: UserRole) => {
    if (newRole === user.role) return;
    setUpdatingRole(true);
    setSuccessMsg("");
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { role: newRole });
      setSuccessMsg(`Account role successfully updated to ${newRole.toUpperCase()}!`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error updating role:", err);
    } finally {
      setUpdatingRole(false);
    }
  };

  const getRoleBadgeStyle = (r: UserRole) => {
    switch (r) {
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "parent":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "merchant":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "student":
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* Profile Avatar with Camera Button Overlay */}
            <div className="relative group shrink-0">
              <div className="h-16 w-16 rounded-2xl bg-white text-blue-800 flex items-center justify-center font-black text-2xl shadow-lg border-2 border-white/20 overflow-hidden">
                {userPhoto ? (
                  <img 
                    src={userPhoto} 
                    alt={user.displayName || user.name} 
                    className="h-full w-full object-cover" 
                  />
                ) : (
                  (user.displayName || user.name || "U")[0].toUpperCase()
                )}
              </div>
              <button
                onClick={() => setShowPhotoPicker(!showPhotoPicker)}
                className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-md border-2 border-white transition-transform active:scale-90"
                title="Change Profile Picture"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-lg truncate text-white leading-tight">
                {user.displayName || user.name}
              </h3>
              <p className="text-xs text-blue-100 truncate font-mono mt-0.5">
                {user.email}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border shadow-2xs ${getRoleBadgeStyle(user.role)}`}>
                  <ShieldCheck className="h-3 w-3" />
                  {user.role} Role
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content Body */}
        <div className="p-6 space-y-5">
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              {successMsg}
            </div>
          )}

          {/* Profile Picture Option Drawer/Section */}
          {showPhotoPicker && (
            <div className="bg-slate-50 border border-blue-200 rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  Update Profile Picture
                </h4>
                <button
                  onClick={() => setShowPhotoPicker(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Cancel
                </button>
              </div>

              {/* Upload file or Choose Preset */}
              <div className="space-y-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />

                <button
                  disabled={updatingPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-xs active:scale-98"
                >
                  {updatingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  <span>Upload Image from Device</span>
                </button>

                {/* Preset Avatars Grid */}
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-2">Or choose a campus avatar preset:</p>
                  <div className="grid grid-cols-6 gap-2">
                    {PRESET_AVATARS.map((avatar) => (
                      <button
                        key={avatar.id}
                        disabled={updatingPhoto}
                        onClick={() => handleSavePhoto(avatar.url)}
                        className="h-11 w-11 rounded-xl border border-slate-200 hover:border-blue-500 overflow-hidden hover:scale-105 transition shadow-2xs group relative bg-white"
                        title={avatar.name}
                      >
                        <img src={avatar.url} alt={avatar.name} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Photo URL Input */}
                <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-500">Or paste an Image URL:</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://example.com/photo.jpg"
                      value={customPhotoUrl}
                      onChange={(e) => setCustomPhotoUrl(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <button
                      disabled={!customPhotoUrl.trim() || updatingPhoto}
                      onClick={() => handleSavePhoto(customPhotoUrl.trim())}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Remove Picture option */}
                {userPhoto && (
                  <button
                    disabled={updatingPhoto}
                    onClick={() => handleSavePhoto(null)}
                    className="w-full text-center text-xs font-bold text-rose-600 hover:text-rose-700 py-1 flex items-center justify-center gap-1 mt-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove Profile Picture</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* User Details Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                User Profile Information
              </h4>
              <button
                onClick={() => setShowPhotoPicker(!showPhotoPicker)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>{userPhoto ? "Change Photo" : "Add Photo"}</span>
              </button>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" /> Full Name:
                </span>
                <span className="font-bold text-slate-900">{user.displayName || user.name}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> Email Address:
                </span>
                <span className="font-bold text-slate-900 truncate max-w-[180px]">{user.email}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> Assigned Role:
                </span>
                <span className="font-bold text-slate-900 capitalize">{user.role}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-slate-400" /> Wallet Balance:
                </span>
                <span className="font-black text-emerald-600">₹{currentWallet.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>

              {user.studentId && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <IdCard className="h-3.5 w-3.5 text-slate-400" /> Student Card No:
                  </span>
                  <span className="font-mono font-bold text-blue-700">{user.studentId}</span>
                </div>
              )}

              {user.merchantName && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Store className="h-3.5 w-3.5 text-slate-400" /> Merchant Outlet:
                  </span>
                  <span className="font-bold text-slate-900">{user.merchantName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Role Switcher for Testing Security */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Role Management (RBAC Test)
              </span>
              {updatingRole && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["student", "parent", "admin"] as UserRole[]).map((r) => (
                <button
                  key={r}
                  disabled={updatingRole}
                  onClick={() => handleRoleSwitch(r)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border capitalize transition-all ${
                    user.role === r
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Switching roles updates Firestore document <code className="text-slate-600 font-mono">users/{user.uid}</code> and dynamically recalculates route authorization.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
            <button
              onClick={() => {
                onClose();
                if (user.role === "admin") onNavigate("admin");
                else if (user.role === "parent") onNavigate("parent-portal");
                else onNavigate("dashboard");
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              My Dashboard
            </button>

            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

