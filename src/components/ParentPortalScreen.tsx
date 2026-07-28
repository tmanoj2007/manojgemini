import React, { useState, useEffect } from "react";
import { CampusUser, Transaction } from "../types";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  doc, 
  runTransaction 
} from "firebase/firestore";
import { 
  Users, 
  Search, 
  Wallet, 
  CreditCard, 
  Send, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  ArrowLeft, 
  ShieldCheck, 
  BellRing, 
  IndianRupee,
  UserCheck,
  Building2,
  PhoneCall
} from "lucide-react";

interface ParentPortalScreenProps {
  user: CampusUser;
  onNavigate: (page: string) => void;
}

export default function ParentPortalScreen({ user, onNavigate }: ParentPortalScreenProps) {
  // Parent details
  const [parentName, setParentName] = useState(user.displayName || user.name || "Student Parent");
  const [parentPhone, setParentPhone] = useState(user.parentPhone || "+91 98765 43210");

  // Student Search
  const [searchStudentId, setSearchStudentId] = useState("STUDENT-4920");
  const [searchedStudent, setSearchedStudent] = useState<CampusUser | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Recharge Form
  const [rechargeAmount, setRechargeAmount] = useState("1000");
  const [paymentMode, setPaymentMode] = useState("UPI / GPay");
  const [rechargeNote, setRechargeNote] = useState("Monthly allowance for books & cafeteria");
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeSuccessMsg, setRechargeSuccessMsg] = useState<string | null>(null);
  const [rechargeError, setRechargeError] = useState<string | null>(null);

  // History State
  const [rechargeHistory, setRechargeHistory] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // All Students list for quick lookup suggestions
  const [allStudents, setAllStudents] = useState<CampusUser[]>([]);

  // 1. Load list of available students for quick lookup suggestions
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const studentList = snapshot.docs
        .map((doc) => ({ uid: doc.id, ...doc.data() }) as CampusUser)
        .filter((u) => u.role === "student" || (!u.role && u.studentId));
      setAllStudents(studentList);
    });

    return () => unsubUsers();
  }, []);

  // 2. Perform initial student search on mount
  useEffect(() => {
    if (searchStudentId) {
      handleSearchStudent(searchStudentId);
    }
  }, []);

  // 3. Listen to real-time Parent Recharge History from Firestore
  useEffect(() => {
    const txRef = collection(db, "transactions");
    const q = query(txRef, where("type", "==", "parent_recharge"));

    const unsubHistory = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }) as Transaction)
        .sort((a, b) => b.timestamp - a.timestamp);
      
      setRechargeHistory(list);
      setHistoryLoading(false);
    }, (err) => {
      console.error("History snapshot error:", err);
      setHistoryLoading(false);
    });

    return () => unsubHistory();
  }, []);

  // 4. Real-time update for currently searched student's wallet balance
  useEffect(() => {
    if (!searchedStudent) return;

    const studentDocRef = doc(db, "users", searchedStudent.uid);
    const unsubStudent = onSnapshot(studentDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as CampusUser;
        const currentBal = data.wallet !== undefined ? data.wallet : (data.balance !== undefined ? data.balance : 0);
        setSearchedStudent((prev) => prev ? { ...prev, ...data, wallet: currentBal, balance: currentBal } : null);
      }
    });

    return () => unsubStudent();
  }, [searchedStudent?.uid]);

  // Search student handler
  const handleSearchStudent = async (idToSearch?: string) => {
    const targetId = (idToSearch || searchStudentId).trim();
    if (!targetId) {
      setSearchError("Please enter a Student ID to search.");
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    setRechargeSuccessMsg(null);

    try {
      const usersRef = collection(db, "users");
      // Search by studentId
      const q = query(usersRef, where("studentId", "==", targetId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const studentData = { uid: docSnap.id, ...docSnap.data() } as CampusUser;
        const wVal = studentData.wallet !== undefined ? studentData.wallet : (studentData.balance !== undefined ? studentData.balance : 1000);
        setSearchedStudent({
          ...studentData,
          wallet: wVal,
          balance: wVal,
        });
      } else {
        // Fallback: search by name substring or list
        const nameMatch = allStudents.find(
          (s) => s.studentId?.toLowerCase() === targetId.toLowerCase() ||
                 s.name.toLowerCase().includes(targetId.toLowerCase())
        );

        if (nameMatch) {
          setSearchedStudent(nameMatch);
        } else {
          setSearchedStudent(null);
          setSearchError(`No student found with ID "${targetId}". Check available student IDs below.`);
        }
      }
    } catch (err: any) {
      console.error("Student search error:", err);
      setSearchError("Error querying Firestore. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  // Add Money / Recharge Student Wallet Handler
  const handleProcessRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchedStudent) {
      setRechargeError("Please select a valid student first.");
      return;
    }

    const amt = parseFloat(rechargeAmount);
    if (isNaN(amt) || amt <= 0) {
      setRechargeError("Please enter a valid amount greater than ₹0.");
      return;
    }

    setRechargeLoading(true);
    setRechargeError(null);
    setRechargeSuccessMsg(null);

    try {
      const studentRef = doc(db, "users", searchedStudent.uid);

      await runTransaction(db, async (transaction) => {
        const studentDoc = await transaction.get(studentRef);
        if (!studentDoc.exists()) {
          throw new Error("Student account not found in Firestore.");
        }

        const data = studentDoc.data();
        const currentBal = data.wallet !== undefined ? data.wallet : (data.balance !== undefined ? data.balance : 0);
        const newBal = currentBal + amt;
        const now = Date.now();

        // 1. Update student wallet & balance in Firestore
        const notificationPayload = {
          title: "Parent Added Money",
          message: `${parentName} added ₹${amt.toLocaleString("en-IN")} to your CampEX 2.0 Wallet.`,
          amount: amt,
          timestamp: now,
        };

        transaction.update(studentRef, {
          wallet: newBal,
          balance: newBal,
          latestNotification: notificationPayload
        });

        // 2. Save recharge transaction in Firestore transactions collection
        const txRef = collection(db, "transactions");
        const newTxDocRef = doc(txRef);

        const newTransaction = {
          userId: searchedStudent.uid,
          amount: amt,
          merchant: "Parent Portal Recharge",
          type: "parent_recharge",
          category: "Parent Recharge",
          senderId: user.uid,
          senderName: parentName,
          receiverId: searchedStudent.uid,
          receiverName: searchedStudent.displayName || searchedStudent.name,
          description: rechargeNote || `Allowance from ${parentName} (${paymentMode})`,
          paymentMode,
          date: new Date().toISOString(),
          timestamp: now,
        };

        transaction.set(newTxDocRef, newTransaction);

        // 3. Save student notification document
        const notifRef = collection(db, "notifications");
        const newNotifDocRef = doc(notifRef);
        transaction.set(newNotifDocRef, {
          userId: searchedStudent.uid,
          studentId: searchedStudent.studentId || "",
          studentName: searchedStudent.displayName || searchedStudent.name,
          title: notificationPayload.title,
          message: notificationPayload.message,
          type: "parent_recharge",
          amount: amt,
          parentName,
          timestamp: now,
          read: false
        });
      });

      setRechargeSuccessMsg(
        `Success! ₹${amt.toLocaleString("en-IN")} added to ${searchedStudent.displayName || searchedStudent.name}'s wallet. A success notification has been sent to the student!`
      );
      setRechargeAmount("1000");
    } catch (err: any) {
      console.error("Recharge failed:", err);
      setRechargeError(err.message || "Failed to process parent recharge.");
    } finally {
      setRechargeLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white p-6 rounded-2xl shadow-md border border-amber-700/40">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => onNavigate("dashboard")}
            className="p-2 bg-amber-900/60 hover:bg-amber-800/80 rounded-xl transition text-amber-200 border border-amber-700/50"
            title="Return to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-white">Parent Portal & Student Wallet Top-Up</h2>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Verified Parent Access
              </span>
            </div>
            <p className="text-xs text-amber-200/90 font-medium mt-0.5">
              Instant allowance recharges, balance monitoring, and instant push notifications to students
            </p>
          </div>
        </div>

        {/* Parent Details Card */}
        <div className="flex items-center gap-3 bg-amber-950/60 p-3 rounded-xl border border-amber-700/40 shrink-0">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">{parentName}</span>
            <span className="text-[10px] text-amber-300/80 font-mono block">{parentPhone}</span>
          </div>
        </div>
      </div>

      {/* SEARCH STUDENT & ADD MONEY GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: STUDENT SEARCH & BALANCE DISPLAY (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Search Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Search Student by ID</h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchStudent();
              }}
              className="space-y-3"
            >
              <div>
                <label htmlFor="student-id-input" className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  Student ID Number
                </label>
                <div className="relative">
                  <input
                    id="student-id-input"
                    type="text"
                    required
                    placeholder="e.g. STUDENT-4920"
                    value={searchStudentId}
                    onChange={(e) => setSearchStudentId(e.target.value)}
                    className="w-full pl-3 pr-24 py-2.5 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm uppercase tracking-wide"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1"
                  >
                    {searchLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-3.5 w-3.5" /> Search
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Demo Quick Select Student Chips */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Sample Students in System:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {allStudents.slice(0, 4).map((st) => (
                    <button
                      key={st.uid}
                      type="button"
                      onClick={() => {
                        const idVal = st.studentId || st.name;
                        setSearchStudentId(idVal);
                        handleSearchStudent(idVal);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        searchedStudent?.uid === st.uid
                          ? "bg-amber-50 text-amber-800 border-amber-300 font-bold"
                          : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {st.displayName || st.name} ({st.studentId || "Student"})
                    </button>
                  ))}
                </div>
              </div>
            </form>

            {searchError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Searched Student Wallet Summary Card */}
          {searchedStudent && (
            <div className="bg-gradient-to-br from-slate-900 to-amber-950 text-white p-6 rounded-2xl shadow-md border border-amber-900/50 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Target Student Found
                  </span>
                  <h3 className="text-lg font-black text-white mt-2">
                    {searchedStudent.displayName || searchedStudent.name}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium">
                    ID: <span className="font-mono font-bold text-amber-300">{searchedStudent.studentId || "STUDENT-4920"}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{searchedStudent.email}</p>
                </div>

                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                  <Wallet className="h-8 w-8" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  Current Wallet Balance
                </span>
                <div className="text-3xl font-black text-emerald-400 flex items-center gap-1 mt-1">
                  ₹{(searchedStudent.wallet ?? searchedStudent.balance ?? 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  Real-time sync with student's CampEX 2.0 Wallet
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: RECHARGE WALLET FORM (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Parent Wallet Top-Up</h3>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Instant Firestore Ledger Update
              </span>
            </div>

            {/* Success Notification Alert Banner */}
            {rechargeSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-900 text-xs font-semibold">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span>Recharge Successful!</span>
                </div>
                <p>{rechargeSuccessMsg}</p>
                <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-800 font-bold">
                  <BellRing className="h-3.5 w-3.5 text-emerald-600 animate-bounce" />
                  Student notified live in app & saved to Firestore notifications collection.
                </div>
              </div>
            )}

            {/* Error Banner */}
            {rechargeError && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{rechargeError}</span>
              </div>
            )}

            {!searchedStudent ? (
              <div className="py-12 text-center bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <Users className="h-8 w-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-600">Please search and select a student to enable wallet top-up.</p>
              </div>
            ) : (
              <form onSubmit={handleProcessRecharge} className="space-y-4">
                {/* Select Quick Amounts */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                    Select Recharge Amount (₹)
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {["500", "1000", "2000", "5000"].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setRechargeAmount(amt)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
                          rechargeAmount === amt
                            ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        ₹{parseInt(amt).toLocaleString("en-IN")}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      placeholder="Or enter custom amount..."
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {/* Payment Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      Payment Gateway Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none"
                    >
                      <option value="UPI / GPay">UPI / Google Pay / PhonePe</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Net Banking">Net Banking</option>
                      <option value="Parent Treasury Gateway">Parent Treasury Gateway</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      Note to Student (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. For canteen & textbooks"
                      value={rechargeNote}
                      onChange={(e) => setRechargeNote(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Confirm Recharge Submit Button */}
                <button
                  type="submit"
                  disabled={rechargeLoading}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
                >
                  {rechargeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Add ₹{parseFloat(rechargeAmount || "0").toLocaleString("en-IN")} & Notify Student
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* RECHARGE HISTORY TABLE */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Parent Recharge History</h3>
              <p className="text-xs text-slate-500">Recorded parent allowance recharges saved in Firestore</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {rechargeHistory.length} {rechargeHistory.length === 1 ? "Record" : "Records"}
          </span>
        </div>

        {historyLoading ? (
          <div className="py-10 text-center text-slate-400 font-semibold text-xs flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            Loading parent recharge history from Firestore...
          </div>
        ) : rechargeHistory.length === 0 ? (
          <div className="py-10 text-center bg-slate-50 rounded-xl border border-slate-100 space-y-1">
            <p className="text-xs font-bold text-slate-600">No parent recharges recorded yet.</p>
            <p className="text-[11px] text-slate-400">Add money to a student's wallet above to view transaction logs here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Parent / Sender</th>
                  <th className="py-3 px-3">Note / Mode</th>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rechargeHistory.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {tx.receiverName || "Student Account"}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-600">
                      {tx.senderName || "Parent"}
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <span className="block font-semibold text-slate-800 truncate">{tx.description || "Allowance recharge"}</span>
                      {tx.paymentMode && (
                        <span className="text-[10px] text-slate-400 block font-mono">{tx.paymentMode}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {new Date(tx.timestamp).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short"
                      })}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-emerald-600">
                      +₹{(tx.amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Success
                      </span>
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
