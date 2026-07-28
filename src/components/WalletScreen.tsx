import React, { useState } from "react";
import { CampusUser, Transaction } from "../types";
import { db } from "../firebase";
import { doc, updateDoc, collection, addDoc, runTransaction } from "firebase/firestore";
import { createNotification } from "../lib/notifications";
import { 
  Wallet, 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  CreditCard, 
  Building, 
  Smartphone,
  Info
} from "lucide-react";

interface WalletScreenProps {
  user: CampusUser;
  onRefreshUser: (updatedUser: Partial<CampusUser>) => void;
  onNavigate: (page: string) => void;
}

export default function WalletScreen({ user, onRefreshUser, onNavigate }: WalletScreenProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "student_bill" | "gpay">("card");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleQuickAdd = (preset: number) => {
    setAmount(preset.toString());
  };

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    const addAmt = parseFloat(amount);
    if (isNaN(addAmt) || addAmt <= 0) {
      setError("Please enter a valid deposit amount.");
      return;
    }
    if (addAmt > 50000) {
      setError("For campus security, single deposits are capped at ₹50,000.00 per transaction.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const userRef = doc(db, "users", user.uid);
      
      // Perform database atomic transaction to prevent stale values
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User document does not exist!");
        }

        const currentWallet = userDoc.data().wallet !== undefined 
          ? userDoc.data().wallet 
          : (userDoc.data().balance !== undefined ? userDoc.data().balance : 1000);
        const newWallet = currentWallet + addAmt;
        
        // Update user document wallet and balance
        transaction.update(userRef, { 
          wallet: newWallet, 
          balance: newWallet 
        });

        // Add transaction record with all required fields (userId, amount, merchant, type, date)
        const txRef = collection(db, "transactions");
        const merchantLabel = paymentMethod === "card" 
          ? "Visa/Mastercard Gateway" 
          : paymentMethod === "student_bill" 
            ? "University Student Billing System" 
            : "Google Pay Link";

        const newTx: Omit<Transaction, "id"> = {
          userId: user.uid,
          amount: addAmt,
          merchant: merchantLabel,
          type: "add_money",
          date: new Date().toISOString(),
          senderId: "payment_gateway",
          senderName: merchantLabel,
          receiverId: user.uid,
          receiverName: user.name || user.displayName || "Campus Student",
          category: "Deposits",
          description: `Loaded money via ${
            paymentMethod === "card" 
              ? "Debit Card" 
              : paymentMethod === "student_bill" 
                ? "Fee Bill Account" 
                : "GPay Wallet"
          }`,
          timestamp: Date.now()
        };
        
        const newTxDocRef = doc(txRef);
        transaction.set(newTxDocRef, newTx);

        // 3. Save notification for Money Added
        const notifRef = collection(db, "notifications");
        const notifDocRef = doc(notifRef);
        const channelLabel = paymentMethod === "card" ? "Credit/Debit Card" : paymentMethod === "student_bill" ? "Tuition Bill" : "Google Pay";
        transaction.set(notifDocRef, {
          userId: user.uid,
          title: "Money Added",
          message: `₹${addAmt.toLocaleString("en-IN")} successfully added to your CampEX 2.0 Wallet via ${channelLabel}.`,
          type: "money_added",
          amount: addAmt,
          read: false,
          timestamp: Date.now()
        });
      });

      // Update local state in parent
      const newBal = (user.wallet ?? user.balance ?? 1000) + addAmt;
      onRefreshUser({ wallet: newBal, balance: newBal });
      setSuccess(true);
      setAmount("");
      setCardNumber("");
      setCardExpiry("");
      setCardCvv("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load funds. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate("dashboard")}
          className="p-2 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Add Wallet Money</h2>
          <p className="text-xs text-slate-500 font-medium">Deposit funds securely into your student wallet account</p>
        </div>
      </div>

      {/* Success Modal Block */}
      {success ? (
        <div className="bg-white border border-emerald-100 shadow-sm rounded-2xl p-8 text-center space-y-4">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-50 text-emerald-500 mb-2">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-800">Funds Deposited Successfully!</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Your university smart wallet account has been loaded and is active for checkout terminals.
          </p>
          <div className="py-2.5 px-4 bg-slate-50 inline-block rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">New Wallet Balance</span>
            <span className="text-2xl font-extrabold text-blue-900 mt-1 block">
              ₹{(user.wallet ?? user.balance ?? 1000).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => setSuccess(false)}
              className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Add More Funds
            </button>
            <button
              onClick={() => onNavigate("dashboard")}
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Left Column: Form Info / Preset amounts */}
          <div className="md:col-span-3 space-y-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            {error && (
              <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs p-3 rounded-xl font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleAddMoney} className="space-y-4">
              <div>
                <label htmlFor="amount" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex justify-between items-center">
                  <span>Enter Deposit Amount (Set Any Amount You Wish)</span>
                  <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Flexible Custom Amount
                  </span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-black text-lg">₹</span>
                  </div>
                  <input
                    id="amount"
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-3 border border-slate-200 rounded-xl text-slate-900 font-extrabold text-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="Enter custom deposit amount..."
                  />
                </div>
              </div>

              {/* Quick Select Buttons */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Quick Deposit Presets</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[50, 100, 200, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleQuickAdd(preset)}
                      className="py-2 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-extrabold transition text-center"
                    >
                      +₹{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Funding Channel</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`py-2 px-1 border rounded-xl text-[10px] font-bold transition flex flex-col items-center gap-1 ${
                      paymentMethod === "card"
                        ? "bg-blue-50 border-blue-600 text-blue-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard className="h-4 w-4" /> Credit Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("student_bill")}
                    className={`py-2 px-1 border rounded-xl text-[10px] font-bold transition flex flex-col items-center gap-1 ${
                      paymentMethod === "student_bill"
                        ? "bg-blue-50 border-blue-600 text-blue-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Building className="h-4 w-4" /> Student Tuition Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("gpay")}
                    className={`py-2 px-1 border rounded-xl text-[10px] font-bold transition flex flex-col items-center gap-1 ${
                      paymentMethod === "gpay"
                        ? "bg-blue-50 border-blue-600 text-blue-800"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Smartphone className="h-4 w-4" /> GPay Instant
                  </button>
                </div>
              </div>

              {/* Conditional Card Form */}
              {paymentMethod === "card" && (
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs font-bold text-slate-700 block">Simulated Card Details</span>
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Card Number (e.g. 4111 2222 3333 4444)"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 text-xs"
                    />
                    <input
                      type="text"
                      required
                      placeholder="CVV"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Student Bill info */}
              {paymentMethod === "student_bill" && (
                <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-xl flex items-start gap-2.5">
                  <Info className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-amber-800 leading-relaxed">
                    This deposit will be charged to your central university fee ledger statement. 
                    Deposits will appear under the item "SmartWallet Deposit Adjustment" on your semester bill.
                  </p>
                </div>
              )}

              {/* Conditional GPay info */}
              {paymentMethod === "gpay" && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-slate-700" />
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Link standard GPay device</span>
                      <span className="text-[10px] text-slate-500">Fast one-click simulated transaction</span>
                    </div>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">Connected</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Authorizing Deposit...
                  </>
                ) : (
                  "Process Safe Deposit"
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Wallet State info */}
          <div className="md:col-span-2 space-y-4">
            {/* Visual Blue Card Representing Campus Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-5 rounded-2xl shadow-md border border-blue-700 flex flex-col justify-between aspect-[1.58/1]">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold tracking-wider text-blue-100 uppercase block">BlueRidge State University</span>
                  <span className="text-sm font-bold mt-1 block">Campus Pass Smart Card</span>
                </div>
                <Wallet className="h-6 w-6 text-white/80" />
              </div>
              <div>
                <span className="text-[10px] text-blue-200 block">Card Holder</span>
                <span className="text-base font-bold block mt-0.5">{user.displayName}</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[10px] text-blue-200 block">Balance</span>
                  <span className="text-xl font-black block mt-0.5">${user.balance.toFixed(2)}</span>
                </div>
                <span className="text-xs font-bold font-mono tracking-widest text-blue-100 bg-white/10 px-2 py-0.5 rounded">
                  {user.studentId || "MERCHANT"}
                </span>
              </div>
            </div>

            {/* Help/Information guidelines */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 block">Wallet Benefits</span>
              <ul className="space-y-1.5">
                <li className="text-[11px] font-medium text-slate-500 list-disc list-inside">
                  Instant coinless checkout at all campus vending machines and laundromats.
                </li>
                <li className="text-[11px] font-medium text-slate-500 list-disc list-inside">
                  10% cashback rebates at Library Café and Campus Bookstore.
                </li>
                <li className="text-[11px] font-medium text-slate-500 list-disc list-inside">
                  Zero transaction fees on peer-to-peer friend sharing.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
