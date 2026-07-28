import React, { useState, useEffect } from "react";
import { CampusUser } from "./types";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";

// Components
import LoginScreen from "./components/LoginScreen";
import DashboardScreen from "./components/DashboardScreen";
import WalletScreen from "./components/WalletScreen";
import PaymentScreen from "./components/PaymentScreen";
import HistoryScreen from "./components/HistoryScreen";
import TipsScreen from "./components/TipsScreen";
import AdminScreen from "./components/AdminScreen";
import DemoQRCodesScreen from "./components/DemoQRCodesScreen";
import ParentPortalScreen from "./components/ParentPortalScreen";
import NotificationCenter from "./components/NotificationCenter";
import AccessDeniedScreen from "./components/AccessDeniedScreen";
import UserProfileModal from "./components/UserProfileModal";
import SupportScreen from "./components/SupportScreen";

// Icons
import { 
  Wallet, 
  Home, 
  CreditCard, 
  QrCode, 
  History, 
  Sparkles, 
  ShieldAlert, 
  LogOut,
  Menu,
  X,
  Users,
  BellRing,
  User,
  ShieldCheck,
  ChevronDown,
  LifeBuoy
} from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<CampusUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scannedQrPayload, setScannedQrPayload] = useState<string | undefined>(undefined);
  const [selectedSupportTxId, setSelectedSupportTxId] = useState<string | undefined>(undefined);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleNavigate = (page: string, payload?: string) => {
    if (page === "qr-payment") {
      setScannedQrPayload(payload);
      setSelectedSupportTxId(undefined);
    } else if (page === "support") {
      setSelectedSupportTxId(payload);
      setScannedQrPayload(undefined);
    } else {
      setScannedQrPayload(undefined);
      setSelectedSupportTxId(undefined);
    }
    setCurrentPage(page);
  };

  // Helper to determine initial landing page based on role
  const getDefaultPageForRole = (role: string) => {
    switch (role) {
      case "parent":
        return "parent-portal";
      case "admin":
        return "admin";
      case "student":
      default:
        return "dashboard";
    }
  };

  // Listen for real-time authentication states
  useEffect(() => {
    let isInitialLoad = true;
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        // Authenticated! Now set up a real-time listener for the Firestore user document
        const userDocRef = doc(db, "users", authUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const walletVal = data.wallet !== undefined ? data.wallet : (data.balance !== undefined ? data.balance : 1000);
            const nameVal = data.name || data.displayName || authUser.displayName || "Campus Student";
            const loadedRole = data.role || "student";
            
            const formattedUser: CampusUser = {
              ...data,
              uid: authUser.uid,
              name: nameVal,
              displayName: nameVal,
              email: data.email || authUser.email || "",
              wallet: walletVal,
              balance: walletVal,
              role: loadedRole,
            } as CampusUser;

            setCurrentUser(formattedUser);

            // On initial login, route to role's designated dashboard
            if (isInitialLoad) {
              setCurrentPage(getDefaultPageForRole(loadedRole));
              isInitialLoad = false;
            }
          } else {
            // Automatically create user document with wallet balance of ₹1000 when missing
            const newUser: CampusUser = {
              uid: authUser.uid,
              name: authUser.displayName || "Campus Student",
              displayName: authUser.displayName || "Campus Student",
              email: authUser.email || "",
              wallet: 1000,
              balance: 1000,
              role: "student",
              studentId: "S" + Math.floor(100000 + Math.random() * 900000),
              createdAt: Date.now(),
            };
            try {
              await setDoc(userDocRef, newUser);
              setCurrentUser(newUser);
              if (isInitialLoad) {
                setCurrentPage("dashboard");
                isInitialLoad = false;
              }
            } catch (err) {
              console.error("Error creating user doc:", err);
            }
          }
          setAuthLoading(false);
        }, (err) => {
          console.error("Firestore snapshot error:", err);
          setAuthLoading(false);
        });

        return () => unsubscribeUser();
      } else {
        setCurrentUser(null);
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setCurrentPage("dashboard");
      setIsProfileOpen(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleRefreshUser = (updatedUser: Partial<CampusUser>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updatedUser } as CampusUser);
    }
  };

  const renderActivePage = () => {
    if (!currentUser) return null;

    // Protected Route Enforcement:
    // Only Admin role can access 'admin' screen
    if (currentPage === "admin" && currentUser.role !== "admin") {
      return (
        <AccessDeniedScreen 
          user={currentUser} 
          attemptedPage="admin" 
          onNavigate={handleNavigate} 
        />
      );
    }

    switch (currentPage) {
      case "dashboard":
        return <DashboardScreen user={currentUser} onNavigate={handleNavigate} />;
      case "add-money":
        return (
          <WalletScreen 
            user={currentUser} 
            onRefreshUser={handleRefreshUser} 
            onNavigate={handleNavigate} 
          />
        );
      case "qr-payment":
        return (
          <PaymentScreen 
            user={currentUser} 
            onRefreshUser={handleRefreshUser} 
            onNavigate={handleNavigate} 
            initialQrData={scannedQrPayload}
          />
        );
      case "demo-qr":
        return <DemoQRCodesScreen onNavigate={handleNavigate} />;
      case "history":
        return <HistoryScreen user={currentUser} onNavigate={handleNavigate} />;
      case "ai-tips":
        return (
          <TipsScreen 
            user={currentUser} 
            onRefreshUser={handleRefreshUser} 
            onNavigate={handleNavigate} 
          />
        );
      case "parent-portal":
        return <ParentPortalScreen user={currentUser} onNavigate={handleNavigate} />;
      case "support":
        return (
          <SupportScreen 
            user={currentUser} 
            onNavigate={handleNavigate} 
            preselectedTransactionId={selectedSupportTxId} 
          />
        );
      case "admin":
        return <AdminScreen user={currentUser} onNavigate={handleNavigate} />;
      default:
        return <DashboardScreen user={currentUser} onNavigate={handleNavigate} />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center gap-3">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white shadow-md">
          <Wallet className="h-6 w-6 animate-pulse" />
        </div>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
          Syncing Role & Security Credentials...
        </span>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen onLoginSuccess={(user) => {
        setCurrentUser(user);
        setCurrentPage(getDefaultPageForRole(user.role));
      }} />
    );
  }

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "add-money", label: "Add Money", icon: CreditCard },
    { id: "qr-payment", label: "Scan & Pay QR", icon: QrCode },
    { id: "parent-portal", label: "Parent Portal", icon: Users },
    { id: "demo-qr", label: "Demo Merchant QRs", icon: QrCode },
    { id: "history", label: "Account Statement", icon: History },
    { id: "support", label: "Raise Query", icon: LifeBuoy },
    { id: "ai-tips", label: "AI Spending Tips", icon: Sparkles },
    ...(currentUser.role === "admin" ? [{ id: "admin", label: "Dean Control", icon: ShieldAlert }] : []),
  ];

  const getRoleBadgeStyle = (r: string) => {
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* User Profile Modal */}
      <UserProfileModal
        user={currentUser}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
      />

      {/* Top University Branding Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-extrabold text-blue-900 tracking-tight block">CampEX 2.0</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block -mt-0.5">Smart Campus Wallet</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isActive 
                      ? "bg-blue-50 text-blue-700 font-black" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            <NotificationCenter user={currentUser} onNavigate={handleNavigate} />

            {/* Profile Section Trigger Button */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2.5 p-1.5 pl-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition text-left group"
              title="Click to view User Profile & Role details"
            >
              {(currentUser.photoURL || currentUser.profilePic) ? (
                <img 
                  src={currentUser.photoURL || currentUser.profilePic} 
                  alt={currentUser.displayName || currentUser.name} 
                  className="h-7 w-7 rounded-lg object-cover shrink-0 border border-slate-200"
                />
              ) : (
                <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                  {(currentUser.displayName || currentUser.name || "U")[0].toUpperCase()}
                </div>
              )}

              <div className="hidden sm:block text-left pr-1">
                <span className="text-xs font-bold text-slate-800 block leading-tight truncate max-w-[120px]">
                  {currentUser.displayName || currentUser.name}
                </span>
                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border block mt-0.5 w-max ${getRoleBadgeStyle(currentUser.role)}`}>
                  {currentUser.role}
                </span>
              </div>

              <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition" />
            </button>

            <button
              onClick={handleLogout}
              className="p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition"
              title="Logout from CampEX 2.0"
            >
              <LogOut className="h-5 w-5" />
            </button>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="lg:hidden bg-white border-b border-slate-100 px-4 py-3 space-y-1 sticky top-16 z-30 shadow-sm"
          >
            {/* User Profile Summary in Mobile Drawer */}
            <div 
              onClick={() => {
                setMobileMenuOpen(false);
                setIsProfileOpen(true);
              }}
              className="p-3 mb-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                {(currentUser.photoURL || currentUser.profilePic) ? (
                  <img 
                    src={currentUser.photoURL || currentUser.profilePic} 
                    alt={currentUser.displayName || currentUser.name} 
                    className="h-8 w-8 rounded-lg object-cover shrink-0 border border-slate-200"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {(currentUser.displayName || currentUser.name || "U")[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold text-slate-900 block">{currentUser.displayName || currentUser.name}</span>
                  <span className="text-[10px] text-slate-500 block font-mono">{currentUser.email}</span>
                </div>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${getRoleBadgeStyle(currentUser.role)}`}>
                {currentUser.role}
              </span>
            </div>

            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-2.5 ${
                    isActive 
                      ? "bg-blue-50 text-blue-700 font-black" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? "text-blue-600" : "text-slate-400"}`} />
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace Frame */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Live Notification Banner if latestNotification is present */}
        {currentUser.latestNotification && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md border border-emerald-500/30 flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
                <BellRing className="h-5 w-5 text-white animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  {currentUser.latestNotification.title}
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-200 border border-emerald-400/30">
                    Live Firestore Alert
                  </span>
                </h4>
                <p className="text-xs text-emerald-100 font-medium mt-0.5">
                  {currentUser.latestNotification.message}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                handleRefreshUser({ latestNotification: undefined });
              }}
              className="text-xs font-bold px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white transition shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {renderActivePage()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Subtle Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            BlueRidge State University Smart Card & Finance Systems
          </p>
          <p className="text-[10px] text-slate-400">
            Role-Based Security & Ledger operations powered by Firebase Firestore. Signed in as <strong className="text-slate-600 font-bold">{currentUser.email}</strong> ({currentUser.role}).
          </p>
        </div>
      </footer>
    </div>
  );
}

