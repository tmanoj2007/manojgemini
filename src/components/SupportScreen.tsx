import React, { useState, useEffect } from "react";
import { CampusUser, Transaction, SupportQuery, QueryCategory } from "../types";
import { db } from "../firebase";
import { collection, query, where, onSnapshot, addDoc, orderBy } from "firebase/firestore";
import { 
  ArrowLeft, 
  HelpCircle, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  ShieldAlert, 
  MessageSquare, 
  Search, 
  CreditCard,
  ChevronRight,
  LifeBuoy,
  RefreshCw,
  PhoneCall
} from "lucide-react";

interface SupportScreenProps {
  user: CampusUser;
  onNavigate: (page: string) => void;
  preselectedTransactionId?: string;
}

export default function SupportScreen({ user, onNavigate, preselectedTransactionId }: SupportScreenProps) {
  const [activeTab, setActiveTab] = useState<"raise" | "my-tickets">(preselectedTransactionId ? "raise" : "my-tickets");
  
  // Transactions list for dropdown
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);

  // Form states
  const [selectedTxId, setSelectedTxId] = useState<string>(preselectedTransactionId || "none");
  const [category, setCategory] = useState<QueryCategory>("amount_deducted_not_credited");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState(user.parentPhone || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Submitted queries list
  const [myQueries, setMyQueries] = useState<SupportQuery[]>([]);
  const [loadingQueries, setLoadingQueries] = useState(true);

  // Fetch recent transactions for dropdown selection
  useEffect(() => {
    const txRef = collection(db, "transactions");
    const qUser = query(txRef, where("userId", "==", user.uid), orderBy("timestamp", "desc"));
    const qSender = query(txRef, where("senderId", "==", user.uid), orderBy("timestamp", "desc"));

    const unsubUser = onSnapshot(qUser, (uSnapshot) => {
      const uTxs = uSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);
      
      const unsubSender = onSnapshot(qSender, (sSnapshot) => {
        const sTxs = sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);
        const merged = [...uTxs, ...sTxs]
          .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
          .sort((a, b) => b.timestamp - a.timestamp);

        setUserTransactions(merged);
        setLoadingTxs(false);
      }, (err) => {
        console.warn("Sender query error:", err);
        setLoadingTxs(false);
      });

      return () => unsubSender();
    }, (err) => {
      console.warn("User query error:", err);
      setLoadingTxs(false);
    });

    return () => unsubUser();
  }, [user.uid]);

  // Fetch submitted support queries
  useEffect(() => {
    const queriesRef = collection(db, "support_queries");
    const q = query(queriesRef, where("userId", "==", user.uid));

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SupportQuery)
        .sort((a, b) => b.createdAt - a.createdAt);
      setMyQueries(list);
      setLoadingQueries(false);

      // If user has existing queries and didn't pass a preselected tx, default tab to 'my-tickets'
      if (list.length > 0 && !preselectedTransactionId && activeTab === "raise" && !submitSuccess) {
        // keep current activeTab
      }
    }, (err) => {
      console.error("Error fetching support queries:", err);
      setLoadingQueries(false);
    });

    return () => unsub();
  }, [user.uid, preselectedTransactionId]);

  // If preselectedTransactionId passed, update form
  useEffect(() => {
    if (preselectedTransactionId) {
      setSelectedTxId(preselectedTransactionId);
      setActiveTab("raise");
    }
  }, [preselectedTransactionId]);

  const handleSubmitQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please type a clear description of the issue.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let txDesc = "General Wallet Query";
      let txAmt = 0;

      if (selectedTxId !== "none") {
        const foundTx = userTransactions.find(t => t.id === selectedTxId);
        if (foundTx) {
          txDesc = `${foundTx.description || foundTx.category} (${foundTx.merchant || foundTx.receiverName || "Merchant"})`;
          txAmt = foundTx.amount || 0;
        }
      }

      const ticketRef = await addDoc(collection(db, "support_queries"), {
        userId: user.uid,
        userName: user.name || user.displayName || "Student",
        userEmail: user.email || "",
        transactionId: selectedTxId !== "none" ? selectedTxId : null,
        transactionDesc: txDesc,
        transactionAmount: txAmt,
        category,
        description: description.trim(),
        contactPhone: contactPhone.trim(),
        status: "pending",
        adminNotes: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Also generate notification for the user
      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        title: "Ticket Submitted Successfully",
        message: `Your query #${ticketRef.id.slice(-6).toUpperCase()} has been logged and sent to Dean Support Queue.`,
        type: "query_submitted",
        read: false,
        timestamp: Date.now()
      });

      setSubmitSuccess(ticketRef.id.slice(-6).toUpperCase());
      setDescription("");
      setSelectedTxId("none");
      setSubmitting(false);

      // Automatically switch to tickets view after 1.5 seconds
      setTimeout(() => {
        setActiveTab("my-tickets");
      }, 1800);

    } catch (err: any) {
      console.error("Error submitting support query:", err);
      setError(err.message || "Failed to submit query. Please try again.");
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case "amount_deducted_not_credited":
        return "Amount Deducted but Not Credited";
      case "wrong_amount_charged":
        return "Wrong / Incorrect Amount Charged";
      case "duplicate_charge":
        return "Duplicate Charge";
      case "failed_transaction":
        return "Failed / Stuck Pending Transaction";
      case "add_money_issue":
        return "Add Money / Deposit Issue";
      case "other_issue":
      default:
        return "Other Payment Discrepancy";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
            <Clock className="h-3 w-3 animate-pulse" /> Pending Review
          </span>
        );
      case "investigating":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
            <RefreshCw className="h-3 w-3 animate-spin" /> Under Investigation
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            <CheckCircle2 className="h-3 w-3" /> Resolved / Credited
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
            <AlertTriangle className="h-3 w-3" /> Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate("dashboard")}
            className="p-2 hover:bg-slate-100 rounded-xl transition"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-900">Transaction Help & Queries</h2>
              <span className="bg-blue-50 text-blue-700 font-extrabold text-[10px] px-2 py-0.5 rounded-md border border-blue-100">
                Support Queue
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Report payment discrepancies, wrong charges, or failed wallet transfers</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            onClick={() => {
              setActiveTab("raise");
              setSubmitSuccess(null);
            }}
            className={`flex-1 md:flex-initial py-2 px-4 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
              activeTab === "raise"
                ? "bg-white text-blue-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <HelpCircle className="h-4 w-4 text-blue-600" /> Raise New Query
          </button>
          <button
            onClick={() => setActiveTab("my-tickets")}
            className={`flex-1 md:flex-initial py-2 px-4 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 relative ${
              activeTab === "my-tickets"
                ? "bg-white text-blue-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="h-4 w-4 text-indigo-600" /> My Tickets
            {myQueries.length > 0 && (
              <span className="ml-1 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {myQueries.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      {activeTab === "raise" ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Report a Transaction Issue</h3>
              <p className="text-xs text-slate-500 font-medium">Select the affected transaction and describe what went wrong</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              <LifeBuoy className="h-4 w-4 text-blue-600" /> Dean Hotline Active
            </div>
          </div>

          {submitSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                  Query Submitted (Ticket #{submitSuccess})
                </h4>
                <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                  Your issue has been logged in the Dean & Campus Finance support queue. You will receive real-time updates under "My Tickets".
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">Submission Error</h4>
                <p className="text-xs text-rose-700 mt-0.5 font-medium">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitQuery} className="space-y-5">
            {/* Step 1: Select Transaction */}
            <div>
              <label htmlFor="tx-select" className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>1. Select Affected Transaction</span>
                <span className="text-[10px] text-slate-400 font-normal">Optional if general issue</span>
              </label>

              {loadingTxs ? (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-semibold animate-pulse">
                  Loading recent account activities...
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="tx-select"
                    value={selectedTxId}
                    onChange={(e) => setSelectedTxId(e.target.value)}
                    className="w-full py-3 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                  >
                    <option value="none">-- General / Non-transaction Query --</option>
                    {userTransactions.map((tx) => (
                      <option key={tx.id} value={tx.id}>
                        ₹{tx.amount} - {tx.description || tx.category} ({new Date(tx.timestamp).toLocaleDateString()}) - ID: {tx.id.slice(0, 8)}...
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedTxId !== "none" && (
                <div className="mt-2.5 p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-center justify-between">
                  {(() => {
                    const tx = userTransactions.find(t => t.id === selectedTxId);
                    if (!tx) return null;
                    return (
                      <>
                        <div className="flex items-center gap-2.5">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                          <div>
                            <span className="text-xs font-extrabold text-blue-950 block">
                              {tx.description || tx.category}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium block">
                              Date: {new Date(tx.timestamp).toLocaleString()} • ID: {tx.id}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-black text-blue-900">
                          ₹{tx.amount.toLocaleString("en-IN")}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Step 2: Problem Category */}
            <div>
              <label htmlFor="category-select" className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                2. Select Issue Category
              </label>
              <select
                id="category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as QueryCategory)}
                className="w-full py-3 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              >
                <option value="amount_deducted_not_credited">Amount Deducted from Wallet but Not Credited to Merchant</option>
                <option value="wrong_amount_charged">Incorrect / Wrong Amount Charged</option>
                <option value="duplicate_charge">Duplicate Payment Charge</option>
                <option value="failed_transaction">Payment Failed / Timed Out in Pending</option>
                <option value="add_money_issue">Add Money / Deposit Credit Issue</option>
                <option value="other_issue">Other Payment / Wallet Discrepancy</option>
              </select>
            </div>

            {/* Step 3: Custom Description */}
            <div>
              <label htmlFor="description" className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                3. Detailed Description of the Problem
              </label>
              <textarea
                id="description"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what happened (e.g. 'Paid ₹40 at Canteen, QR reader timed out, money debited from my wallet but vendor says not received...')"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition placeholder:text-slate-400"
              />
              <span className="text-[10px] text-slate-400 font-medium block mt-1 text-right">
                {description.length} characters
              </span>
            </div>

            {/* Step 4: Contact Phone Number */}
            <div>
              <label htmlFor="phone" className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                4. Callback Phone / WhatsApp Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <PhoneCall className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Enter phone number for support updates..."
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
                />
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" /> Logging Ticket in Support Queue...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Submit Query to Support Queue
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* My Tickets Tab */
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Your Support Queue & Ticket History</h3>
              <p className="text-xs text-slate-500 font-medium">Track live progress of your reported payment queries</p>
            </div>
            <button
              onClick={() => {
                setActiveTab("raise");
                setSubmitSuccess(null);
              }}
              className="py-1.5 px-3 bg-blue-50 text-blue-700 font-extrabold text-xs rounded-xl border border-blue-100 hover:bg-blue-100 transition"
            >
              + Raise New Query
            </button>
          </div>

          {loadingQueries ? (
            <div className="py-12 text-center text-slate-400 font-semibold text-xs animate-pulse">
              Fetching your ticket records...
            </div>
          ) : myQueries.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <HelpCircle className="h-12 w-12 text-slate-300 mx-auto" />
              <div>
                <p className="text-sm font-extrabold text-slate-700">No reported queries yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
                  If you encounter any deducted funds, failed transfers, or incorrect charges, click below to log a ticket.
                </p>
              </div>
              <button
                onClick={() => setActiveTab("raise")}
                className="py-2.5 px-4 bg-blue-600 text-white font-extrabold text-xs rounded-xl shadow-xs hover:bg-blue-700 transition"
              >
                Report Transaction Issue
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myQueries.map((ticket) => (
                <div 
                  key={ticket.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition bg-slate-50/50 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 bg-slate-200/70 px-2.5 py-1 rounded-lg">
                        #{ticket.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">
                        {getCategoryLabel(ticket.category)}
                      </span>
                    </div>
                    {getStatusBadge(ticket.status)}
                  </div>

                  <p className="text-xs text-slate-700 font-medium leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                    "{ticket.description}"
                  </p>

                  {/* Transaction Context */}
                  {ticket.transactionDesc && ticket.transactionDesc !== "General Wallet Query" && (
                    <div className="flex items-center justify-between text-xs bg-blue-50/50 px-3 py-2 rounded-lg border border-blue-100 text-blue-900 font-semibold">
                      <span>Ref Transaction: {ticket.transactionDesc}</span>
                      {ticket.transactionAmount ? (
                        <span className="font-black text-blue-950">₹{ticket.transactionAmount}</span>
                      ) : null}
                    </div>
                  )}

                  {/* Admin Notes if provided */}
                  {ticket.adminNotes && (
                    <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg flex items-start gap-2.5">
                      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-black text-amber-900 uppercase block tracking-wider">
                          Dean Support Update:
                        </span>
                        <p className="text-xs text-amber-800 font-medium mt-0.5">
                          {ticket.adminNotes}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium pt-1">
                    <span>Submitted: {new Date(ticket.createdAt).toLocaleString()}</span>
                    {ticket.contactPhone && <span>Contact: {ticket.contactPhone}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
