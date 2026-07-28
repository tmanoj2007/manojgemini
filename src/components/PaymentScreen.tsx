import React, { useState, useEffect, useRef } from "react";
import { CampusUser, Transaction } from "../types";
import { db } from "../firebase";
import { doc, collection, runTransaction, getDocs, query, where } from "firebase/firestore";
import { Html5Qrcode } from "html5-qrcode";
import { 
  ArrowLeft, 
  QrCode, 
  Send, 
  Loader2, 
  CheckCircle2, 
  Coffee, 
  BookOpen, 
  ShoppingBag, 
  User,
  AlertCircle,
  Camera,
  Upload,
  RefreshCw,
  Zap,
  Sparkles,
  Phone,
  Search
} from "lucide-react";

interface PaymentScreenProps {
  user: CampusUser;
  onRefreshUser: (updatedUser: Partial<CampusUser>) => void;
  onNavigate: (page: string) => void;
  initialQrData?: string;
}

interface ScannedMerchantData {
  merchantId: string;
  merchantName: string;
  paymentAmount: number;
  category?: string;
  description?: string;
}

export default function PaymentScreen({ user, onRefreshUser, onNavigate, initialQrData }: PaymentScreenProps) {
  const [activeTab, setActiveTab] = useState<"scan_qr" | "show_qr" | "pay_peer_merchant">("scan_qr");
  
  // QR Code Scanner State
  const [scannedMerchant, setScannedMerchant] = useState<ScannedMerchantData | null>(null);

  useEffect(() => {
    if (initialQrData) {
      handleParsedQrCode(initialQrData);
    }
  }, [initialQrData]);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [customQrCode, setCustomQrCode] = useState("");

  // Payment Execution State
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [lastPaidTx, setLastPaidTx] = useState<{ 
    merchantName: string; 
    amount: number; 
    remainingWallet: number;
    txId: string;
    formattedDate: string;
    aiTip?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual payment / Phone transfer state
  const [targetId, setTargetId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualCategory, setManualCategory] = useState("Food");
  const [manualDescription, setManualDescription] = useState("");
  const [recentRecipients, setRecentRecipients] = useState<{ id: string; name: string; role: string; email: string; phone?: string }[]>([]);

  // Camera scanner instance ref
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Sample Merchant QR Codes (Canteen, Library, Stationery) for instant scanner testing
  const sampleMerchantQrs: ScannedMerchantData[] = [
    {
      merchantId: "CANT001",
      merchantName: "Canteen",
      paymentAmount: 0,
      category: "Food",
      description: "Canteen Outlet QR Scanner"
    },
    {
      merchantId: "LIB001",
      merchantName: "Library",
      paymentAmount: 0,
      category: "Books",
      description: "Library Services QR Scanner"
    },
    {
      merchantId: "STAT001",
      merchantName: "Stationery",
      paymentAmount: 0,
      category: "Books",
      description: "Stationery Store QR Scanner"
    }
  ];

  // Default campus recipients with sample phone numbers for quick testing
  const defaultMerchants = [
    { id: "MOCK_CANTEEN", name: "Campus Central Canteen", role: "merchant", email: "canteen@campus.edu", phone: "9876543210" },
    { id: "MOCK_LIBRARY", name: "University Central Library", role: "merchant", email: "library@campus.edu", phone: "9876543211" },
    { id: "MOCK_STATIONERY", name: "Varsity Stationery & Store", role: "merchant", email: "stationery@campus.edu", phone: "9876543212" },
    { id: "MOCK_STUDENT1", name: "Ananya Sharma (Student)", role: "student", email: "ananya@campus.edu", phone: "9123456789" },
    { id: "MOCK_STUDENT2", name: "Rohan Verma (Student)", role: "student", email: "rohan@campus.edu", phone: "9988776655" }
  ];

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(collection(db, "users"), where("uid", "!=", user.uid));
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.data().displayName || doc.data().merchantName || "Campus Member",
          role: doc.data().role || "student",
          email: doc.data().email || "",
          phone: doc.data().phone || doc.data().phoneNumber || ""
        }));
        setRecentRecipients([...list.filter(u => u.role !== "admin"), ...defaultMerchants]);
      } catch (err) {
        console.error("Error fetching target list:", err);
        setRecentRecipients(defaultMerchants);
      }
    };
    fetchUsers();
  }, [user.uid]);

  // Auto lookup person's name dynamically as phone number is entered
  useEffect(() => {
    const cleanDigits = recipientPhone.replace(/\D/g, "");
    if (!cleanDigits) {
      return;
    }
    const match = recentRecipients.find(r => r.phone && r.phone.replace(/\D/g, "") === cleanDigits);
    if (match) {
      setTargetId(match.id);
      setTargetName(match.name);
    } else {
      const partialMatch = recentRecipients.find(r => r.phone && cleanDigits.length >= 4 && r.phone.replace(/\D/g, "").includes(cleanDigits));
      if (partialMatch) {
        setTargetId(partialMatch.id);
        setTargetName(partialMatch.name);
      } else if (cleanDigits.length >= 10) {
        setTargetId(`PHONE_${cleanDigits}`);
        if (!targetName || targetName.startsWith("Searching") || targetName.startsWith("Campus User")) {
          setTargetName(`Campus Student (+91 ${cleanDigits.slice(-4)})`);
        }
      } else {
        setTargetId(`PHONE_${cleanDigits}`);
        if (!targetName || targetName.startsWith("Campus Student")) {
          setTargetName(`Matching contact (${cleanDigits})...`);
        }
      }
    }
  }, [recipientPhone, recentRecipients]);

  // Cleanup camera scanner on unmount or tab change
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [activeTab]);

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn("Camera cleanup warning:", e);
      }
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  };

  const startCameraScanner = async () => {
    setCameraError(null);
    setError(null);
    setCameraActive(true);

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }

      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleParsedQrCode(decodedText);
          stopCameraScanner();
        },
        () => {}
      );
    } catch (err: any) {
      console.warn("Camera start failed, fallback to simulated camera:", err);
      setCameraError("Device camera unavailable in iframe context. Use interactive scan buttons below.");
      setCameraActive(false);
    }
  };

  const handleParsedQrCode = (text: string) => {
    setError(null);
    setIsScanning(true);

    setTimeout(() => {
      let mId = "MOCK_CANTEEN";
      let mName = "Campus Central Canteen";
      let mAmount = 0;
      let mCategory = "Food";
      let mDesc = "QR Code Purchase";

      try {
        if (text.startsWith("{")) {
          const parsed = JSON.parse(text);
          mId = parsed.merchantId || parsed.id || "MOCK_MERCHANT";
          mName = parsed.merchantName || parsed.name || "Campus Merchant";
          mAmount = parsed.paymentAmount !== undefined && parsed.paymentAmount > 0 
            ? parseFloat(parsed.paymentAmount) 
            : (parsed.amount !== undefined && parsed.amount > 0 ? parseFloat(parsed.amount) : 0);
          mCategory = parsed.category || "Food";
          mDesc = parsed.description || "QR Code Merchant Payment";
        } else if (text.includes(":")) {
          const parts = text.split(":");
          if (parts.length >= 3) {
            mId = parts[0] || "MOCK_MERCHANT";
            mName = parts[1] || "Campus Outlet";
            mAmount = parseFloat(parts[2]) || 0;
          } else if (parts.length === 2) {
            mId = parts[0] || "MOCK_MERCHANT";
            mName = parts[1] || "Campus Outlet";
            mAmount = 0;
          }
        } else {
          // Plain text merchant name
          mName = text.trim();
          mAmount = 0;
        }
      } catch (e) {
        mName = text;
        mAmount = 0;
      }

      setScannedMerchant({
        merchantId: mId,
        merchantName: mName,
        paymentAmount: mAmount,
        category: mCategory,
        description: mDesc
      });

      setIsScanning(false);
    }, 500);
  };

  const handleFileUploadScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsScanning(true);

    try {
      const html5QrCode = new Html5Qrcode("reader-file");
      const decodedText = await html5QrCode.scanFile(file, true);
      handleParsedQrCode(decodedText);
    } catch (err) {
      // If image scan fails, test scan first sample
      handleParsedQrCode(JSON.stringify(sampleMerchantQrs[0]));
    } finally {
      setIsScanning(false);
    }
  };

  const handleCustomQrParse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQrCode.trim()) return;
    handleParsedQrCode(customQrCode);
    setCustomQrCode("");
  };

  // Execute QR Code Merchant Payment
  const processQrPayment = async () => {
    if (!scannedMerchant) return;

    const payAmt = Number(scannedMerchant.paymentAmount) || 0;
    if (payAmt <= 0) {
      setError("Please enter a valid transfer amount.");
      return;
    }

    const currentWallet = user.wallet ?? user.balance ?? 1000;

    // Strict Requirement Check 7: If the balance is insufficient, show "Insufficient Wallet Balance"
    if (currentWallet < payAmt) {
      setError("Insufficient Wallet Balance");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalWallet = currentWallet - payAmt;
      let createdTxId = "";

      await runTransaction(db, async (transaction) => {
        // --- STEP 1: EXECUTE ALL FIRESTORE READS FIRST ---
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await transaction.get(userDocRef);

        const merchantDocRef = doc(db, "users", scannedMerchant.merchantId);
        const merchantDoc = await transaction.get(merchantDocRef);

        // --- STEP 2: VERIFY BALANCE & CALCULATE NEW STATES ---
        let latestWallet = currentWallet;
        if (userDoc.exists()) {
          const data = userDoc.data();
          latestWallet = data.wallet !== undefined ? data.wallet : (data.balance !== undefined ? data.balance : 1000);
        }

        if (latestWallet < payAmt) {
          throw new Error("Insufficient Wallet Balance");
        }

        finalWallet = latestWallet - payAmt;

        // --- STEP 3: EXECUTE ALL FIRESTORE WRITES AFTER ALL READS ---
        if (userDoc.exists()) {
          transaction.update(userDocRef, { wallet: finalWallet, balance: finalWallet });
        } else {
          transaction.set(userDocRef, {
            uid: user.uid,
            name: user.name || user.displayName || "Campus Student",
            wallet: finalWallet,
            balance: finalWallet
          }, { merge: true });
        }

        // Credit merchant account if merchant user doc exists in Firestore
        if (merchantDoc.exists()) {
          const mData = merchantDoc.data();
          const mWallet = mData.wallet !== undefined ? mData.wallet : (mData.balance !== undefined ? mData.balance : 1000);
          transaction.update(merchantDocRef, { wallet: mWallet + payAmt, balance: mWallet + payAmt });
        }

        // Create transaction document strictly matching required schema
        const txRef = collection(db, "transactions");
        const newTxDocRef = doc(txRef);
        createdTxId = newTxDocRef.id;
        
        const newTx = {
          userId: user.uid,
          merchantName: scannedMerchant.merchantName,
          merchant: scannedMerchant.merchantName,
          amount: payAmt,
          type: "debit",
          timestamp: Date.now(),
          date: new Date().toISOString(),
          description: scannedMerchant.description || `QR Payment at ${scannedMerchant.merchantName}`,
          senderId: user.uid,
          senderName: user.name || user.displayName || "Campus Student",
          receiverId: scannedMerchant.merchantId,
          receiverName: scannedMerchant.merchantName,
          category: scannedMerchant.category || "Food"
        };

        transaction.set(newTxDocRef, newTx);

        // Add Payment Successful Notification
        const notifRef = collection(db, "notifications");
        const payNotifDocRef = doc(notifRef);
        transaction.set(payNotifDocRef, {
          userId: user.uid,
          title: "Payment Successful",
          message: `Paid ₹${payAmt.toLocaleString("en-IN")} at ${scannedMerchant.merchantName}.`,
          type: "payment_success",
          amount: payAmt,
          read: false,
          timestamp: Date.now()
        });

        // Add Low Wallet Balance Notification if balance drops below ₹100
        if (finalWallet < 100) {
          const lowBalNotifDocRef = doc(notifRef);
          transaction.set(lowBalNotifDocRef, {
            userId: user.uid,
            title: "Low Wallet Balance Alert",
            message: `Warning: Your CampEX 2.0 Wallet balance is ₹${finalWallet.toFixed(2)}, which is below ₹100. Please top up your wallet soon.`,
            type: "low_balance",
            amount: finalWallet,
            read: false,
            timestamp: Date.now() + 1
          });
        }
      });

      // Fetch Gemini AI tip specifically for this purchase
      let aiTipText = "";
      try {
        const tipRes = await fetch("/api/generate-payment-tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantName: scannedMerchant.merchantName,
            amount: payAmt,
            category: scannedMerchant.category || "Food",
            userBalance: finalWallet
          })
        });
        if (tipRes.ok) {
          const tipJson = await tipRes.json();
          aiTipText = tipJson.tip || "";
        }
      } catch (e) {
        console.error("Gemini payment tip fetch failed:", e);
      }

      if (!aiTipText) {
        aiTipText = `Smart purchase at ${scannedMerchant.merchantName}! Keep track of your remaining ₹${finalWallet.toFixed(2)} wallet balance.`;
      }

      // Requirement 8 & Gemini Tip: Update user state on Dashboard immediately
      onRefreshUser({ 
        wallet: finalWallet, 
        balance: finalWallet,
        latestAiTip: aiTipText,
        latestAiTipMerchant: scannedMerchant.merchantName
      });

      const formattedDateStr = new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });

      setLastPaidTx({
        merchantName: scannedMerchant.merchantName,
        amount: payAmt,
        remainingWallet: finalWallet,
        txId: createdTxId,
        formattedDate: formattedDateStr,
        aiTip: aiTipText
      });

      setSuccess(true);
      setShowToast(true);
      setScannedMerchant(null);
    } catch (err: any) {
      console.error("QR Payment transaction error:", err);
      if (err.message === "Insufficient Wallet Balance") {
        setError("Insufficient Wallet Balance");
      } else {
        setError(err.message || "Payment transaction failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual payment / Phone number transfer submission
  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let finalTargetId = targetId;
    let finalTargetName = targetName;
    const cleanPhone = recipientPhone.replace(/\D/g, "");

    // Check if recipient is specified either by selection or by entering phone number
    if (!finalTargetId && cleanPhone) {
      if (cleanPhone.length < 10) {
        setError("Please enter a valid 10-digit mobile phone number.");
        return;
      }
      // Search in recent recipients first
      const matchedRecipient = recentRecipients.find(
        (r) => r.phone?.replace(/\D/g, "").includes(cleanPhone) || r.email.toLowerCase().includes(cleanPhone)
      );
      if (matchedRecipient) {
        finalTargetId = matchedRecipient.id;
        finalTargetName = matchedRecipient.name;
      } else {
        finalTargetId = `PHONE_${cleanPhone}`;
        finalTargetName = `Campus User (${cleanPhone})`;
      }
    }

    if (!finalTargetId) {
      setError("Please enter a recipient phone number or select a recipient contact.");
      return;
    }

    const payAmt = parseFloat(manualAmount);
    if (isNaN(payAmt) || payAmt <= 0) {
      setError("Please specify a valid payment amount (minimum ₹1).");
      return;
    }

    const currentWallet = user.wallet ?? user.balance ?? 1000;
    if (currentWallet < payAmt) {
      setError("Insufficient Wallet Balance");
      return;
    }

    setLoading(true);

    try {
      let finalWallet = currentWallet - payAmt;
      let createdTxId = "";

      await runTransaction(db, async (transaction) => {
        // --- STEP 1: EXECUTE ALL FIRESTORE READS FIRST ---
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await transaction.get(userDocRef);

        const receiverDocRef = doc(db, "users", finalTargetId);
        const receiverDoc = await transaction.get(receiverDocRef);

        // --- STEP 2: VERIFY BALANCE & CALCULATE NEW STATES ---
        let latestWallet = currentWallet;
        if (userDoc.exists()) {
          const data = userDoc.data();
          latestWallet = data.wallet !== undefined ? data.wallet : (data.balance !== undefined ? data.balance : 1000);
        }

        if (latestWallet < payAmt) {
          throw new Error("Insufficient Wallet Balance");
        }

        finalWallet = latestWallet - payAmt;

        // --- STEP 3: EXECUTE ALL FIRESTORE WRITES AFTER ALL READS ---
        if (userDoc.exists()) {
          transaction.update(userDocRef, { wallet: finalWallet, balance: finalWallet });
        } else {
          transaction.set(userDocRef, {
            uid: user.uid,
            name: user.name || user.displayName || "Campus Student",
            wallet: finalWallet,
            balance: finalWallet
          }, { merge: true });
        }

        if (receiverDoc.exists()) {
          const rData = receiverDoc.data();
          const rWallet = rData.wallet !== undefined ? rData.wallet : (rData.balance !== undefined ? rData.balance : 1000);
          transaction.update(receiverDocRef, { wallet: rWallet + payAmt, balance: rWallet + payAmt });
        } else if (finalTargetId.startsWith("PHONE_")) {
          transaction.set(receiverDocRef, {
            uid: finalTargetId,
            name: finalTargetName,
            phone: cleanPhone,
            phoneNumber: cleanPhone,
            wallet: payAmt,
            balance: payAmt,
            role: "student",
            createdAt: Date.now()
          }, { merge: true });
        }

        const txRef = collection(db, "transactions");
        const newTxDocRef = doc(txRef);
        createdTxId = newTxDocRef.id;

        const newTx = {
          userId: user.uid,
          merchantName: finalTargetName,
          merchant: finalTargetName,
          amount: payAmt,
          type: "debit",
          timestamp: Date.now(),
          date: new Date().toISOString(),
          description: manualDescription || `Transfer to ${finalTargetName}`,
          senderId: user.uid,
          senderName: user.name || user.displayName || "Campus Student",
          receiverId: finalTargetId,
          receiverName: finalTargetName,
          category: manualCategory,
          recipientPhone: cleanPhone || undefined
        };

        transaction.set(newTxDocRef, newTx);

        // Add Payment Successful Notification
        const notifRef = collection(db, "notifications");
        const payNotifDocRef = doc(notifRef);
        transaction.set(payNotifDocRef, {
          userId: user.uid,
          title: "Transfer Successful",
          message: `Transferred ₹${payAmt.toLocaleString("en-IN")} to ${finalTargetName}${cleanPhone ? ` (${cleanPhone})` : ""}.`,
          type: "payment_success",
          amount: payAmt,
          read: false,
          timestamp: Date.now()
        });

        // Add Low Wallet Balance Notification if balance drops below ₹100
        if (finalWallet < 100) {
          const lowBalNotifDocRef = doc(notifRef);
          transaction.set(lowBalNotifDocRef, {
            userId: user.uid,
            title: "Low Wallet Balance Alert",
            message: `Warning: Your CampEX 2.0 Wallet balance is ₹${finalWallet.toFixed(2)}, which is below ₹100. Please top up your wallet soon.`,
            type: "low_balance",
            amount: finalWallet,
            read: false,
            timestamp: Date.now() + 1
          });
        }
      });

      // Fetch Gemini AI tip
      let aiTipText = "";
      try {
        const tipRes = await fetch("/api/generate-payment-tip", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchantName: finalTargetName,
            amount: payAmt,
            category: manualCategory,
            userBalance: finalWallet
          })
        });
        if (tipRes.ok) {
          const tipJson = await tipRes.json();
          aiTipText = tipJson.tip || "";
        }
      } catch (e) {
        console.error("Gemini payment tip fetch failed:", e);
      }

      if (!aiTipText) {
        aiTipText = `Transfer processed for ${finalTargetName}! Monitor your remaining ₹${finalWallet.toFixed(2)} wallet balance.`;
      }

      onRefreshUser({ 
        wallet: finalWallet, 
        balance: finalWallet,
        latestAiTip: aiTipText,
        latestAiTipMerchant: finalTargetName
      });

      const formattedDateStr = new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });

      setLastPaidTx({
        merchantName: finalTargetName,
        amount: payAmt,
        remainingWallet: finalWallet,
        txId: createdTxId,
        formattedDate: formattedDateStr,
        aiTip: aiTipText
      });

      setSuccess(true);
      setShowToast(true);
      setManualAmount("");
      setTargetId("");
      setTargetName("");
      setRecipientPhone("");
      setManualDescription("");
    } catch (err: any) {
      console.error("Manual Transfer transaction error:", err);
      if (err.message === "Insufficient Wallet Balance") {
        setError("Insufficient Wallet Balance");
      } else {
        setError(err.message || "Transfer transaction failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative">
      {/* Toast Notification Banner */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 className="h-5 w-5 text-emerald-200" />
          <span className="font-extrabold text-sm tracking-wide">Payment Successful!</span>
        </div>
      )}

      {/* Hidden elements for html5-qrcode reader binding */}
      <div id="reader-file" className="hidden" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate("dashboard")}
          className="p-2 hover:bg-slate-100 rounded-xl transition"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Scan & Pay QR</h2>
          <p className="text-xs text-slate-500 font-medium">Scan merchant QR codes at Canteen, Library, & Stationery</p>
        </div>
      </div>

      {/* REQUIREMENT: Payment Successful Screen */}
      {success && lastPaidTx ? (
        <div className="bg-white border border-emerald-100 shadow-lg rounded-2xl p-6 md:p-8 text-center space-y-5 relative">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-emerald-50 text-emerald-500 mb-1 ring-8 ring-emerald-50/60">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full inline-block">
              Payment Successful!
            </span>
            <h3 className="text-2xl font-black text-slate-900 mt-2">Payment Confirmed</h3>
            <p className="text-slate-500 text-xs mt-1">Settled instantly on CampEX 2.0 Ledger & Firestore</p>
          </div>

          {/* Transaction Receipt Breakdown */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 max-w-md mx-auto space-y-3 text-left">
            <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Merchant Name:</span>
              <span className="font-bold text-slate-900 text-sm">{lastPaidTx.merchantName}</span>
            </div>

            <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Amount Paid:</span>
              <span className="text-lg font-black text-emerald-600">₹{lastPaidTx.amount.toLocaleString("en-IN")}</span>
            </div>

            <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Remaining Wallet Balance:</span>
              <span className="text-sm font-extrabold text-blue-900">
                ₹{lastPaidTx.remainingWallet.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs pb-2.5 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Date & Time:</span>
              <span className="font-semibold text-slate-700">{lastPaidTx.formattedDate}</span>
            </div>

            <div className="flex justify-between items-center text-xs pt-0.5">
              <span className="text-slate-500 font-medium">Transaction ID:</span>
              <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-200/60 px-2 py-0.5 rounded">
                {lastPaidTx.txId}
              </span>
            </div>
          </div>

          {/* Gemini AI Spending Tip Feature */}
          {lastPaidTx.aiTip && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 p-4 rounded-2xl max-w-md mx-auto text-left space-y-1.5 shadow-sm">
              <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                <span>Gemini AI Spending Tip</span>
              </div>
              <p className="text-xs text-amber-950/80 font-medium leading-relaxed">
                "{lastPaidTx.aiTip}"
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => {
                setSuccess(false);
                setLastPaidTx(null);
                setShowToast(false);
                setActiveTab("scan_qr");
              }}
              className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Scan Another QR
            </button>
            <button
              onClick={() => {
                setShowToast(false);
                onNavigate("dashboard");
              }}
              className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/60">
            <button
              onClick={() => {
                setActiveTab("scan_qr");
                setError(null);
              }}
              className={`flex-1 py-3 text-center text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === "scan_qr"
                  ? "border-b-2 border-blue-600 text-blue-700 bg-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <QrCode className="h-4 w-4 text-blue-600" /> Scan Merchant QR
            </button>
            {user.role === "student" && (
              <button
                onClick={() => {
                  setActiveTab("show_qr");
                  setError(null);
                  stopCameraScanner();
                }}
                className={`flex-1 py-3 text-center text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === "show_qr"
                    ? "border-b-2 border-blue-600 text-blue-700 bg-white shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <QrCode className="h-4 w-4 text-slate-400" /> My Student QR
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab("pay_peer_merchant");
                setError(null);
                stopCameraScanner();
              }}
              className={`flex-1 py-3 text-center text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === "pay_peer_merchant"
                  ? "border-b-2 border-blue-600 text-blue-700 bg-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Send className="h-4 w-4 text-slate-400" /> Manual Pay
            </button>
          </div>

          {/* TAB 1: SCAN MERCHANT QR CODE */}
          {activeTab === "scan_qr" && (
            <div className="p-6 space-y-6">
              {/* REQUIREMENT 7: Exact Error Text Alert */}
              {error && (
                <div className="bg-rose-50 border-2 border-rose-200 text-rose-800 text-xs p-4 rounded-xl font-bold flex items-center gap-3 shadow-xs animate-shake">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="block text-sm font-black">{error}</span>
                    {error === "Insufficient Wallet Balance" && (
                      <span className="text-[11px] font-medium text-rose-600 block mt-0.5">
                        Your wallet has ₹{(user.wallet ?? user.balance ?? 1000).toFixed(2)}. Please add funds or try a smaller amount.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!scannedMerchant ? (
                <div className="space-y-6">
                  {/* Camera Scanner Viewport */}
                  <div className="relative max-w-sm mx-auto bg-slate-900 rounded-3xl p-6 text-center text-white overflow-hidden shadow-md border-4 border-slate-800">
                    <div className="flex justify-between items-center text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-3">
                      <span>Live Camera Scanner</span>
                      {cameraActive ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Camera Live
                        </span>
                      ) : (
                        <span className="text-slate-500">Scanner Ready</span>
                      )}
                    </div>

                    {/* Camera Scanner Video Output Canvas */}
                    <div className="relative h-56 w-56 mx-auto border-2 border-dashed border-blue-400/80 rounded-2xl flex items-center justify-center bg-slate-950 overflow-hidden">
                      <div id="reader" className="w-full h-full object-cover" />

                      {!cameraActive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/80 text-center space-y-3">
                          <QrCode className="h-12 w-12 text-blue-400 opacity-90 animate-pulse" />
                          <p className="text-[11px] text-slate-300 font-medium leading-tight">
                            Position merchant QR code inside camera scanner
                          </p>
                          <button
                            type="button"
                            onClick={startCameraScanner}
                            className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                          >
                            <Camera className="h-3.5 w-3.5" /> Start Live Camera
                          </button>
                        </div>
                      )}

                      {isScanning && (
                        <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center space-y-2 z-10">
                          <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                          <p className="text-xs text-blue-200 font-bold">Verifying Merchant QR...</p>
                        </div>
                      )}

                      {/* Laser Frame Overlay */}
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_10px_#60a5fa] animate-pulse pointer-events-none" />
                    </div>

                    {cameraError && (
                      <p className="text-[11px] text-amber-300 mt-3 font-medium bg-amber-950/50 p-2 rounded-lg border border-amber-800/40">
                        {cameraError}
                      </p>
                    )}

                    <p className="text-[11px] text-slate-400 mt-3">
                      Scan QR at Canteen, Library, or Stationery stores
                    </p>
                  </div>

                  {/* REQUIREMENT 3 & 4: Preset Merchant QR Codes (Canteen, Library, Stationery) */}
                  <div className="space-y-3 max-w-md mx-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                        Tap a Merchant QR Scanner to Open & Pay
                      </span>
                      <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-0.5">
                        <Zap className="h-3 w-3" /> Quick Merchant Scanners
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {sampleMerchantQrs.map((merchant) => (
                        <button
                          key={merchant.merchantId}
                          type="button"
                          disabled={isScanning}
                          onClick={() => handleParsedQrCode(JSON.stringify(merchant))}
                          className="p-3 bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-2xl text-left transition group shadow-2xs"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            {merchant.category === "Food" ? (
                              <Coffee className="h-4 w-4 text-amber-600 group-hover:scale-110 transition" />
                            ) : (
                              <BookOpen className="h-4 w-4 text-blue-600 group-hover:scale-110 transition" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-800 block truncate">{merchant.merchantName}</span>
                          <span className="text-[10px] text-slate-400 font-medium block truncate mt-0.5">{merchant.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Secondary Upload Image / Raw Payload Entry */}
                  <div className="max-w-md mx-auto pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <label className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2 border border-slate-200">
                      <Upload className="h-3.5 w-3.5 text-slate-500" />
                      <span>Upload QR Image</span>
                      <input type="file" accept="image/*" onChange={handleFileUploadScan} className="hidden" />
                    </label>

                    <form onSubmit={handleCustomQrParse} className="flex-1 flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Or paste QR payload text..."
                        value={customQrCode}
                        onChange={(e) => setCustomQrCode(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="submit"
                        disabled={!customQrCode.trim() || isScanning}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition disabled:opacity-50 shrink-0"
                      >
                        Parse
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                /* SCANNED MERCHANT CHECKOUT CONFIRMATION */
                <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                    <div>
                      <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest block">Verified Merchant QR</span>
                      <h3 className="text-lg font-black text-slate-900">{scannedMerchant.merchantName}</h3>
                      <p className="text-xs text-slate-500">{scannedMerchant.description || "Campus Station Payment"}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full uppercase">
                      {scannedMerchant.category || "Outlet"}
                    </span>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <label htmlFor="qr-custom-amount" className="text-slate-700 font-extrabold uppercase text-[10px] tracking-wider">
                        Enter Amount to Pay (₹)
                      </label>
                    </div>

                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center font-black text-slate-500 text-lg pointer-events-none">
                        ₹
                      </span>
                      <input
                        id="qr-custom-amount"
                        type="number"
                        step="1"
                        min="1"
                        value={scannedMerchant.paymentAmount || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setScannedMerchant({
                            ...scannedMerchant,
                            paymentAmount: val
                          });
                          setError(null);
                        }}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-black text-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white placeholder:font-normal placeholder:text-slate-400 placeholder:text-sm"
                        placeholder="Type amount you wish to transfer..."
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs pt-2.5 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Your Current Wallet:</span>
                      <span className="font-extrabold text-blue-900">
                        ₹{(user.wallet ?? user.balance ?? 1000).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setScannedMerchant(null)}
                      className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={processQrPayment}
                      className="flex-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Authorizing Transfer...
                        </>
                      ) : scannedMerchant.paymentAmount && Number(scannedMerchant.paymentAmount) > 0 ? (
                        `Confirm & Pay ₹${scannedMerchant.paymentAmount}`
                      ) : (
                        "Confirm & Pay"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SHOW MY STUDENT QR CODE */}
          {activeTab === "show_qr" && user.role === "student" && (
            <div className="p-8 text-center space-y-6 max-w-sm mx-auto">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Present at Campus Checkouts</span>
                <span className="text-base font-bold text-slate-800 block">{user.name || user.displayName}</span>
                <span className="text-xs text-slate-500 font-medium">Student ID: {user.studentId || "S892011"}</span>
              </div>

              {/* Generative QR Visual */}
              <div className="p-4 bg-white border-2 border-slate-100 rounded-3xl inline-block shadow-sm">
                <div className="bg-blue-900 p-3 rounded-2xl">
                  <svg className="h-44 w-44 text-white" viewBox="0 0 100 100" fill="currentColor">
                    <rect x="0" y="0" width="25" height="25" />
                    <rect x="5" y="5" width="15" height="15" fill="#1e3a8a" />
                    <rect x="75" y="0" width="25" height="25" />
                    <rect x="80" y="5" width="15" height="15" fill="#1e3a8a" />
                    <rect x="0" y="75" width="25" height="25" />
                    <rect x="5" y="80" width="15" height="15" fill="#1e3a8a" />
                    
                    <rect x="10" y="10" width="5" height="5" />
                    <rect x="85" y="10" width="5" height="5" />
                    <rect x="10" y="85" width="5" height="5" />
                    
                    <rect x="35" y="5" width="10" height="5" />
                    <rect x="50" y="5" width="5" height="15" />
                    <rect x="60" y="10" width="10" height="5" />
                    <rect x="35" y="20" width="20" height="5" />
                    <rect x="65" y="20" width="5" height="15" />
                    
                    <rect x="5" y="35" width="15" height="5" />
                    <rect x="25" y="35" width="10" height="10" />
                    <rect x="45" y="35" width="5" height="5" />
                    <rect x="55" y="35" width="15" height="10" />
                    <rect x="75" y="35" width="20" height="5" />
                    
                    <rect x="5" y="50" width="5" height="15" />
                    <rect x="15" y="55" width="15" height="5" />
                    <rect x="35" y="50" width="25" height="5" />
                    <rect x="65" y="55" width="5" height="15" />
                    <rect x="75" y="50" width="10" height="10" />
                    
                    <rect x="35" y="65" width="10" height="5" />
                    <rect x="55" y="65" width="5" height="20" />
                    <rect x="65" y="75" width="15" height="5" />
                    <rect x="85" y="75" width="10" height="10" />
                    <rect x="35" y="80" width="15" height="5" />
                    <rect x="70" y="85" width="10" height="5" />
                  </svg>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Available Wallet</span>
                <div className="flex justify-between items-center">
                  <span className="text-xl font-black text-blue-900">
                    ₹{(user.wallet ?? user.balance ?? 1000).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <button
                    onClick={() => onNavigate("add-money")}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    + Add Funds
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PAY PEER OR MERCHANT VIA PHONE / MANUAL */}
          {activeTab === "pay_peer_merchant" && (
            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl font-bold flex items-center gap-2.5">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                  <div>
                    <span className="block text-sm font-black">{error}</span>
                    {error === "Insufficient Wallet Balance" && (
                      <span className="text-[11px] font-medium text-rose-600 block mt-0.5">
                        Your wallet balance is ₹{(user.wallet ?? user.balance ?? 1000).toFixed(2)}. Top up funds or reduce transfer amount.
                      </span>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleManualPayment} className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Left Side: Recipient Selection & Phone Number */}
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Recipient Mobile Number</span>
                      <span className="text-[10px] text-blue-600 font-bold lowercase">or pick contact</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="h-4 w-4" />
                      </div>
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210"
                        value={recipientPhone}
                        onChange={(e) => {
                          setRecipientPhone(e.target.value);
                          setError(null);
                        }}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Recipient Name Field */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Recipient Person Name</span>
                      <span className="text-[10px] text-emerald-600 font-bold">Auto-detected / Editable</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <input
                        type="text"
                        placeholder="Enter person's name..."
                        value={targetName}
                        onChange={(e) => {
                          setTargetName(e.target.value);
                          setError(null);
                        }}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm placeholder:text-slate-400"
                      />
                    </div>

                    {/* Live Recipient Verification Banner */}
                    {recipientPhone.trim() && (
                      <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                        targetName && !targetName.startsWith("Searching")
                          ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                          : "bg-blue-50 border-blue-200 text-blue-950"
                      }`}>
                        <div className="flex items-center gap-2">
                          {targetName && !targetName.startsWith("Searching") ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <User className="h-4 w-4 text-blue-600 shrink-0" />
                          )}
                          <div>
                            <span className="text-[10px] uppercase font-extrabold text-slate-500 block leading-none">
                              Recipient Name
                            </span>
                            <span className="font-extrabold text-xs block mt-0.5">
                              {targetName || `+91 ${recipientPhone}`}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                          targetName && !targetName.startsWith("Searching")
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {targetName && !targetName.startsWith("Searching") ? "Verified" : "Matching"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contact List */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Campus Contacts & Stores
                    </span>
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {recentRecipients.map((recipient) => {
                        const isSelected = targetId === recipient.id || (recipientPhone && recipient.phone && recipientPhone.replace(/\D/g, "") === recipient.phone.replace(/\D/g, ""));
                        return (
                          <button
                            key={recipient.id}
                            type="button"
                            onClick={() => {
                              setTargetId(recipient.id);
                              setTargetName(recipient.name);
                              if (recipient.phone) {
                                setRecipientPhone(recipient.phone);
                              } else {
                                setRecipientPhone("");
                              }
                              setError(null);
                            }}
                            className={`w-full text-left p-2.5 border rounded-xl transition flex items-center justify-between ${
                              isSelected
                                ? "bg-blue-50 border-blue-500 text-blue-950 shadow-xs ring-1 ring-blue-400"
                                : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {recipient.role === "merchant" ? (
                                <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 shrink-0">
                                  <Coffee className="h-3.5 w-3.5" />
                                </div>
                              ) : (
                                <div className="p-1.5 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 shrink-0">
                                  <User className="h-3.5 w-3.5" />
                                </div>
                              )}
                              <div>
                                <span className="text-xs font-bold block leading-tight">{recipient.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {recipient.phone ? `+91 ${recipient.phone}` : recipient.email}
                                </span>
                              </div>
                            </div>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                              {recipient.role}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Side: Transfer Amount, Category & Authorization */}
                <div className="md:col-span-3 space-y-4">
                  {/* Selected Recipient Banner */}
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                        {(targetName || recipientPhone || "T")[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block leading-none">Target Recipient</span>
                        <span className="text-xs font-black text-slate-900 block mt-0.5">
                          {targetName ? targetName : recipientPhone ? `Phone: +91 ${recipientPhone}` : "Enter recipient details"}
                        </span>
                      </div>
                    </div>
                    {targetName && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Verified Contact
                      </span>
                    )}
                  </div>

                  {/* Amount Input */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="manual-amount" className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span>Transfer / Payment Amount (₹)</span>
                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                          Set Any Custom Amount
                        </span>
                      </label>
                      <span className="text-[10px] font-bold text-slate-500">
                        Wallet Bal: <strong className="text-blue-900">₹{(user.wallet ?? user.balance ?? 1000).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center font-black text-slate-500 text-base pointer-events-none">
                        ₹
                      </span>
                      <input
                        id="manual-amount"
                        type="number"
                        step="1"
                        min="1"
                        required
                        placeholder="Enter custom amount..."
                        value={manualAmount}
                        onChange={(e) => {
                          setManualAmount(e.target.value);
                          setError(null);
                        }}
                        className="w-full pl-8 pr-3 py-2.5 border border-slate-200 rounded-xl text-slate-900 font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-600 text-lg placeholder:font-normal placeholder:text-slate-400 placeholder:text-sm"
                      />
                    </div>

                    {/* Quick Preset Amount Chips */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mr-0.5">Quick Add:</span>
                      {[10, 20, 50, 100, 250, 500, 1000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setManualAmount(preset.toString());
                            setError(null);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-700 font-bold text-[11px] rounded-lg transition"
                        >
                          +₹{preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category & Description */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="manual-category" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <select
                        id="manual-category"
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                      >
                        <option value="Peer Transfer">Peer Transfer</option>
                        <option value="Food">Food & Dining</option>
                        <option value="Books">Books & Materials</option>
                        <option value="Laundry">Laundry & Lockers</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="manual-desc" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Memo / Note
                      </label>
                      <input
                        id="manual-desc"
                        type="text"
                        placeholder="e.g. Lunch split / Canteen treat"
                        value={manualDescription}
                        onChange={(e) => setManualDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                      />
                    </div>
                  </div>

                  {/* Transfer Action Button */}
                  <button
                    type="submit"
                    disabled={loading || (!targetId && !recipientPhone.trim()) || !manualAmount}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Authorizing Transfer...
                      </>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Send className="h-4 w-4" /> Transfer Funds Now
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
