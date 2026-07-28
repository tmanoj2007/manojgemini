import React, { useState, useEffect, useRef } from "react";
import { CampusUser, AppNotification, NotificationType } from "../types";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  addDoc
} from "firebase/firestore";
import { 
  Bell, 
  CheckCircle2, 
  Wallet, 
  AlertTriangle, 
  Users, 
  X, 
  CheckCheck, 
  Trash2, 
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Loader2
} from "lucide-react";

interface NotificationCenterProps {
  user: CampusUser;
  onNavigate?: (page: string) => void;
}

export default function NotificationCenter({ user, onNavigate }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. Real-time subscription to user's notifications in Firestore
  useEffect(() => {
    if (!user.uid) return;

    const notifRef = collection(db, "notifications");
    const q = query(
      notifRef, 
      where("userId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as AppNotification);

      // Sort client-side by timestamp descending
      list.sort((a, b) => b.timestamp - a.timestamp);

      setNotifications(list);
      setLoading(false);

      // If empty, seed initial sample notifications for demonstration
      if (list.length === 0 && user.role === "student") {
        seedInitialNotifications(user.uid, user.name || user.displayName || "Student");
      }
    }, (err) => {
      console.error("Error listening to notifications:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user.uid]);

  // Automatic Low Balance Trigger: Check if user balance < 100
  useEffect(() => {
    const currentBalance = user.wallet !== undefined ? user.wallet : (user.balance !== undefined ? user.balance : 1000);
    if (currentBalance < 100 && user.role === "student" && !loading) {
      const hasRecentLowBalNotif = notifications.some(
        n => n.type === "low_balance" && (Date.now() - n.timestamp) < 24 * 60 * 60 * 1000
      );

      if (!hasRecentLowBalNotif) {
        addDoc(collection(db, "notifications"), {
          userId: user.uid,
          title: "Low Wallet Balance Alert",
          message: `Warning: Your CampEX 2.0 Wallet balance is ₹${currentBalance.toFixed(2)}, which is below the ₹100 threshold. Please top up your wallet.`,
          type: "low_balance",
          amount: currentBalance,
          read: false,
          timestamp: Date.now()
        }).catch(err => console.error("Error creating low balance notification:", err));
      }
    }
  }, [user.wallet, user.balance, user.role, loading, notifications.length]);

  // Seed sample initial notifications
  const seedInitialNotifications = async (uid: string, name: string) => {
    const notifRef = collection(db, "notifications");
    const now = Date.now();

    const sampleNotifs = [
      {
        userId: uid,
        title: "Parent Added Money",
        message: "Robert Mercer added ₹1,000.00 to your CampEX 2.0 Wallet.",
        type: "parent_recharge",
        amount: 1000,
        read: false,
        timestamp: now - 1000 * 60 * 10, // 10 mins ago
      },
      {
        userId: uid,
        title: "Payment Successful",
        message: "Paid ₹120.00 at Campus Central Canteen via QR Code.",
        type: "payment_success",
        amount: 120,
        read: false,
        timestamp: now - 1000 * 60 * 45, // 45 mins ago
      },
      {
        userId: uid,
        title: "Money Added",
        message: "₹500.00 successfully added to your CampEX 2.0 Wallet via GPay.",
        type: "money_added",
        amount: 500,
        read: true,
        timestamp: now - 1000 * 60 * 60 * 3, // 3 hours ago
      },
      {
        userId: uid,
        title: "Low Wallet Balance Alert",
        message: "Warning: Your wallet balance is below ₹100. Top up to keep enjoying seamless cashless campus payments.",
        type: "low_balance",
        amount: 85,
        read: false,
        timestamp: now - 1000 * 60 * 60 * 5, // 5 hours ago
      }
    ];

    for (const notif of sampleNotifs) {
      await addDoc(notifRef, notif);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Filtered list
  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    return true;
  });

  // Mark single notification as read
  const handleMarkAsRead = async (notifId: string) => {
    try {
      const docRef = doc(db, "notifications", notifId);
      await updateDoc(docRef, { read: true });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        const ref = doc(db, "notifications", n.id);
        batch.update(ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  // Delete notification
  const handleDeleteNotif = async (notifId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const docRef = doc(db, "notifications", notifId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  // Format relative time helper
  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return "Just now";
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Helper for notification icon & style
  const getNotifStyle = (type: NotificationType) => {
    switch (type) {
      case "payment_success":
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
          bg: "bg-emerald-50 border-emerald-200 text-emerald-800",
          iconBg: "bg-emerald-100 text-emerald-600",
          badgeText: "Payment Success"
        };
      case "money_added":
        return {
          icon: <Wallet className="h-4 w-4 text-blue-600" />,
          bg: "bg-blue-50 border-blue-200 text-blue-800",
          iconBg: "bg-blue-100 text-blue-600",
          badgeText: "Money Added"
        };
      case "low_balance":
        return {
          icon: <AlertTriangle className="h-4 w-4 text-rose-600" />,
          bg: "bg-rose-50 border-rose-200 text-rose-800",
          iconBg: "bg-rose-100 text-rose-600",
          badgeText: "Low Balance"
        };
      case "parent_recharge":
        return {
          icon: <Users className="h-4 w-4 text-amber-600" />,
          bg: "bg-amber-50 border-amber-200 text-amber-800",
          iconBg: "bg-amber-100 text-amber-600",
          badgeText: "Parent Top-Up"
        };
      default:
        return {
          icon: <Bell className="h-4 w-4 text-slate-600" />,
          bg: "bg-slate-50 border-slate-200 text-slate-800",
          iconBg: "bg-slate-100 text-slate-600",
          badgeText: "System Alert"
        };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all focus:outline-none border border-slate-200 active:scale-95 flex items-center justify-center"
        title="In-App Notifications"
        aria-label="In-App Notifications"
      >
        <Bell className="h-5 w-5 text-slate-700" />
        
        {/* Unread Count Red/Amber Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white animate-bounce shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-slate-200/80 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Panel Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-400" />
              <h3 className="font-black text-sm text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3 w-3 text-emerald-400" /> Read All
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/70 text-xs font-bold px-3 pt-2">
            <button
              onClick={() => setFilter("all")}
              className={`pb-2 px-3 border-b-2 transition ${
                filter === "all"
                  ? "border-blue-600 text-blue-700 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`pb-2 px-3 border-b-2 transition ${
                filter === "unread"
                  ? "border-blue-600 text-blue-700 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications Scrollable List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="py-8 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                Loading alerts...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  {filter === "unread" ? "No unread notifications!" : "No notifications yet."}
                </p>
                <p className="text-[11px] text-slate-400">
                  Updates regarding transactions, parent recharges, & low wallet warnings will appear here.
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const style = getNotifStyle(notif.type);
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleMarkAsRead(notif.id)}
                    className={`p-3.5 transition flex items-start gap-3 relative cursor-pointer group ${
                      !notif.read ? "bg-amber-50/40 hover:bg-amber-50/70" : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {!notif.read && (
                      <span className="absolute left-1.5 top-4 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
                    )}

                    {/* Icon Badge */}
                    <div className={`p-2 rounded-xl shrink-0 ${style.iconBg}`}>
                      {style.icon}
                    </div>

                    {/* Text Details */}
                    <div className="flex-grow min-w-0 pr-6 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className={`text-xs font-black truncate ${!notif.read ? "text-slate-900" : "text-slate-700"}`}>
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {formatTimeAgo(notif.timestamp)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-snug break-words">
                        {notif.message}
                      </p>

                      <div className="pt-1 flex items-center justify-between">
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${style.bg}`}>
                          {style.badgeText}
                        </span>

                        {notif.type === "low_balance" && onNavigate && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOpen(false);
                              onNavigate("add-money");
                            }}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-0.5 underline"
                          >
                            Add Money <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Delete Individual Notification */}
                    <button
                      onClick={(e) => handleDeleteNotif(notif.id, e)}
                      className="absolute right-2 top-3 p-1 text-slate-300 hover:text-rose-600 rounded opacity-0 group-hover:opacity-100 transition"
                      title="Delete notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Real-time Firestore Alerts</span>
            {onNavigate && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onNavigate("history");
                }}
                className="font-bold text-blue-600 hover:text-blue-800"
              >
                View Account Statement
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
