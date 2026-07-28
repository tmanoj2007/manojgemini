import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { CampusUser, UserRole } from "../types";
import { Wallet, Loader2, Sparkles, LogIn, UserPlus } from "lucide-react";

interface LoginScreenProps {
  onLoginSuccess: (user: CampusUser) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<UserRole>("student");
  const [displayName, setDisplayName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      let userData: CampusUser;
      if (!userDoc.exists()) {
        // Automatically create user document with wallet balance of ₹1000
        userData = {
          uid: user.uid,
          name: user.displayName || "Campus Student",
          displayName: user.displayName || "Campus Student",
          email: user.email || "",
          wallet: 1000,
          balance: 1000,
          role: "student",
          studentId: "S" + Math.floor(100000 + Math.random() * 900000),
          createdAt: Date.now(),
        };
        await setDoc(userDocRef, userData);
      } else {
        const data = userDoc.data();
        const walletVal = data.wallet !== undefined ? data.wallet : (data.balance !== undefined ? data.balance : 1000);
        const nameVal = data.name || data.displayName || user.displayName || "Campus Student";
        userData = {
          ...data,
          uid: user.uid,
          name: nameVal,
          displayName: nameVal,
          email: data.email || user.email || "",
          wallet: walletVal,
          balance: walletVal,
          role: data.role || "student",
        } as CampusUser;

        // Ensure name and wallet fields exist on the document
        await setDoc(userDocRef, { name: nameVal, wallet: walletVal }, { merge: true });
      }

      onLoginSuccess(userData);
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in popup was closed before completion.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("Domain not authorized in Firebase. Add your GitHub Pages/localhost domain in Firebase Console -> Authentication -> Settings -> Authorized domains.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        if (!displayName) throw new Error("Full name is required");
        if (role === "student" && !studentId) throw new Error("Student ID is required");
        if (role === "merchant" && !merchantName) throw new Error("Merchant name is required");

        // Create firebase auth user
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;

        // Create Firestore user document with wallet balance of ₹1000
        const initialWallet = 1000;
        const newUser: CampusUser = {
          uid,
          name: displayName,
          displayName,
          email,
          wallet: initialWallet,
          balance: initialWallet,
          role,
          createdAt: Date.now(),
          ...(role === "student" && { studentId }),
          ...(role === "merchant" && { merchantName }),
        };

        await setDoc(doc(db, "users", uid), newUser);
        onLoginSuccess(newUser);
      } else {
        // Sign in
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;

        // Fetch Firestore user doc
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const walletVal = data.wallet !== undefined ? data.wallet : (data.balance !== undefined ? data.balance : 1000);
          const nameVal = data.name || data.displayName || "Campus User";
          const formattedUser: CampusUser = {
            ...data,
            uid,
            name: nameVal,
            displayName: nameVal,
            email: data.email || userCred.user.email || "",
            wallet: walletVal,
            balance: walletVal,
            role: data.role || "student",
          } as CampusUser;
          onLoginSuccess(formattedUser);
        } else {
          // Fallback if auth exists but no doc
          const fallbackUser: CampusUser = {
            uid,
            name: userCred.user.displayName || "Campus User",
            displayName: userCred.user.displayName || "Campus User",
            email: userCred.user.email || email,
            wallet: 1000,
            balance: 1000,
            role: "student",
            createdAt: Date.now(),
            studentId: "S" + Math.floor(100000 + Math.random() * 900000),
          };
          await setDoc(doc(db, "users", uid), fallbackUser);
          onLoginSuccess(fallbackUser);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("Domain not authorized in Firebase Console -> Authentication -> Settings -> Authorized domains.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Email/Password or Google Authentication is disabled in your Firebase Console.");
      } else {
        setError(err.message || "An authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Quick Sign In for testing roles seamlessly
  const handleQuickSignIn = async (demoRole: UserRole) => {
    setLoading(true);
    setError("");

    let demoEmail = "";
    let demoName = "";
    let demoExtra = "";

    if (demoRole === "student") {
      demoEmail = "alex.mercer@campus.edu";
      demoName = "Alex Mercer";
      demoExtra = "STUDENT-4920";
    } else if (demoRole === "merchant") {
      demoEmail = "library.cafe@campus.edu";
      demoName = "Library Café Manager";
      demoExtra = "Library Café";
    } else if (demoRole === "parent") {
      demoEmail = "parent.mercer@family.com";
      demoName = "Robert Mercer";
      demoExtra = "+91 98765 43210";
    } else {
      demoEmail = "admin.dean@campus.edu";
      demoName = "Dean Henderson";
      demoExtra = "Campus Admin";
    }

    const demoPassword = "campus123password";

    try {
      let userCred;
      try {
        userCred = await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      } catch (signInErr: any) {
        if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential") {
          // Create the user if they don't exist yet
          userCred = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
        } else {
          throw signInErr;
        }
      }

      const uid = userCred.user.uid;
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);

      let userData: CampusUser;
      if (!userDoc.exists()) {
        userData = {
          uid,
          name: demoName,
          displayName: demoName,
          email: demoEmail,
          role: demoRole,
          wallet: 1000,
          balance: 1000,
          createdAt: Date.now(),
          ...(demoRole === "student" && { studentId: demoExtra }),
          ...(demoRole === "merchant" && { merchantName: demoExtra }),
        };
        await setDoc(userDocRef, userData);
      } else {
        const data = userDoc.data();
        userData = {
          ...data,
          uid,
          name: data.name || data.displayName || demoName,
          displayName: data.displayName || data.name || demoName,
          email: data.email || demoEmail,
          wallet: data.wallet !== undefined ? data.wallet : (data.balance !== undefined ? data.balance : 1000),
          balance: data.balance !== undefined ? data.balance : (data.wallet !== undefined ? data.wallet : 1000),
          role: data.role || demoRole
        } as CampusUser;
      }

      onLoginSuccess(userData);
    } catch (err: any) {
      console.error("Demo login error:", err);
      setError("Failed to initialize demo account. Please try manual register.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-600 text-white shadow-md mb-4">
          <Wallet className="h-8 w-8" id="wallet-logo-icon" />
        </div>
        <h2 className="text-3xl font-extrabold text-blue-900 tracking-tight">
          CampEX 2.0
        </h2>
        <p className="mt-2 text-sm text-slate-600 font-medium">
          Secure, instant smart transactions across the university campus.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-slate-100 rounded-2xl sm:px-10 space-y-6">
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm p-3 rounded-lg font-medium">
              {error}
            </div>
          )}

          {/* Google Sign-In Section */}
          <div>
            <button
              id="google-signin-btn"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 shadow-sm transition text-sm disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24a7.19 7.19 0 0 1 0-4.48V6.61H1.29a11.97 11.97 0 0 0 0 10.78l3.99-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">or email auth</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          <form className="space-y-4" onSubmit={handleAuth}>
            {isSignUp && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Role Type
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["student", "parent", "merchant", "admin"] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`py-2 px-1 text-[11px] font-bold rounded-lg capitalize transition-all ${
                          role === r
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1">
                    {role === "merchant" ? "Contact Person Name" : "Full Name"}
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                    placeholder="e.g. Alex Mercer"
                  />
                </div>

                {role === "student" && (
                  <div>
                    <label htmlFor="studentId" className="block text-sm font-semibold text-slate-700 mb-1">
                      Student ID Card Number
                    </label>
                    <input
                      id="studentId"
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                      placeholder="e.g. STUDENT-4920"
                    />
                  </div>
                )}

                {role === "merchant" && (
                  <div>
                    <label htmlFor="merchantName" className="block text-sm font-semibold text-slate-700 mb-1">
                      Campus Outlet / Merchant Name
                    </label>
                    <input
                      id="merchantName"
                      type="text"
                      required
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                      placeholder="e.g. BlueRidge Library Café"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">
                University Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                placeholder="you@campus.edu"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm"
                placeholder="••••••••"
              />
            </div>

            <button
              id="submit-auth-btn"
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : isSignUp ? (
                <span className="flex items-center gap-1"><UserPlus className="h-4 w-4" /> Create Account</span>
              ) : (
                <span className="flex items-center gap-1"><LogIn className="h-4 w-4" /> Sign In</span>
              )}
            </button>
          </form>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <p className="text-xs font-bold text-slate-500 text-center uppercase tracking-wider mb-3 flex items-center justify-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Quick Demo Role Logins
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleQuickSignIn("student")}
                className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 py-2 px-1 rounded-lg text-xs font-bold transition text-center"
              >
                Student Roll
              </button>
              <button
                type="button"
                onClick={() => handleQuickSignIn("parent")}
                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 py-2 px-1 rounded-lg text-xs font-bold transition text-center"
              >
                Parent Portal
              </button>
              <button
                type="button"
                onClick={() => handleQuickSignIn("merchant")}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2 px-1 rounded-lg text-xs font-bold transition text-center"
              >
                Merchant Roll
              </button>
              <button
                type="button"
                onClick={() => handleQuickSignIn("admin")}
                className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 py-2 px-1 rounded-lg text-xs font-bold transition text-center"
              >
                Dean Admin
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">
              Demo accounts auto-register real users in Firestore with ₹1,000 balance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
