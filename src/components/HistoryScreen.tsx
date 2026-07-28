import React, { useState, useEffect } from "react";
import { CampusUser, Transaction } from "../types";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { 
  ArrowLeft, 
  Search, 
  Download, 
  Coffee, 
  BookOpen, 
  Waves, 
  ArrowUpRight, 
  ShoppingBag,
  Clapperboard,
  History,
  FileSpreadsheet,
  LifeBuoy,
  AlertCircle
} from "lucide-react";

interface HistoryScreenProps {
  user: CampusUser;
  onNavigate: (page: string, payload?: string) => void;
}

export default function HistoryScreen({ user, onNavigate }: HistoryScreenProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "debit" | "credit">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    const txRef = collection(db, "transactions");
    
    // Query where user is sender or receiver or userId matches
    const qSender = query(txRef, where("senderId", "==", user.uid), orderBy("timestamp", "desc"));
    const qReceiver = query(txRef, where("receiverId", "==", user.uid), orderBy("timestamp", "desc"));
    const qUser = query(txRef, where("userId", "==", user.uid), orderBy("timestamp", "desc"));

    const unsubSender = onSnapshot(qSender, (sSnapshot) => {
      const sTxs = sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);
      
      const unsubReceiver = onSnapshot(qReceiver, (rSnapshot) => {
        const rTxs = rSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);
        
        const unsubUser = onSnapshot(qUser, (uSnapshot) => {
          const uTxs = uSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);

          // Merge and deduplicate
          const merged = [...sTxs, ...rTxs, ...uTxs]
            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
            .sort((a, b) => b.timestamp - a.timestamp);

          setTransactions(merged);
          setLoading(false);
        }, (err) => {
          console.error("Error fetching user transactions:", err);
          setLoading(false);
        });

        return () => unsubUser();
      }, (err) => {
        console.error("Error fetching receiver transactions:", err);
        setLoading(false);
      });

      return () => unsubReceiver();
    }, (err) => {
      console.error("Error fetching sender transactions:", err);
      setLoading(false);
    });

    return () => {
      unsubSender();
    };
  }, [user.uid]);

  // Apply filters and search
  useEffect(() => {
    let result = [...transactions];

    // Filter by type
    if (typeFilter === "debit") {
      result = result.filter(tx => tx.senderId === user.uid);
    } else if (typeFilter === "credit") {
      result = result.filter(tx => tx.receiverId === user.uid);
    }

    // Filter by category
    if (categoryFilter !== "all") {
      result = result.filter(tx => tx.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    // Search term
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(tx => 
        tx.description.toLowerCase().includes(term) ||
        tx.senderName.toLowerCase().includes(term) ||
        tx.receiverName.toLowerCase().includes(term) ||
        tx.category.toLowerCase().includes(term)
      );
    }

    setFilteredTransactions(result);
  }, [transactions, searchTerm, typeFilter, categoryFilter, user.uid]);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "food":
      case "dining":
        return <Coffee className="h-4 w-4 text-amber-500" />;
      case "books":
      case "education":
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case "entertainment":
        return <Clapperboard className="h-4 w-4 text-purple-500" />;
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

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    
    // Prepare header and rows
    const headers = ["Transaction ID", "Date", "Description", "Type", "Category", "Amount", "Counterparty"];
    const rows = filteredTransactions.map(tx => {
      const isDebit = tx.senderId === user.uid;
      return [
        tx.id,
        new Date(tx.timestamp).toLocaleString(),
        tx.description,
        isDebit ? "DEBIT" : "CREDIT",
        tx.category,
        `$${tx.amount.toFixed(2)}`,
        isDebit ? tx.receiverName : tx.senderName
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CampusWallet_Statement_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Account Statement</h2>
            <p className="text-xs text-slate-500 font-medium">Verify or search all wallet activities, deposits, and payouts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("support")}
            className="inline-flex items-center gap-1.5 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-extrabold text-xs rounded-xl shadow-2xs transition"
          >
            <LifeBuoy className="h-4 w-4 text-blue-600" /> Raise Query
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="inline-flex items-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-2xs transition disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Export Statement (CSV)
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="flex-1 relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search description, recipient or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* Type Filter Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(["all", "debit", "credit"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-bold capitalize transition ${
                  typeFilter === t
                    ? "bg-white text-blue-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t === "all" ? "All Activity" : t === "debit" ? "Outgoing" : "Incoming"}
              </button>
            ))}
          </div>

          {/* Category Filter Select */}
          <div className="min-w-[140px]">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 bg-white rounded-xl text-xs text-slate-700 font-semibold focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="food">Food & Dining</option>
              <option value="books">Books & Materials</option>
              <option value="laundry">Laundry & Lockers</option>
              <option value="entertainment">Entertainment</option>
              <option value="transport">Travel & Transport</option>
              <option value="deposits">Wallet Deposits</option>
              <option value="other">Other Spends</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main transaction list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-semibold text-sm">
            Retrieving account records...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-16 text-center">
            <History className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">No matching activities found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try resetting your search filters or make new transactions to expand your ledger.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100">
                  <th className="py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activity Description</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Channel</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Counterparty</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Settled Amount</th>
                  <th className="py-3 px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx) => {
                  const isDebit = tx.senderId === user.uid;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-5">
                        <span className="text-xs font-semibold text-slate-700 block">
                          {new Date(tx.timestamp).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 block mt-0.5">
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-xs font-bold text-slate-800 block">
                          {tx.description}
                        </span>
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-[9px] font-bold text-slate-500 capitalize">
                          {getCategoryIcon(tx.category)} {tx.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-xs font-semibold text-slate-600 block capitalize">
                          {tx.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="text-xs font-bold text-slate-700 block">
                          {isDebit ? tx.receiverName : tx.senderName}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400 block mt-0.5 truncate max-w-[120px]">
                          ID: {isDebit ? tx.receiverId : tx.senderId}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <span className={`text-xs font-bold block ${isDebit ? "text-slate-800" : "text-emerald-600"}`}>
                          {isDebit ? "-" : "+"}₹{tx.amount.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => onNavigate("support", tx.id)}
                          className="px-2.5 py-1 text-[11px] font-extrabold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition inline-flex items-center gap-1"
                          title="Report problem or raise query for this transaction"
                        >
                          <AlertCircle className="h-3 w-3" /> Report Issue
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
