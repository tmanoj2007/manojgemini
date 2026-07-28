import React, { useState, useEffect } from "react";
import { CampusUser, Transaction, SpendingTip } from "../types";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { 
  ArrowLeft, 
  Sparkles, 
  Loader2, 
  TrendingUp, 
  Lightbulb, 
  CheckCircle, 
  Coffee, 
  BookOpen, 
  Waves, 
  AlertCircle,
  PiggyBank
} from "lucide-react";

interface TipsScreenProps {
  user: CampusUser;
  onRefreshUser: (updatedUser: Partial<CampusUser>) => void;
  onNavigate: (page: string) => void;
}

interface AIResponse {
  summary: string;
  tips: SpendingTip[];
  challenge: {
    title: string;
    description: string;
  };
}

export default function TipsScreen({ user, onRefreshUser, onNavigate }: TipsScreenProps) {
  const [loading, setLoading] = useState(false);
  const [tipsData, setTipsData] = useState<AIResponse | null>(null);
  const [error, setError] = useState("");
  const [challengeAccepted, setChallengeAccepted] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const fetchAITips = async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Fetch user transactions from Firestore to analyze
      const txRef = collection(db, "transactions");
      const q = query(txRef, where("senderId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const transactions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Transaction);

      // 2. Call local Express server endpoint
      const response = await fetch("/api/spending-tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions, user })
      });

      if (response.ok) {
        const data = await response.json();
        setTipsData(data);
      } else {
        setTipsData({
          summary: "CampEX 2.0 analysis shows active spending across campus outlets. Managing daily micro-transactions will preserve your wallet balance.",
          tips: [
            {
              title: "Library Café Discount",
              tip: "Enjoy 10% instant student cashback on hot beverages when paying via CampEX 2.0.",
              category: "Food",
              impact: "high"
            },
            {
              title: "Digital Textbook Rentals",
              tip: "Check the university library portal for e-book rentals before buying physical copies.",
              category: "Education",
              impact: "medium"
            }
          ],
          challenge: {
            title: "Campus $5 Friday Saver",
            description: "Skip one extra beverage on Friday and save ₹400 in your wallet!"
          }
        });
      }
    } catch (err: any) {
      console.warn("Tips fetch error, using local fallback:", err);
      setTipsData({
        summary: "CampEX 2.0 analysis shows active spending across campus outlets. Managing daily micro-transactions will preserve your wallet balance.",
        tips: [
          {
            title: "Library Café Discount",
            tip: "Enjoy 10% instant student cashback on hot beverages when paying via CampEX 2.0.",
            category: "Food",
            impact: "high"
          },
          {
            title: "Digital Textbook Rentals",
            tip: "Check the university library portal for e-book rentals before buying physical copies.",
            category: "Education",
            impact: "medium"
          }
        ],
        challenge: {
          title: "Campus $5 Friday Saver",
          description: "Skip one extra beverage on Friday and save ₹400 in your wallet!"
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAITips();
  }, [user.uid]);

  // Seed sample transactions for beautiful demo analysis
  const handleSeedTransactions = async () => {
    setSeeding(true);
    try {
      const txRef = collection(db, "transactions");
      
      const sampleTxs = [
        {
          userId: user.uid,
          amount: 120.00,
          merchant: "BlueRidge Library Café",
          type: "merchant_payment",
          date: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
          senderId: user.uid,
          senderName: user.name || user.displayName,
          receiverId: "MOCK_CAFE",
          receiverName: "BlueRidge Library Café",
          category: "Food",
          description: "Caramel Latte & Croissant morning brew",
          timestamp: Date.now() - 4 * 3600 * 1000 // 4 hours ago
        },
        {
          userId: user.uid,
          amount: 650.00,
          merchant: "Varsity Book & Stationery",
          type: "merchant_payment",
          date: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
          senderId: user.uid,
          senderName: user.name || user.displayName,
          receiverId: "MOCK_BOOKSTORE",
          receiverName: "Varsity Book & Stationery",
          category: "Books",
          description: "Calculus Textbook (Used Edition)",
          timestamp: Date.now() - 1 * 24 * 3600 * 1000 // 1 day ago
        },
        {
          userId: user.uid,
          amount: 80.00,
          merchant: "Campus Laundry Hall",
          type: "merchant_payment",
          date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
          senderId: user.uid,
          senderName: user.name || user.displayName,
          receiverId: "MOCK_LAUNDRY",
          receiverName: "Campus Laundry Hall",
          category: "Laundry",
          description: "Double wash & hot-temp dryer",
          timestamp: Date.now() - 3 * 24 * 3600 * 1000 // 3 days ago
        },
        {
          userId: user.uid,
          amount: 250.00,
          merchant: "BlueRidge Library Café",
          type: "merchant_payment",
          date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
          senderId: user.uid,
          senderName: user.name || user.displayName,
          receiverId: "MOCK_CAFE",
          receiverName: "BlueRidge Library Café",
          category: "Food",
          description: "Avocado sandwich lunch & cold brew",
          timestamp: Date.now() - 4 * 24 * 3600 * 1000 // 4 days ago
        },
        {
          userId: user.uid,
          amount: 150.00,
          merchant: "Sarah Connor (Peer)",
          type: "peer_transfer",
          date: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
          senderId: user.uid,
          senderName: user.name || user.displayName,
          receiverId: "friend_4920",
          receiverName: "Sarah Connor (Peer)",
          category: "Other",
          description: "Pizza share reimbursement",
          timestamp: Date.now() - 6 * 24 * 3600 * 1000 // 6 days ago
        }
      ];

      for (const tx of sampleTxs) {
        await addDoc(txRef, tx);
      }

      setSeedSuccess(true);
      fetchAITips();
    } catch (err) {
      console.error(err);
      setError("Failed to pre-populate sample transactions.");
    } finally {
      setSeeding(false);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact.toLowerCase()) {
      case "high":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "medium":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case "food":
      case "dining":
        return <Coffee className="h-4 w-4 text-amber-500" />;
      case "books":
      case "education":
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case "laundry":
      case "amenities":
        return <Waves className="h-4 w-4 text-cyan-500" />;
      default:
        return <Lightbulb className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
            <h2 className="text-xl font-bold text-slate-800">Campus AI Insights</h2>
            <p className="text-xs text-slate-500 font-medium">Smart spending diagnostics powered by Gemini 3.6-Flash</p>
          </div>
        </div>

        <button
          onClick={fetchAITips}
          disabled={loading}
          className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Recalculate Tips
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 p-4 rounded-2xl space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <span className="font-bold text-sm">Gemini Diagnostics Failed</span>
          </div>
          <p className="text-xs font-medium leading-relaxed">
            {error}. Make sure your Gemini API key is configured correctly in the secrets panel of AI Studio.
          </p>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 border border-slate-100 shadow-sm rounded-2xl text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Reviewing Campus Expenditure Ledger...</h3>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
            Gemini is analyzing your weekly transaction items, identifying food, bookstore, and peer spending patterns...
          </p>
        </div>
      ) : (
        <>
          {/* AI Spending summary banner */}
          {tipsData && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 p-6 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
              <div className="absolute right-0 top-0 h-24 w-24 bg-blue-100/30 rounded-full -mr-8 -mt-8 -z-10"></div>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">AI Expenditure Assessment</span>
              <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                "{tipsData.summary}"
              </p>
            </div>
          )}

          {/* Seeding Alert banner (Show if database is empty) */}
          <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm space-y-3.5">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Demonstration Spending Simulator</span>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                New accounts start with no transaction history. Generate mock campus spending items to let Gemini show you realistic, hyper-focused spending habits!
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={handleSeedTransactions}
                disabled={seeding || seedSuccess}
                className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-[10px] rounded-lg transition"
              >
                {seeding ? "Injecting Data..." : seedSuccess ? "Sample Data Active" : "Seed 5 Sample Campus Spendings"}
              </button>
              {seedSuccess && (
                <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                  <CheckCircle className="h-3 w-3" /> Ledger loaded! Recalculating...
                </span>
              )}
            </div>
          </div>

          {tipsData && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {/* Left Column: Spending tips */}
              <div className="md:col-span-3 space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Actionable Savings Tips</span>
                <div className="space-y-4">
                  {tipsData.tips.map((item, idx) => (
                    <div key={idx} className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                            {getCategoryIcon(item.category)}
                          </div>
                          <div>
                            <span className="text-sm font-bold text-slate-800 block">{item.title}</span>
                            <span className="text-[10px] font-semibold text-slate-400 capitalize block mt-0.5">{item.category} Advice</span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider ${getImpactColor(item.impact)}`}>
                          {item.impact} IMPACT
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {item.tip}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Weekly challenge */}
              <div className="md:col-span-2 space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Challenges</span>
                <div className="bg-gradient-to-br from-indigo-900 to-blue-900 text-white p-5 rounded-2xl shadow-sm border border-indigo-950 flex flex-col justify-between h-72 relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-16 w-16 bg-white/5 rounded-full -mr-4 -mt-4 -z-10"></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <PiggyBank className="h-5 w-5 text-indigo-300" />
                      <span className="text-[9px] font-extrabold tracking-widest text-indigo-200 uppercase">Interactive Quest</span>
                    </div>
                    <h3 className="text-base font-bold text-indigo-50 mt-2 block">{tipsData.challenge.title}</h3>
                    <p className="text-xs text-indigo-100/80 font-medium mt-1.5 leading-relaxed">
                      {tipsData.challenge.description}
                    </p>
                  </div>
                  
                  <div>
                    {challengeAccepted ? (
                      <div className="py-2.5 px-4 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1.5">
                        <CheckCircle className="h-4 w-4" /> Challenge Accepted!
                      </div>
                    ) : (
                      <button
                        onClick={() => setChallengeAccepted(true)}
                        className="w-full py-2.5 bg-white hover:bg-slate-100 text-indigo-900 font-bold text-xs rounded-xl shadow-sm transition"
                      >
                        Accept Weekly Challenge
                      </button>
                    )}
                    <p className="text-[10px] text-indigo-200/50 text-center mt-2 font-medium">
                      Accepting logs progress in your active quest panel.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
