import React, { useState, useEffect, useMemo } from "react";
import { CampusUser, Transaction } from "../types";
import { db } from "../firebase";
import { collection, query, where, limit, orderBy, onSnapshot } from "firebase/firestore";
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  QrCode, 
  History, 
  Lightbulb, 
  TrendingUp, 
  TrendingDown,
  ShieldAlert, 
  CreditCard, 
  Send, 
  Activity,
  Coffee,
  BookOpen,
  Clapperboard,
  Waves,
  Sparkles,
  ShoppingBag,
  RefreshCw,
  Target,
  Ticket,
  PenTool,
  Utensils,
  AlertCircle,
  Loader2,
  PieChart as PieChartIcon,
  Plus,
  ChevronRight,
  Sparkle,
  LifeBuoy
} from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis 
} from "recharts";
import { motion } from "motion/react";

interface DashboardScreenProps {
  user: CampusUser;
  onNavigate: (page: string) => void;
}

interface AiInsightsData {
  empty?: boolean;
  message?: string;
  categories: { Food: number; Library: number; Stationery: number; Events: number; Others: number };
  savingTip: string | null;
  budgetSuggestion: string | null;
}

const CATEGORY_COLORS: { [key: string]: string } = {
  Food: "#f59e0b",       // Amber
  Library: "#3b82f6",    // Blue
  Stationery: "#06b6d4", // Cyan
  Events: "#a855f7",     // Purple
  Others: "#10b981",     // Emerald
};

export default function DashboardScreen({ user, onNavigate }: DashboardScreenProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryStats, setCategoryStats] = useState<{ [cat: string]: number }>({});

  // AI Spending Insights State
  const [aiInsights, setAiInsights] = useState<AiInsightsData | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(true);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchAiInsights = async (allUserTransactions: Transaction[]) => {
    const userSpends = allUserTransactions.filter(
      t => (t.senderId === user.uid || t.userId === user.uid) && t.type !== "add_money"
    );

    if (userSpends.length === 0) {
      setAiInsights({
        empty: true,
        message: "Start using CampEX 2.0 to receive AI insights.",
        categories: { Food: 0, Library: 0, Stationery: 0, Events: 0, Others: 0 },
        savingTip: null,
        budgetSuggestion: null
      });
      setAiLoading(false);
      return;
    }

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/ai-spending-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: allUserTransactions, user })
      });

      if (res.ok) {
        const data = await res.json();
        setAiInsights(data);
      } else {
        // Local fallback if API fails
        const topCat = Object.keys(categoryStats)[0] || "Food";
        setAiInsights({
          categories: { Food: categoryStats.Food || 0, Library: categoryStats.Library || 0, Stationery: categoryStats.Stationery || 0, Events: categoryStats.Events || 0, Others: categoryStats.Others || 0 },
          savingTip: `Consider setting a daily spending budget for ${topCat} to optimize your campus allowance.`,
          budgetSuggestion: "Keep track of campus dining and book purchases to build your savings reserve."
        });
      }
    } catch (err) {
      console.warn("AI Insights fetch failed, using local calculation:", err);
      const topCat = Object.keys(categoryStats)[0] || "Food";
      setAiInsights({
        categories: { Food: categoryStats.Food || 0, Library: categoryStats.Library || 0, Stationery: categoryStats.Stationery || 0, Events: categoryStats.Events || 0, Others: categoryStats.Others || 0 },
        savingTip: `Consider setting a daily spending budget for ${topCat} to optimize your campus allowance.`,
        budgetSuggestion: "Keep track of campus dining and book purchases to build your savings reserve."
      });
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    let initialFetched = false;

    // Listen for recent transactions
    const txRef = collection(db, "transactions");

    const unsubSender = onSnapshot(query(txRef, where("senderId", "==", user.uid), orderBy("timestamp", "desc"), limit(20)), (snapshot) => {
      const senderTxs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);
      
      const unsubReceiver = onSnapshot(query(txRef, where("receiverId", "==", user.uid), orderBy("timestamp", "desc"), limit(20)), (snapshotRx) => {
        const receiverTxs = snapshotRx.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);
        
        // Merge and sort
        const mergedAll = [...senderTxs, ...receiverTxs]
          .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // Deduplicate
          .sort((a, b) => b.timestamp - a.timestamp);

        setTransactions(mergedAll);
        setLoading(false);

        // Calculate category stats for user's spend
        const spends = mergedAll.filter(tx => (tx.senderId === user.uid || tx.userId === user.uid) && tx.type !== "add_money");
        const stats: { [cat: string]: number } = {};
        spends.forEach(s => {
          const cat = s.category || "Others";
          stats[cat] = (stats[cat] || 0) + s.amount;
        });
        setCategoryStats(stats);

        // Refresh AI Insights once per initial load to conserve API quota
        if (!initialFetched) {
          initialFetched = true;
          fetchAiInsights(mergedAll);
        }
      }, (err) => {
        console.error("Error listening to receiver transactions:", err);
        setLoading(false);
      });

      return () => unsubReceiver();
    }, (err) => {
      console.error("Error listening to sender transactions:", err);
      setLoading(false);
    });

    return () => {
      unsubSender();
    };
  }, [user.uid]);

  // Calculate Monthly Spending (Current Month)
  const monthlySpending = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions
      .filter((tx) => {
        const isDebit = tx.senderId === user.uid || tx.userId === user.uid;
        if (!isDebit || tx.type === "add_money") return false;
        const txDate = new Date(tx.timestamp);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, user.uid]);

  // Category Pie Chart Data
  const chartData = useMemo(() => {
    const categories = ["Food", "Library", "Stationery", "Events", "Others"];
    const aggregated: { [key: string]: number } = {
      Food: aiInsights?.categories?.Food || categoryStats["Food"] || categoryStats["Dining"] || 0,
      Library: aiInsights?.categories?.Library || categoryStats["Library"] || categoryStats["Education"] || 0,
      Stationery: aiInsights?.categories?.Stationery || categoryStats["Stationery"] || categoryStats["Books"] || 0,
      Events: aiInsights?.categories?.Events || categoryStats["Events"] || categoryStats["Entertainment"] || 0,
      Others: aiInsights?.categories?.Others || categoryStats["Others"] || categoryStats["Amenities"] || 0,
    };

    const result = categories.map((cat) => ({
      name: cat,
      value: aggregated[cat] || 0,
      color: CATEGORY_COLORS[cat] || "#64748b",
    })).filter(item => item.value > 0);

    // Fallback if no spending yet
    if (result.length === 0) {
      return [
        { name: "Food", value: 400, color: "#f59e0b" },
        { name: "Library", value: 250, color: "#3b82f6" },
        { name: "Stationery", value: 150, color: "#06b6d4" },
        { name: "Events", value: 300, color: "#a855f7" },
        { name: "Others", value: 100, color: "#10b981" },
      ];
    }

    return result;
  }, [aiInsights, categoryStats]);

  const totalChartSpending = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartData]);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "food":
      case "dining":
        return <Utensils className="h-4 w-4 text-amber-500" />;
      case "library":
      case "books":
      case "education":
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case "stationery":
        return <PenTool className="h-4 w-4 text-cyan-500" />;
      case "events":
      case "entertainment":
        return <Ticket className="h-4 w-4 text-purple-500" />;
      case "laundry":
      case "amenities":
        return <Waves className="h-4 w-4 text-cyan-500" />;
      case "deposits":
      case "add_money":
        return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
      default:
        return <ShoppingBag className="h-4 w-4 text-slate-500" />;
    }
  };

  const walletBalance = user.wallet ?? user.balance ?? 1000;
  const currentMonthName = new Date().toLocaleString("default", { month: "long" });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Top Welcome Header */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-6 rounded-3xl shadow-md border border-blue-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/15 text-blue-100 border border-white/20">
              BlueRidge State Student Pass
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/30">
              <Activity className="h-3 w-3 animate-pulse text-emerald-400" /> Active Card
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {user.displayName || user.name}!
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/90 font-medium">
            Student ID: <span className="font-mono font-bold text-white">{user.studentId || "BSU-84920"}</span> • Department of Computer Science
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 w-full md:w-auto">
          <button
            onClick={() => onNavigate("add-money")}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-white text-blue-900 font-extrabold text-xs rounded-xl shadow-sm hover:bg-blue-50 transition flex items-center justify-center gap-1.5 active:scale-95"
          >
            <Plus className="h-4 w-4 text-blue-700" /> Top-Up Wallet
          </button>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Wallet Balance Card */}
        <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-blue-800/80 flex flex-col justify-between h-52 relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 h-32 w-32 bg-blue-500/10 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500"></div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-200 uppercase tracking-widest flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-blue-400" /> Wallet Balance
              </span>
              <span className="text-[10px] font-mono text-blue-300/80 bg-blue-900/60 px-2 py-0.5 rounded-md border border-blue-700/50">
                BSU-PAY-ID
              </span>
            </div>
            
            <div className="pt-2">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight block">
                ₹{walletBalance.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-blue-200/80 font-medium mt-1 block">
                Available for instantly paying campus outlets
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-blue-800/60">
            <button
              onClick={() => onNavigate("add-money")}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-1 active:scale-95"
            >
              <CreditCard className="h-3.5 w-3.5" /> Add Money
            </button>
            <button
              onClick={() => onNavigate("qr-payment")}
              className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition border border-white/15 flex items-center justify-center gap-1 active:scale-95"
            >
              <QrCode className="h-3.5 w-3.5 text-blue-300" /> Scan QR
            </button>
          </div>
        </div>

        {/* 2. Total Monthly Spending Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between h-52 relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4 text-rose-500" /> Total Monthly Spending
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {currentMonthName} 2026
              </span>
            </div>

            <div className="pt-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight block">
                ₹{monthlySpending.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                  On Track
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Monthly Limit: ₹5,000.00
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold text-slate-500">
              <span>Budget Usage</span>
              <span className="text-blue-600">{Math.min(100, Math.round((monthlySpending / 5000) * 100))}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((monthlySpending / 5000) * 100))}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* 3. Quick Stats & Savings Target */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between h-52">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Target className="h-4 w-4 text-amber-500" /> Top Spend Category
              </span>
              <button
                onClick={() => onNavigate("ai-tips")}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition flex items-center gap-0.5"
              >
                AI Insights <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {Object.keys(categoryStats).length > 0 ? (
              <div className="flex items-center gap-3 p-3 bg-amber-50/60 rounded-2xl border border-amber-200/80">
                <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
                  {getCategoryIcon(Object.keys(categoryStats)[0])}
                </div>
                <div className="min-w-0">
                  <span className="text-base font-extrabold text-slate-900 block capitalize truncate">
                    {Object.keys(categoryStats)[0]}
                  </span>
                  <span className="text-xs font-bold text-amber-900 block">
                    ₹{categoryStats[Object.keys(categoryStats)[0]].toLocaleString("en-IN")} Total Spent
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-500">
                No recent category transactions logged yet.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Smart Savings Badge</span>
            </div>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase rounded-full border border-blue-200">
              Level 2 Saver
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Quick Actions & Shortcuts
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Action 1: Add Money */}
          <button
            onClick={() => onNavigate("add-money")}
            className="p-3.5 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition text-left flex items-center gap-2.5 group active:scale-95"
          >
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs group-hover:scale-110 transition-transform shrink-0">
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-extrabold text-blue-950 block truncate">Add Money</span>
              <span className="text-[10px] text-blue-700 font-semibold block truncate">Recharge</span>
            </div>
          </button>

          {/* Action 2: Scan QR */}
          <button
            onClick={() => onNavigate("qr-payment")}
            className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-900 transition text-left flex items-center gap-2.5 group active:scale-95"
          >
            <div className="p-2 rounded-xl bg-white/10 text-white shadow-xs group-hover:scale-110 transition-transform border border-white/20 shrink-0">
              <QrCode className="h-4 w-4 text-sky-400" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-extrabold text-white block truncate">Scan QR</span>
              <span className="text-[10px] text-slate-400 font-semibold block truncate">Merchant Pay</span>
            </div>
          </button>

          {/* Action 3: Transaction History */}
          <button
            onClick={() => onNavigate("history")}
            className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition text-left flex items-center gap-2.5 group active:scale-95"
          >
            <div className="p-2 rounded-xl bg-white text-slate-700 border border-slate-200 shadow-2xs group-hover:scale-110 transition-transform shrink-0">
              <History className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-extrabold text-slate-900 block truncate">Statement</span>
              <span className="text-[10px] text-slate-500 font-semibold block truncate">History & Receipts</span>
            </div>
          </button>

          {/* Action 4: Demo Merchant QRs */}
          <button
            onClick={() => onNavigate("demo-qr")}
            className="p-3.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition text-left flex items-center gap-2.5 group active:scale-95"
          >
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs group-hover:scale-110 transition-transform shrink-0">
              <QrCode className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-extrabold text-indigo-950 block truncate">Demo QRs</span>
              <span className="text-[10px] text-indigo-700 font-semibold block truncate">Outlet Codes</span>
            </div>
          </button>

          {/* Action 5: Raise Query / Support */}
          <button
            onClick={() => onNavigate("support")}
            className="p-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200/80 transition text-left flex items-center gap-2.5 group active:scale-95"
          >
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs group-hover:scale-110 transition-transform shrink-0">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-extrabold text-amber-950 block truncate">Raise Query</span>
              <span className="text-[10px] text-amber-700 font-semibold block truncate">Report Issue</span>
            </div>
          </button>
        </div>
      </div>

      {/* Gemini AI Spending Tip Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-lg border border-slate-800 space-y-4 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="h-6 w-6 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-wide text-white flex items-center gap-2">
                AI Spending Tip & Insights
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Gemini AI
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Automated Firestore budget analysis and smart recommendations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchAiInsights(transactions)}
              disabled={aiLoading}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700/60 flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh AI Insights"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? "animate-spin text-indigo-400" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => onNavigate("ai-tips")}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              All Tips
            </button>
          </div>
        </div>

        {aiLoading ? (
          <div className="py-6 text-center space-y-2 bg-slate-800/40 rounded-2xl border border-slate-800/60 p-4">
            <Loader2 className="h-6 w-6 text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-300">
              Generating personalized financial insights with Gemini...
            </p>
          </div>
        ) : aiError ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-amber-300 text-xs">
            <span>{aiError}</span>
            <button onClick={() => fetchAiInsights(transactions)} className="underline font-bold">Retry</button>
          </div>
        ) : (
          <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              <span>Today's Primary Recommendation</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
              "{aiInsights?.savingTip || user.latestAiTip || "Track your daily dining habits at the campus library café to optimize your monthly allowance."}"
            </p>
          </div>
        )}
      </div>

      {/* Spending by Category Chart & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Visualization (Recharts Donut Chart) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-blue-600" /> Spending by Category
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visual breakdown of campus purchases across outlets
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Total: ₹{totalChartSpending.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center min-h-[220px]">
            {/* Chart Graphic */}
            <div className="h-[220px] w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: number) => [`₹${val.toLocaleString("en-IN")}`, "Spent"]}
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", color: "#ffffff", fontSize: "12px", border: "none" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spent</span>
                <span className="text-sm font-black text-slate-900">₹{totalChartSpending.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Category Legends */}
            <div className="space-y-2.5">
              {chartData.map((cat) => {
                const percentage = totalChartSpending > 0 ? Math.round((cat.value / totalChartSpending) * 100) : 0;
                return (
                  <div key={cat.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></div>
                      <span className="font-bold text-slate-800">{cat.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 block">₹{cat.value.toLocaleString("en-IN")}</span>
                      <span className="text-[10px] text-slate-400 font-medium block">{percentage}% of total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Campus Outlets & Partner Perks */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-base font-extrabold text-slate-900">Campus Outlets & Rebates</h3>
            <p className="text-xs text-slate-500">
              Pay using CampEX 2.0 at affiliated outlets for 10% instant student cash-backs.
            </p>

            <div className="space-y-2.5 pt-1">
              <div className="p-3 bg-blue-50/60 hover:bg-blue-50 border border-blue-200/60 rounded-2xl transition flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-blue-950 block">Library Coffee Station</span>
                  <span className="text-[10px] text-blue-700 font-semibold">10% Student Rebate • 1st Floor</span>
                </div>
                <Coffee className="h-4 w-4 text-blue-600 shrink-0" />
              </div>

              <div className="p-3 bg-purple-50/60 hover:bg-purple-50 border border-purple-200/60 rounded-2xl transition flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-purple-950 block">Varsity Book Store</span>
                  <span className="text-[10px] text-purple-700 font-semibold">Textbooks & Tech • Student Union</span>
                </div>
                <BookOpen className="h-4 w-4 text-purple-600 shrink-0" />
              </div>

              <div className="p-3 bg-cyan-50/60 hover:bg-cyan-50 border border-cyan-200/60 rounded-2xl transition flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-cyan-950 block">Residence Hall Laundry</span>
                  <span className="text-[10px] text-cyan-700 font-semibold">Coinless Wash • Dorm Annex</span>
                </div>
                <Waves className="h-4 w-4 text-cyan-600 shrink-0" />
              </div>
            </div>
          </div>

          <div className="pt-3">
            <button
              onClick={() => onNavigate("demo-qr")}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition text-center flex items-center justify-center gap-1.5"
            >
              <QrCode className="h-4 w-4 text-sky-400" />
              <span>Test Outlet QR Payments</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Recent Transactions</h3>
            <p className="text-xs text-slate-500">Real-time ledger entries from your CampEX 2.0 Wallet</p>
          </div>
          <button
            onClick={() => onNavigate("history")}
            className="text-xs font-extrabold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
          >
            <span>View All Ledger</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Fetching Firestore records...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-12 text-center bg-slate-50/80 rounded-2xl border border-slate-200/80 p-6 space-y-2">
            <History className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No transactions recorded yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Scan a merchant QR code or recharge your wallet balance to start building your campus activity.
            </p>
            <button
              onClick={() => onNavigate("add-money")}
              className="mt-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-blue-700 transition"
            >
              Add Money Now
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.slice(0, 6).map((tx) => {
              const isDebit = tx.senderId === user.uid || tx.userId === user.uid;
              const formattedAmt = `${isDebit ? "-" : "+"}₹${tx.amount.toLocaleString("en-IN")}`;
              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 rounded-2xl border border-slate-200/80 shrink-0">
                      {getCategoryIcon(tx.category)}
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-extrabold text-slate-900 block">
                        {isDebit ? (tx.receiverName || "Campus Outlet") : (tx.senderName || "Wallet Deposit")}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                        {new Date(tx.timestamp).toLocaleString()} • <span className="capitalize">{tx.category || "General"}</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-xs sm:text-sm font-black block ${isDebit ? "text-slate-900" : "text-emerald-600"}`}>
                      {formattedAmt}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 block mt-0.5 max-w-[140px] truncate">
                      {tx.description || "Campus payment"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
