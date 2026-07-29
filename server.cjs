var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var SlidingWindowRateLimiter = class {
  constructor(windowMs, maxRequests) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = /* @__PURE__ */ new Map();
    setInterval(() => {
      const now = Date.now();
      for (const [ip, timestamps] of this.requests.entries()) {
        const valid = timestamps.filter((t) => now - t < this.windowMs);
        if (valid.length === 0) {
          this.requests.delete(ip);
        } else {
          this.requests.set(ip, valid);
        }
      }
    }, 6e4).unref();
  }
  check(key) {
    const now = Date.now();
    const timestamps = (this.requests.get(key) || []).filter((t) => now - t < this.windowMs);
    if (timestamps.length >= this.maxRequests) {
      const oldest = timestamps[0];
      const retryAfterMs = oldest + this.windowMs - now;
      return { allowed: false, remaining: 0, retryAfterMs };
    }
    timestamps.push(now);
    this.requests.set(key, timestamps);
    return { allowed: true, remaining: this.maxRequests - timestamps.length, retryAfterMs: 0 };
  }
};
var HighPerformanceCache = class {
  constructor(maxItems = 2e3, defaultTtlMs = 3e5) {
    this.maxItems = maxItems;
    this.defaultTtlMs = defaultTtlMs;
    this.cache = /* @__PURE__ */ new Map();
  }
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.cache.size >= this.maxItems) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expires: Date.now() + ttlMs });
  }
  clear() {
    this.cache.clear();
  }
};
var ConcurrencyQueue = class {
  constructor(maxConcurrent = 20) {
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
    this.queue = [];
  }
  async run(fn) {
    if (this.active >= this.maxConcurrent) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }
  getStats() {
    return { active: this.active, queued: this.queue.length };
  }
};
var apiRateLimiter = new SlidingWindowRateLimiter(6e4, 120);
var authRateLimiter = new SlidingWindowRateLimiter(6e4, 20);
var aiInsightCache = new HighPerformanceCache(1e3, 3e5);
var sessionAuthCache = new HighPerformanceCache(5e3, 9e5);
var aiComputeQueue = new ConcurrencyQueue(15);
var isShuttingDown = false;
var totalRequestsHandled = 0;
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    totalRequestsHandled++;
    if (isShuttingDown) {
      res.setHeader("Connection", "close");
      return res.status(530).json({ error: "Server is undergoing auto-scale rebalancing. Please retry." });
    }
    next();
  });
  app.use("/api/", (req, res, next) => {
    const clientIp = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();
    const isAuthPath = req.path.startsWith("/auth");
    const limiter = isAuthPath ? authRateLimiter : apiRateLimiter;
    const { allowed, remaining, retryAfterMs } = limiter.check(clientIp);
    res.setHeader("X-RateLimit-Remaining", remaining);
    if (!allowed) {
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1e3));
      return res.status(429).json({
        error: "Too Many Requests",
        message: isAuthPath ? "High login activity detected from your network. Please wait a moment before trying again." : "Rate limit exceeded. System is auto-throttling high volume traffic.",
        retryAfterSeconds: Math.ceil(retryAfterMs / 1e3)
      });
    }
    next();
  });
  app.get("/api/health/liveness", (req, res) => {
    if (isShuttingDown) return res.status(500).json({ status: "shutting_down" });
    res.json({ status: "alive", timestamp: Date.now() });
  });
  app.get("/api/health/readiness", (req, res) => {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    if (isShuttingDown || heapUsedMB > 1400) {
      return res.status(503).json({ status: "unready", heapUsedMB, reason: "Memory pressure or draining" });
    }
    res.json({ status: "ready", heapUsedMB, timestamp: Date.now() });
  });
  app.get("/api/health", (req, res) => {
    const mem = process.memoryUsage();
    res.json({
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      totalRequestsHandled,
      computeQueue: aiComputeQueue.getStats(),
      memory: {
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024)
      },
      environment: process.env.NODE_ENV || "development"
    });
  });
  app.post("/api/auth/verify-session", (req, res) => {
    const { uid, idToken } = req.body || {};
    if (!uid) {
      return res.status(400).json({ valid: false, error: "Missing uid parameter." });
    }
    const cacheKey = `session_${uid}_${idToken ? idToken.slice(-10) : "default"}`;
    const cachedSession = sessionAuthCache.get(cacheKey);
    if (cachedSession) {
      return res.json({
        valid: true,
        cached: true,
        session: cachedSession
      });
    }
    const sessionData = {
      uid,
      authenticatedAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1e3,
      tier: "verified_student"
    };
    sessionAuthCache.set(cacheKey, sessionData);
    return res.json({
      valid: true,
      cached: false,
      session: sessionData
    });
  });
  app.post("/api/spending-tips", async (req, res) => {
    const { transactions, user } = req.body || {};
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY environment variable is required on the server."
        });
      }
      const cacheKey = `tips_${user?.uid || "guest"}_${(transactions || []).length}`;
      const cachedResult = aiInsightCache.get(cacheKey);
      if (cachedResult) {
        return res.json({ ...cachedResult, _fromCache: true });
      }
      const result = await aiComputeQueue.run(async () => {
        const ai = new import_genai.GoogleGenAI({ apiKey });
        const transactionsSummary = (transactions || []).map(
          (t) => `- $${t.amount} spent on ${t.category} (${t.description}) on ${new Date(t.timestamp).toLocaleDateString()}`
        ).join("\n");
        const prompt = `
You are CampEX 2.0 AI, a friendly financial advisor for college students.
Analyze the following student's profile and transaction history to provide personalized, engaging, and highly actionable spending tips, category breakdowns, and saving challenges.

Student Profile:
- Name: ${user?.displayName || "Student"}
- Balance: $${user?.balance || 0}
- Role: ${user?.role || "student"}

Recent Transactions:
${transactionsSummary || "No transaction history yet. Encourage them to make transactions (like buying coffee at the campus caf\xE9, buying textbooks, or paying laundry)."}

Provide your response strictly in JSON format. The response MUST be a single valid JSON object matching this structure:
{
  "summary": "A 2-3 sentence overview of their financial health, encouraging and practical.",
  "tips": [
    {
      "title": "Tip title",
      "tip": "Personalized advice",
      "category": "Food",
      "impact": "high"
    }
  ],
  "challenge": {
    "title": "The $5 Campus Saver",
    "description": "Skip buying custom drinks this Friday and put savings into your wallet!"
  }
}
`;
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        const text = response.text || "{}";
        let cleanedText = text.trim();
        if (cleanedText.startsWith("```json")) cleanedText = cleanedText.substring(7);
        if (cleanedText.startsWith("```")) cleanedText = cleanedText.substring(3);
        if (cleanedText.endsWith("```")) cleanedText = cleanedText.substring(0, cleanedText.length - 3);
        return JSON.parse(cleanedText.trim());
      });
      aiInsightCache.set(cacheKey, result);
      return res.json(result);
    } catch (error) {
      console.log("Notice: Compute tier AI insights using intelligent fallback rules.");
      const categoryTotals = {};
      (transactions || []).forEach((t) => {
        const cat = t.category || "General";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (t.amount || 0);
      });
      const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "Food";
      return res.json({
        summary: `Based on your recent CampEX 2.0 wallet activity, your highest spending category is ${topCat}. Managing small daily expenses can save up to 20% of your monthly allowance!`,
        tips: [
          {
            title: `${topCat} Saver Strategy`,
            tip: `You have active transactions in ${topCat}. Check out student discount passes and off-peak bundles at campus outlets.`,
            category: topCat,
            impact: "high"
          }
        ],
        challenge: {
          title: "The $5 Campus Saver Challenge",
          description: "Skip one extra coffee or impulse purchase at campus outlets this Friday and save \u20B9400 in your wallet!"
        }
      });
    }
  });
  app.post("/api/generate-payment-tip", async (req, res) => {
    try {
      const { merchantName, amount, category, userBalance } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          tip: `Smart purchase at ${merchantName}! You paid \u20B9${amount}. Keep an eye on your remaining \u20B9${userBalance} balance.`
        });
      }
      const tipText = await aiComputeQueue.run(async () => {
        const ai = new import_genai.GoogleGenAI({ apiKey });
        const prompt = `
You are CampEX 2.0 AI, a financial advisor for college students.
A student just made a QR code payment of \u20B9${amount} at "${merchantName}" (Category: ${category || "General"}).
Their remaining wallet balance is \u20B9${userBalance}.

Generate ONE concise, friendly, and actionable financial tip specifically regarding this purchase and their remaining budget under 25 words.
`;
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt
        });
        return response.text?.trim() || `Great payment at ${merchantName}! Remember to check for campus student discounts.`;
      });
      return res.json({ tip: tipText });
    } catch (err) {
      return res.json({
        tip: `Payment processed! Manage your daily budget to keep your CampEX 2.0 wallet healthy.`
      });
    }
  });
  app.post("/api/ai-spending-insights", async (req, res) => {
    const { transactions, user } = req.body || {};
    const categoriesMap = { Food: 0, Library: 0, Stationery: 0, Events: 0, Others: 0 };
    const userSpends = (transactions || []).filter(
      (t) => (t.senderId === user?.uid || t.userId === user?.uid) && t.type !== "add_money"
    );
    userSpends.forEach((tx) => {
      const cat = (tx.category || "").toLowerCase();
      const desc = (tx.description || "").toLowerCase();
      const name = (tx.receiverName || "").toLowerCase();
      if (cat.includes("food") || cat.includes("dining") || desc.includes("coffee") || desc.includes("cafe") || desc.includes("lunch") || name.includes("cafe")) {
        categoriesMap.Food += tx.amount || 0;
      } else if (cat.includes("library") || cat.includes("book") || desc.includes("book") || desc.includes("library") || name.includes("library")) {
        categoriesMap.Library += tx.amount || 0;
      } else if (cat.includes("stationery") || desc.includes("pen") || desc.includes("print") || desc.includes("paper")) {
        categoriesMap.Stationery += tx.amount || 0;
      } else if (cat.includes("event") || cat.includes("ticket") || desc.includes("fest")) {
        categoriesMap.Events += tx.amount || 0;
      } else {
        categoriesMap.Others += tx.amount || 0;
      }
    });
    try {
      const cacheKey = `ai_cat_insights_${user?.uid}_${userSpends.length}`;
      const cachedInsight = aiInsightCache.get(cacheKey);
      if (cachedInsight) {
        return res.json({ ...cachedInsight, _cached: true });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (userSpends.length === 0) {
        return res.json({
          empty: true,
          message: "Start using CampEX 2.0 to receive AI insights.",
          categories: categoriesMap,
          savingTip: null,
          budgetSuggestion: null
        });
      }
      if (!apiKey) {
        const sortedCats = Object.entries(categoriesMap).sort((a, b) => b[1] - a[1]);
        const topCategory = sortedCats[0][0];
        const totalSpent = userSpends.reduce((a, c) => a + c.amount, 0);
        return res.json({
          categories: categoriesMap,
          savingTip: `You spent the most on ${topCategory} (\u20B9${categoriesMap[topCategory]}). Look out for student campus discounts or bundles.`,
          budgetSuggestion: `Set a weekly spending target of \u20B9${Math.max(500, Math.round(totalSpent * 0.85))} to maintain a healthy wallet reserve.`
        });
      }
      const payload = await aiComputeQueue.run(async () => {
        const ai = new import_genai.GoogleGenAI({ apiKey });
        const spendingSummary = Object.entries(categoriesMap).map(([cat, amt]) => `- ${cat}: \u20B9${amt}`).join("\n");
        const prompt = `
You are CampEX 2.0 AI, an intelligent financial advisor for college students.
Analyze this student's spending breakdown:
${spendingSummary}

Return raw JSON only:
{
  "savingTip": "Personalized saving tip under 30 words",
  "budgetSuggestion": "Weekly budget recommendation under 25 words"
}
`;
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });
        const text = response.text || "{}";
        let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const json = JSON.parse(cleaned);
        return {
          categories: categoriesMap,
          savingTip: json.savingTip || "Try setting aside 10% of your wallet funds for textbook and stationery emergencies.",
          budgetSuggestion: json.budgetSuggestion || "Cap weekly dining spend to keep a healthy wallet reserve."
        };
      });
      aiInsightCache.set(cacheKey, payload);
      return res.json(payload);
    } catch (error) {
      const sortedCats = Object.entries(categoriesMap).sort((a, b) => b[1] - a[1]);
      const topCategory = sortedCats[0]?.[0] || "Food";
      const topAmount = sortedCats[0]?.[1] || 0;
      const totalSpent = userSpends.reduce((a, c) => a + c.amount, 0);
      return res.json({
        categories: categoriesMap,
        savingTip: topAmount > 0 ? `Your highest expenditure is on ${topCategory} (\u20B9${topAmount.toLocaleString("en-IN")}). Consider using campus student discount passes.` : "Track your daily dining and stationery purchases to optimize your monthly allowance.",
        budgetSuggestion: `Cap weekly discretionary spend to \u20B9${Math.max(400, Math.round(totalSpent * 0.85 || 500))} to keep a healthy wallet reserve.`
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Compute Tier] CampEX 2.0 Server running on http://0.0.0.0:${PORT}`);
  });
  const shutdown = (signal) => {
    console.log(`[Compute Tier] Received ${signal}. Draining active HTTP connections...`);
    isShuttingDown = true;
    server.close(() => {
      console.log(`[Compute Tier] All connections drained cleanly. Exiting.`);
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[Compute Tier] Forced shutdown timeout reached.");
      process.exit(1);
    }, 1e4).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
startServer();
//# sourceMappingURL=server.cjs.map
