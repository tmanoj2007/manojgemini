import React, { useState, useEffect, useMemo } from "react";
import { CampusUser, Transaction } from "../types";
import { db } from "../firebase";
import { collection, doc, runTransaction, onSnapshot, updateDoc } from "firebase/firestore";
import { SupportQuery } from "../types";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  AreaChart, 
  Area 
} from "recharts";
import { 
  ArrowLeft, 
  ShieldAlert, 
  Users, 
  TrendingUp, 
  Coins, 
  Loader2, 
  CheckCircle2, 
  Coffee, 
  Send,
  History,
  Calendar,
  Building2,
  Search,
  Filter,
  DollarSign,
  Wallet
} from "lucide-react";

interface AdminScreenProps {
  user: CampusUser;
  onNavigate: (page: string) => void;
}

export default function AdminScreen({ user, onNavigate }: AdminScreenProps) {
  const [users, setUsers] = useState<CampusUser[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Grant emergency aid form state
  const [targetStudentId, setTargetStudentId] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantReason, setGrantReason] = useState("Semester Hardship stipend assistance");
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantSuccess, setGrantSuccess] = useState(false);
  const [error, setError] = useState("");

  // Search/Filter for Recent Transactions
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Support queries state
  const [supportQueries, setSupportQueries] = useState<SupportQuery[]>([]);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);

  useEffect(() => {
    // Listen to real-time users from Firestore
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const uList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }) as CampusUser);
      setUsers(uList);
    });

    // Listen to real-time transactions from Firestore
    const unsubTxs = onSnapshot(collection(db, "transactions"), (snapshot) => {
      const tList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction)
        .sort((a, b) => b.timestamp - a.timestamp);
      setTransactions(tList);
      setLoading(false);
    });

    // Listen to real-time support queries from Firestore
    const unsubQueries = onSnapshot(collection(db, "support_queries"), (snapshot) => {
      const qList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SupportQuery)
        .sort((a, b) => b.createdAt - a.createdAt);
      setSupportQueries(qList);
    });

    return () => {
      unsubUsers();
      unsubTxs();
      unsubQueries();
    };
  }, []);

  const handleUpdateTicket = async (ticketId: string, newStatus: string, adminNotes: string) => {
    setUpdatingTicketId(ticketId);
    try {
      const ticketRef = doc(db, "support_queries", ticketId);
      await updateDoc(ticketRef, {
        status: newStatus,
        adminNotes: adminNotes,
        updatedAt: Date.now(),
      });
      setUpdatingTicketId(null);
    } catch (err) {
      console.error("Failed to update ticket:", err);
      setUpdatingTicketId(null);
    }
  };

  // --- COMPUTED DASHBOARD METRICS ---

  // 1. Total Students
  const totalStudents = useMemo(() => {
    return users.filter(u => u.role === "student" || (!u.role && u.studentId)).length || users.length;
  }, [users]);

  // 2. Active Wallets
  const activeWalletsCount = useMemo(() => {
    const studentUsers = users.filter(u => u.role === "student" || (!u.role && u.studentId));
    const active = studentUsers.filter(u => (u.wallet ?? u.balance ?? 0) > 0);
    return active.length || studentUsers.length;
  }, [users]);

  // 3. Total Wallet Balance across all student accounts
  const totalWalletBalance = useMemo(() => {
    return users
      .filter(u => u.role === "student" || (!u.role && u.studentId))
      .reduce((sum, u) => sum + (u.wallet ?? u.balance ?? 0), 0);
  }, [users]);

  // 4. Today's Transactions
  const todayTransactions = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayTxs = transactions.filter(t => new Date(t.timestamp).toDateString() === todayStr);
    const amount = todayTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
    return { count: todayTxs.length, amount };
  }, [transactions]);

  // 5. Total Revenue (total turnover in Rupees)
  const totalRevenue = useMemo(() => {
    return transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions]);

  // 6. Top Merchants ranking
  const topMerchants = useMemo(() => {
    const merchantMap: { [name: string]: { name: string; revenue: number; count: number; category: string } } = {};

    transactions.forEach(t => {
      if (t.type === "merchant_payment" || t.merchant) {
        const mName = t.merchant || t.receiverName || "Campus Outlet";
        if (!merchantMap[mName]) {
          merchantMap[mName] = { name: mName, revenue: 0, count: 0, category: t.category || "General" };
        }
        merchantMap[mName].revenue += t.amount || 0;
        merchantMap[mName].count += 1;
      }
    });

    return Object.values(merchantMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [transactions]);

  // 6. Daily Revenue Chart Data (Last 7 Days)
  const dailyChartData = useMemo(() => {
    const days: { [dateStr: string]: { dayLabel: string; revenue: number; count: number; timestamp: number } } = {};

    // Initialize past 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toDateString();
      const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
      days[dateKey] = { dayLabel, revenue: 0, count: 0, timestamp: d.getTime() };
    }

    // Populate transaction data
    transactions.forEach(t => {
      const tDateKey = new Date(t.timestamp).toDateString();
      if (days[tDateKey]) {
        days[tDateKey].revenue += t.amount || 0;
        days[tDateKey].count += 1;
      }
    });

    return Object.values(days).sort((a, b) => a.timestamp - b.timestamp);
  }, [transactions]);

  // 7. Monthly Revenue Chart Data (Last 6 Months)
  const monthlyChartData = useMemo(() => {
    const months: { [monthKey: string]: { monthLabel: string; revenue: number; count: number } } = {};

    // Initialize past 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      const monthLabel = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      months[monthKey] = { monthLabel, revenue: 0, count: 0 };
    }

    // Populate transaction data
    transactions.forEach(t => {
      const d = new Date(t.timestamp);
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      if (months[monthKey]) {
        months[monthKey].revenue += t.amount || 0;
        months[monthKey].count += 1;
      }
    });

    return Object.values(months);
  }, [transactions]);

  // Filtered recent transactions list
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesCategory = selectedCategory === "all" || (t.category || "").toLowerCase().includes(selectedCategory.toLowerCase());
      const queryLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (t.senderName || "").toLowerCase().includes(queryLower) ||
        (t.receiverName || "").toLowerCase().includes(queryLower) ||
        (t.description || "").toLowerCase().includes(queryLower) ||
        (t.merchant || "").toLowerCase().includes(queryLower);

      return matchesCategory && matchesSearch;
    });
  }, [transactions, searchQuery, selectedCategory]);

  // Emergency Grant Handler
  const handleGrantAid = async (e: React.FormEvent) => {
    e.preventDefault();
    const grantAmt = parseFloat(grantAmount);
    if (!targetStudentId) {
      setError("Please select a student wallet to receive aid.");
      return;
    }
    if (isNaN(grantAmt) || grantAmt <= 0) {
      setError("Please specify a valid grant amount.");
      return;
    }

    setGrantLoading(true);
    setError("");

    try {
      const studentRef = doc(db, "users", targetStudentId);
      
      await runTransaction(db, async (transaction) => {
        const studentDoc = await transaction.get(studentRef);
        if (!studentDoc.exists()) {
          throw new Error("Target student does not exist.");
        }

        const data = studentDoc.data();
        const currentBal = data.wallet !== undefined ? data.wallet : (data.balance !== undefined ? data.balance : 1000);
        const studentName = data.name || data.displayName || "Student";
        const newBal = currentBal + grantAmt;
        
        // Update balance and wallet
        transaction.update(studentRef, { wallet: newBal, balance: newBal });

        // Insert Transaction Log with required schema
        const txRef = collection(db, "transactions");
        const newTxDocRef = doc(txRef);

        const newTx = {
          userId: targetStudentId,
          amount: grantAmt,
          merchant: "University Treasury Core",
          type: "admin_grant",
          date: new Date().toISOString(),
          senderId: "admin_treasury",
          senderName: "University Treasury Core",
          receiverId: targetStudentId,
          receiverName: studentName,
          category: "Deposits",
          description: grantReason || "Emergency Academic Stipend",
          timestamp: Date.now()
        };

        transaction.set(newTxDocRef, newTx);
      });

      setGrantSuccess(true);
      setGrantAmount("");
      setTimeout(() => setGrantSuccess(false), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to process emergency aid.");
    } finally {
      setGrantLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-600"
            title="Return to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">Admin Operations Dashboard</h2>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Firestore Live
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Real-time audit control, treasury analytics, merchant volume tracking, and emergency fund allocation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-purple-600" />
            <span>Admin: {user.name || user.displayName || "Dean Office"}</span>
          </div>
        </div>
      </div>

      {/* SUMMARY METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Total Students</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalStudents}</div>
          <p className="text-[11px] text-slate-500 font-medium">Registered Accounts</p>
        </div>

        {/* Active Wallets */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Active Wallets</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{activeWalletsCount}</div>
          <p className="text-[11px] text-slate-500 font-medium">Funded Wallets</p>
        </div>

        {/* Total Wallet Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Total Wallet Balance</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{totalWalletBalance.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Student Treasury Funds</p>
        </div>

        {/* Today's Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Today's Transactions</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {todayTransactions.count} <span className="text-xs font-semibold text-slate-500">today</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            ₹{todayTransactions.amount.toLocaleString("en-IN")} volume today
          </p>
        </div>

        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600">
            ₹{totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {transactions.length} total transaction logs
          </p>
        </div>
      </div>

      {/* CHARTS SECTION: DAILY & MONTHLY REVENUE CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Daily Revenue & Transaction Volume
              </h3>
              <p className="text-xs text-slate-500">Past 7 days turnover in Rupees (₹)</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
              7 Days
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0F172A", color: "#FFF", borderRadius: "12px", border: "none", fontSize: "12px" }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`, "Volume"]}
                />
                <Bar dataKey="revenue" fill="#2563EB" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Revenue Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Monthly Revenue Growth Trend
              </h3>
              <p className="text-xs text-slate-500">Past 6 months ledger aggregate (₹)</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md">
              6 Months
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#0F172A", color: "#FFF", borderRadius: "12px", border: "none", fontSize: "12px" }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`, "Monthly Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SUB-SECTION: TOP MERCHANTS & EMERGENCY GRANT PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Merchants Leaderboard */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Top Outlets & Merchants</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ranked by Revenue</span>
          </div>

          {topMerchants.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs font-semibold">
              No merchant payments recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {topMerchants.map((m, idx) => (
                <div key={m.name} className="flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-100/80 rounded-xl transition border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">{m.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {m.category} • {m.count} {m.count === 1 ? "sale" : "sales"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-600 block">
                      ₹{m.revenue.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Issue Emergency Aid Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Issue Emergency Student Aid</h3>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3 rounded-xl font-semibold">
              {error}
            </div>
          )}

          {grantSuccess && (
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs p-3 rounded-xl font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Emergency funds granted successfully!
            </div>
          )}

          <form onSubmit={handleGrantAid} className="space-y-3">
            <div>
              <label htmlFor="target-student" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Recipient Student Account
              </label>
              <select
                id="target-student"
                value={targetStudentId}
                onChange={(e) => setTargetStudentId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs text-slate-800 font-semibold focus:outline-none"
              >
                <option value="">Select Student...</option>
                {users.filter(u => u.role === "student" || (!u.role && u.studentId)).map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName || u.name} ({u.studentId || "Student"}) - Bal: ₹{(u.wallet ?? u.balance ?? 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="grant-amount" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  Aid Amount (₹)
                </label>
                <input
                  id="grant-amount"
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="500"
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none text-xs"
                />
              </div>

              <div>
                <label htmlFor="grant-reason" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  Ledger Memo
                </label>
                <input
                  id="grant-reason"
                  type="text"
                  required
                  placeholder="Textbook support"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={grantLoading || !targetStudentId}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
            >
              {grantLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" /> Allocate Emergency Grant
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* STUDENT SUPPORT QUERIES QUEUE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student Support & Transaction Discrepancy Queue</h3>
              <p className="text-xs text-slate-500">Review reported payment issues, update ticket statuses, and log resolution notes</p>
            </div>
          </div>
          <span className="text-xs font-extrabold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
            {supportQueries.filter(q => q.status === "pending" || q.status === "investigating").length} Active Tickets
          </span>
        </div>

        {supportQueries.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-500">No support tickets currently in the queue.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {supportQueries.map((ticket) => (
              <div key={ticket.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 bg-slate-200 px-2 py-0.5 rounded">
                      #{ticket.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-slate-800">{ticket.userName} ({ticket.userEmail})</span>
                  </div>
                  <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full capitalize ${
                    ticket.status === "pending" ? "bg-amber-100 text-amber-800" :
                    ticket.status === "investigating" ? "bg-blue-100 text-blue-800" :
                    ticket.status === "resolved" ? "bg-emerald-100 text-emerald-800" :
                    "bg-rose-100 text-rose-800"
                  }`}>
                    {ticket.status}
                  </span>
                </div>

                <div className="text-xs text-slate-800 font-medium bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="font-extrabold text-slate-900 block mb-1">Issue: {ticket.category.replace(/_/g, " ")}</span>
                  "{ticket.description}"
                </div>

                {ticket.transactionDesc && (
                  <div className="text-[11px] text-blue-900 font-semibold bg-blue-50/70 p-2 rounded-lg border border-blue-100">
                    Ref Transaction: {ticket.transactionDesc} {ticket.transactionAmount ? `(₹${ticket.transactionAmount})` : ""}
                  </div>
                )}

                {/* Admin Status & Notes Controls */}
                <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">Change Status:</span>
                    <select
                      value={ticket.status}
                      onChange={(e) => handleUpdateTicket(ticket.id, e.target.value, ticket.adminNotes || "")}
                      disabled={updatingTicketId === ticket.id}
                      className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    >
                      <option value="pending">Pending</option>
                      <option value="investigating">Under Investigation</option>
                      <option value="resolved">Resolved / Refunded</option>
                      <option value="rejected">Closed</option>
                    </select>
                  </div>

                  <div className="flex-1 max-w-sm flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Type Dean resolution notes..."
                      defaultValue={ticket.adminNotes || ""}
                      onBlur={(e) => handleUpdateTicket(ticket.id, ticket.status, e.target.value)}
                      className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RECENT TRANSACTIONS SYSTEM AUDIT TRAIL TABLE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recent Transactions Audit Trail</h3>
              <p className="text-xs text-slate-500">Complete immutable record of all Firestore wallet movements</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search transaction..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none w-44 sm:w-56"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 bg-white rounded-xl text-xs text-slate-700 font-semibold focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="food">Food</option>
              <option value="book">Books</option>
              <option value="stationery">Stationery</option>
              <option value="event">Events</option>
              <option value="deposit">Deposits</option>
              <option value="transfer">Transfers</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 font-semibold text-xs flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            Fetching Firestore transaction records...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-500">No transactions match your search filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="py-3 px-3">Sender / Recipient</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{tx.senderName || "System"}</span>
                        <span className="text-slate-400 font-normal">→</span>
                        <span>{tx.receiverName || tx.merchant || "Recipient"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                        {tx.category || "General"}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-600 max-w-xs truncate">
                      {tx.description || "Campus payment"}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(tx.timestamp).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short"
                      })}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                      ₹{(tx.amount || 0).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
