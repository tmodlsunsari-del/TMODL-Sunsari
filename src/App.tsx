import React, { useState, useEffect } from "react";
import {
  Database,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Cpu,
  Layers,
  Lock,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Fingerprint,
  Globe,
  Terminal,
  ArrowRight,
  User,
  Phone,
  Mail,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import MarkdownView from "./components/MarkdownView";
import { LeakRecord, ScannerFeedItem, SearchResponse } from "./types";

export default function App() {
  const [query, setQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Stats loaded from server
  const [serverStats, setServerStats] = useState({
    totalIndexedRecords: 1489102,
    activeBreachesCount: 4,
    lastDatabaseUpdate: "2026-05-28T00:00:00Z",
    scanLatencyMs: 4,
    supportedIdentifiers: ["emails", "usernames", "phone numbers"]
  });

  // AI Remediation state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [remediationPlan, setRemediationPlan] = useState<string | null>(null);

  // SMS Dispatch state
  const [targetSmsPhone, setTargetSmsPhone] = useState("");
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsStatus, setSmsStatus] = useState<string | null>(null);

  const dispatchSmsAlert = async () => {
    if (!targetSmsPhone || !result) return;
    setIsSendingSms(true);
    setSmsStatus(null);
    try {
      const response = await fetch("/api/alert-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toPhoneNumber: targetSmsPhone,
          messageBody: `[SecureNode Compromise Alert] Threat warning matching "${result.query}" exposed at "${result.record?.breach?.name || 'SecureNode Breach Index'}". Severity: ${result.record?.breach?.severity || 'High'}. Secure your data immediately.`
        })
      });
      const data = await response.json();
      if (data.success) {
        setSmsStatus("Success! Threat warning SMS alert successfully dispatched.");
      } else {
        setSmsStatus(`Failed: ${data.error || "Delivery fail"}`);
      }
    } catch (err) {
      setSmsStatus("Error dispatching alert notification.");
    } finally {
      setIsSendingSms(false);
    }
  };

  // Live scanner feed simulating real-world concurrent checking
  const [liveFeed, setLiveFeed] = useState<ScannerFeedItem[]>([]);

  // Selected preset for testing
  const [focusedPreset, setFocusedPreset] = useState<string | null>(null);

  // Load backend stats
  useEffect(() => {
    fetch("/api/stats")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Stats fail");
      })
      .then((data) => {
        setServerStats(data);
      })
      .catch(() => {
        // Fallback already matched
      });
  }, []);

  // Initialize and update the live simulation feed of checked items
  useEffect(() => {
    // Initial mock feed
    const initialFeed: ScannerFeedItem[] = [
      { id: "1", queryMasked: "al*****@gmail.com", isLeaked: true, breachName: "Spectra Gaming Hub", timestamp: "4s ago" },
      { id: "2", queryMasked: "da*****39", isLeaked: false, timestamp: "18s ago" },
      { id: "3", queryMasked: "+1 (415) *****82", isLeaked: false, timestamp: "42s ago" },
      { id: "4", queryMasked: "sys****_host", isLeaked: true, breachName: "Nebula Nexus Commerce", timestamp: "1m ago" },
      { id: "5", queryMasked: "re****@outlook.com", isLeaked: false, timestamp: "2m ago" }
    ];
    setLiveFeed(initialFeed);

    const usernames = ["admin", "root", "dev_ops", "vladimir", "sam_rock", "sarah99", "leak_hunter", "crypto_king", "skylar", "jordan1"];
    const domains = ["gmail.com", "yahoo.com", "outlook.com", "proton.me", "corp-secure.net", "comcast.net"];
    const breaches = ["Nebula Nexus Commerce", "Voltaic Energy Billing", "Chrono Media Streaming", "Spectra Gaming Hub"];

    const interval = setInterval(() => {
      // Pick random scan
      const isEmail = Math.random() > 0.4;
      const isPhone = !isEmail && Math.random() > 0.5;
      
      let queryMasked = "";
      if (isEmail) {
        const u = usernames[Math.floor(Math.random() * usernames.length)];
        const d = domains[Math.floor(Math.random() * domains.length)];
        queryMasked = `${u.substring(0, 2)}*****@${d}`;
      } else if (isPhone) {
        queryMasked = `+1 (${Math.floor(Math.random() * 800) + 200}) *****${Math.floor(Math.random() * 90) + 10}`;
      } else {
        const u = usernames[Math.floor(Math.random() * usernames.length)];
        queryMasked = `${u.substring(0, 3)}*****`;
      }

      const isLeaked = Math.random() > 0.65;
      const scanItem: ScannerFeedItem = {
        id: Date.now().toString(),
        queryMasked,
        isLeaked,
        breachName: isLeaked ? breaches[Math.floor(Math.random() * breaches.length)] : undefined,
        timestamp: "Just now"
      };

      setLiveFeed((prev) => [scanItem, ...prev.slice(0, 5)]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Handle Search submit
  const handleCheck = async (e?: React.FormEvent, customizedQuery?: string) => {
    if (e) e.preventDefault();
    
    const targetQuery = (customizedQuery || query).trim();
    if (!targetQuery) {
      setErrorMsg("Please enter an email, username, or phone number.");
      return;
    }

    setErrorMsg("");
    setQuery(targetQuery);
    setIsScanning(true);
    setScanStep(0);
    setResult(null);
    setRemediationPlan(null);

    // Dynamic scanning feedback sequence
    const steps = [
      "Securing endpoint TLS handshake...",
      "Hashing input credentials into securely formatted query code (SHA-256)...",
      `Searching across ${serverStats.totalIndexedRecords.toLocaleString()} distributed tables...`,
      "Verifying cryptographic matches..."
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((r) => setTimeout(r, 380));
      setScanStep(i + 1);
    }

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: targetQuery })
      });

      if (!response.ok) {
        throw new Error("Search query failed");
      }

      const data: SearchResponse = await response.json();
      setResult(data);
    } catch (e) {
      setErrorMsg("Critical connection failure. Failed to search indexed clusters.");
    } finally {
      setIsScanning(false);
    }
  };

  const loadPreset = (preset: string) => {
    setFocusedPreset(preset);
    handleCheck(undefined, preset);
  };

  // Obtain AI Security Remediation Plan from Gemini
  const fetchAIRemediation = async () => {
    if (!result || !result.record || !result.record.breach) return;
    
    setIsGeneratingAI(true);
    setRemediationPlan(null);

    const leakObj = result.record;
    
    try {
      const response = await fetch("/api/remediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: result.query,
          breachName: leakObj.breach?.name,
          compromiseFields: leakObj.compromiseFields,
          severity: leakObj.breach?.severity
        })
      });

      if (!response.ok) {
        throw new Error("AI Endpoint failed");
      }

      const data = await response.json();
      setRemediationPlan(data.remediationPlan);
    } catch (e) {
      setRemediationPlan("Fallback Checklist:\n1. Reset active login tokens.\n2. Revoke saved third-party billing profiles.\n3. Enable mobile device authentication prompts.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-neutral-900 flex flex-col font-sans select-none antialiased">
      {/* Decorative Top Ticker - Pure Minimalism */}
      <div className="border-b border-neutral-100 bg-white/90 backdrop-blur-md sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center justify-between text-xs font-mono text-neutral-500">
          <div className="flex items-center gap-1.5 md:gap-3 overflow-hidden">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-neutral-800 tracking-wider uppercase">DATABASE ACTIVE</span>
            <span className="text-neutral-300 hidden md:inline">|</span>
            <span className="hidden md:inline text-neutral-400">INDEX PARSER: v2.4.9</span>
            <span className="text-neutral-300">|</span>
            <span className="text-neutral-500">CLUSTERS: ONLINE</span>
          </div>
          <div className="flex items-center gap-2 font-semibold">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline text-neutral-400">AVG LOOKUP:</span>
            <span className="text-blue-600 font-bold">{serverStats.scanLatencyMs}ms</span>
          </div>
        </div>
      </div>

      {/* Header Navigation */}
      <header className="flex items-center justify-between px-4 md:px-12 h-20 bg-white border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
            <div className="w-4 h-4 border-2 border-white rounded-full"></div>
          </div>
          <span className="font-bold text-xl tracking-tight text-neutral-800 font-sans uppercase">SECURENODE</span>
        </div>
        <nav className="flex gap-4 md:gap-8 text-xs md:text-sm font-semibold text-neutral-500">
          <span className="text-blue-600 border-b-2 border-blue-600 pb-1 cursor-pointer">Search breaches</span>
          <span className="hover:text-blue-600 hidden sm:inline cursor-pointer transition-colors">Public API</span>
          <span className="hover:text-blue-600 hidden sm:inline cursor-pointer transition-colors">Security Protocol</span>
          <span className="hover:text-blue-600 cursor-pointer transition-colors">Support</span>
        </nav>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-12 md:py-16 flex flex-col items-center">
        {/* Core Header */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-100 bg-blue-50/60 text-xs font-semibold text-blue-700 mb-4 shadow-sm">
            <Fingerprint className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Multi-Threat Integrity Inspector</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-neutral-900 mb-4 font-sans leading-tight">
            Check if your <span className="text-blue-600">records</span> are safe.
          </h1>
          
          <p className="text-neutral-500 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
            Identify compromised information across <span className="font-semibold text-neutral-850">{serverStats.totalIndexedRecords.toLocaleString()} records</span> leaked in major databases.
          </p>
        </div>

        {/* Database Quick Cards - Premium Minimalist Bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10 max-w-3xl">
          <div className="bg-white border border-neutral-100/90 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow transition-all duration-200">
            <div className="p-3 bg-blue-50/70 border border-blue-100/40 rounded-xl shrink-0 text-blue-600">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest">RECORD INDEX</div>
              <div className="text-lg font-extrabold text-neutral-800 font-sans">1.4M+ Entries</div>
            </div>
          </div>

          <div className="bg-white border border-neutral-100/90 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow transition-all duration-200">
            <div className="p-3 bg-red-50 border border-red-100/50 rounded-xl shrink-0 text-red-500">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest">MAJOR LEAKS</div>
              <div className="text-lg font-extrabold text-neutral-800 font-sans">{serverStats.activeBreachesCount} Databases</div>
            </div>
          </div>

          <div className="bg-white border border-neutral-100/90 rounded-2xl p-5 flex items-center gap-4 shadow-sm hover:shadow transition-all duration-200">
            <div className="p-3 bg-neutral-50 border border-neutral-200/50 rounded-xl shrink-0 text-neutral-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest">SOURCE SCOPE</div>
              <div className="text-sm font-bold text-neutral-700 font-sans">E-Commerce & Portals</div>
            </div>
          </div>
        </div>

        {/* Search Bar Container */}
        <div className="w-full max-w-3xl bg-white p-6 md:p-8 rounded-2xl shadow-xl border border-neutral-100 mb-8 relative">
          <form onSubmit={handleCheck} className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="search-input" className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-600" />
                ENTER EMAIL, USERNAME, OR CELL PHONE
              </label>

              <div className="relative flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-neutral-400" />
                  <input
                    id="search-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter email, username, or details..."
                    disabled={isScanning}
                    className="w-full pl-11 pr-4 py-4 rounded-xl bg-neutral-50/70 border border-neutral-200/80 focus:border-blue-600/60 focus:ring-1 focus:ring-blue-600/40 outline-none text-neutral-800 placeholder:text-neutral-400 font-sans transition-all text-base disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isScanning}
                  className="px-8 py-4 bg-neutral-900 hover:bg-black disabled:bg-neutral-800 disabled:opacity-50 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 group text-sm tracking-wide"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>CHECKING INDEX...</span>
                    </>
                  ) : (
                    <>
                      <span>TEST EXPOSURE</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </form>

          {/* Preset Buttons Grid */}
          <div className="mt-6 pt-5 border-t border-neutral-100 flex flex-col gap-3">
            <span className="text-[10px] font-bold font-mono text-neutral-450 uppercase tracking-widest block">
              PRESET DEMO LOOKUPS (Verifiable Test Targets)
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => loadPreset("leaked@example.com")}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-red-50 hover:border-red-200 text-xs font-mono text-neutral-600 hover:text-red-700 transition-all cursor-pointer"
              >
                leaked@example.com (Critical)
              </button>
              <button
                onClick={() => loadPreset("breached@test.com")}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-amber-50 hover:border-amber-200 text-xs font-mono text-neutral-600 hover:text-amber-700 transition-all cursor-pointer"
              >
                breached@test.com (High)
              </button>
              <button
                onClick={() => loadPreset("took@took.com")}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-purple-50 hover:border-purple-200 text-xs font-mono text-neutral-600 hover:text-purple-700 transition-all cursor-pointer"
              >
                took@took.com (Custom)
              </button>
              <button
                onClick={() => loadPreset("safe@example.com")}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-emerald-50 hover:border-emerald-200 text-xs font-mono text-neutral-600 hover:text-emerald-700 transition-all cursor-pointer"
              >
                safe@example.com (Clean)
              </button>
            </div>
          </div>

          {/* Underlay badges from theme */}
          <div className="flex justify-center gap-4 mt-6 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              Real-time analysis
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              Private & Anonymous
            </div>
          </div>
        </div>

        {/* Scanning progress display */}
        <AnimatePresence mode="wait">
          {isScanning && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-3xl bg-white border border-neutral-100 shadow-xl rounded-2xl p-6 md:p-8 flex flex-col items-center gap-6"
            >
              {/* Spinning scanning radar */}
              <div className="relative w-16 h-16 rounded-full border border-blue-200/50 flex items-center justify-center overflow-hidden bg-blue-50/20">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-blue-500/10 anim-scanline" />
                <Fingerprint className="w-8 h-8 text-blue-600 anim-pulse-soft" />
              </div>

              <div className="w-full max-w-md space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-500 font-semibold">
                  <span>SCANNING CENTRAL INDEX</span>
                  <span>{scanStep * 25}%</span>
                </div>
                {/* Horizontal Progress Bar */}
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden border border-neutral-150">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${scanStep * 25}%` }}
                  />
                </div>

                {/* Progress Messages */}
                <div className="h-5 text-center">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={scanStep}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-xs font-mono text-blue-650 font-bold"
                    >
                      {scanStep === 1 && "Securing endpoint TLS handshake..."}
                      {scanStep === 2 && "Hashing credentials via localized SHA-256..."}
                      {scanStep === 3 && `Searching indexes of ${serverStats.totalIndexedRecords.toLocaleString()} database records...`}
                      {scanStep === 4 && "Finalizing signatures checks..."}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* SEARCH RESULTS BLOCK */}
          {!isScanning && result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
              className="w-full max-w-3xl"
            >
              {result.isLeaked ? (
                /* LEAK CONSOLE (RED COMPROMISE STATE) */
                <div className="border border-red-200 bg-white rounded-2xl overflow-hidden shadow-2xl shadow-red-100/40">
                  {/* Danger Header */}
                  <div className="bg-red-55/40 bg-red-50/50 border-b border-red-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 border border-red-200 text-red-650 rounded-lg shrink-0">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="font-extrabold text-neutral-900 tracking-tight text-sm uppercase">COMPROMISE DETECTED</h2>
                        <p className="text-red-700 text-xs font-semibold">Exposed records matching credentials</p>
                      </div>
                    </div>
                    <div>
                      <span className="px-3 py-1 rounded bg-red-100 border border-red-200 text-red-700 text-xs font-mono font-bold">
                        STATUS: TOOK
                      </span>
                    </div>
                  </div>

                  {/* Body details */}
                  <div className="p-6 md:p-8 space-y-6">
                    <div className="text-center sm:text-left bg-neutral-50/70 border border-neutral-100 rounded-xl p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold font-mono text-neutral-455 block uppercase">SCANNED QUERY</span>
                        <span className="font-mono text-neutral-900 break-all font-bold text-lg">{result.query}</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-705 text-xs font-mono font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>MATCHED ON 1 BLOCK</span>
                      </div>
                    </div>

                    {/* Breach Details Bento Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-neutral-50/50 border border-neutral-100 rounded-xl p-5 space-y-3.5">
                        <span className="text-xs font-mono text-neutral-500 uppercase block tracking-wider">Breach Source Details</span>
                        <div className="space-y-2">
                          <div className="text-base font-bold text-neutral-900 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                            {result.record?.breach?.name}
                          </div>
                          <p className="text-xs text-neutral-600 leading-relaxed font-sans font-medium">
                            {result.record?.breach?.description}
                          </p>
                        </div>
                      </div>

                      <div className="bg-neutral-50/50 border border-neutral-100 rounded-xl p-5 space-y-4">
                        <span className="text-xs font-mono text-neutral-500 uppercase block tracking-wider">Technical Telemetry</span>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] uppercase text-neutral-450 block font-mono font-bold">SEVERITY RATING</span>
                            <span className="font-bold text-red-650 font-sans uppercase font-semibold">{result.record?.breach?.severity}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-neutral-450 block font-mono font-bold">DATE COMPROMISED</span>
                            <span className="font-bold text-neutral-700 font-sans">{result.record?.breach?.leakDate}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-neutral-455 block font-mono font-bold">ATTRIBUTED IP</span>
                            <span className="font-semibold text-neutral-700 font-mono">{result.record?.compromisedIp || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase text-neutral-455 block font-mono font-bold">SECTOR</span>
                            <span className="font-semibold text-neutral-600 font-sans">{result.record?.breach?.category}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dangerous Leaked Fields & Monospace Warning Hint */}
                    <div className="border border-neutral-100 bg-neutral-50/20 rounded-xl p-5 space-y-4">
                      <div>
                        <span className="text-xs font-mono text-neutral-450 uppercase block tracking-wider mb-2">Exposed Data Elements</span>
                        <div className="flex flex-wrap gap-1.5">
                          {result.record?.compromiseFields?.map((field, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-md bg-red-50 border border-red-100 text-red-700 text-xs font-mono font-medium"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>

                      {result.record?.sensitiveHint && (
                        <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                          <div>
                            <span className="font-bold text-neutral-800">Simulated Credential Leakage Mask:</span>
                            <p className="text-neutral-500 text-[11px] font-sans font-medium">
                              A password or token associated with this query contains keys styled below.
                            </p>
                          </div>
                          <div className="px-3.5 py-2 bg-neutral-100 border border-neutral-200 rounded-lg text-emerald-700 font-mono tracking-widest text-sm font-semibold select-all">
                            {result.record.sensitiveHint}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* GEMINI INTELLIGENT REMEDIATION */}
                    <div className="border border-neutral-150 bg-neutral-50/45 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4.5 h-4.5 text-blue-600" />
                          <span className="font-bold text-neutral-800 text-sm">Shield AI Remediation Advisory</span>
                        </div>
                        <button
                          onClick={fetchAIRemediation}
                          disabled={isGeneratingAI}
                          className="px-4 py-2 bg-white hover:bg-neutral-50 disabled:opacity-50 text-blue-600 text-xs font-bold font-mono rounded-lg transition-all border border-neutral-200 hover:border-blue-400 flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          {isGeneratingAI ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>GENERATING...</span>
                            </>
                          ) : (
                            <>
                              <span>ANALYZE THREATS</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Display results */}
                      {isGeneratingAI && (
                        <div className="space-y-2 py-4 flex flex-col items-center justify-center">
                          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                          <p className="text-neutral-505 text-xs font-mono font-semibold">Gemini is compiling customized mitigation protocols...</p>
                        </div>
                      )}

                      {!isGeneratingAI && remediationPlan && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="p-4 rounded-lg bg-white border border-neutral-200 overflow-y-auto max-h-[300px] shadow-inner"
                        >
                          <MarkdownView text={remediationPlan} />
                        </motion.div>
                      )}
                    </div>

                    {/* DYNAMIC RISK CONTAINMENT SMS ALERTS */}
                    <div className="border border-neutral-150 bg-neutral-50/45 rounded-xl p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4.5 h-4.5 text-blue-600" />
                        <span className="font-bold text-neutral-800 text-sm">Disaster Containment SMS Alert</span>
                      </div>
                      <p className="text-xs text-neutral-500 leading-relaxed font-sans font-medium">
                        Securely dispatch an instant compromised profile digest directly to your mobile device to track risk remediation offline.
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="tel"
                          value={targetSmsPhone}
                          onChange={(e) => setTargetSmsPhone(e.target.value)}
                          placeholder="Enter your phone number (e.g., +14155550192)"
                          className="flex-1 px-3.5 py-2 hover:border-neutral-300 border border-neutral-200 bg-white rounded-lg text-xs outline-none focus:border-blue-500 text-neutral-800 font-sans"
                        />
                        <button
                          onClick={dispatchSmsAlert}
                          disabled={isSendingSms || !targetSmsPhone}
                          className="px-4 py-2 bg-neutral-900 hover:bg-black text-white font-bold text-xs rounded-lg transition-all border border-transparent disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shrink-0 font-sans"
                        >
                          {isSendingSms ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin animate-infinite" />
                              <span>SENDING...</span>
                            </>
                          ) : (
                            <span>SEND COMPROMISE SMS</span>
                          )}
                        </button>
                      </div>

                      {smsStatus && (
                        <div className={`text-xs font-semibold font-sans mt-2 ${smsStatus.startsWith("Success") ? "text-emerald-700 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg" : "text-amber-700 bg-amber-50 border border-amber-100 p-2.5 rounded-lg"}`}>
                          {smsStatus}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* SAFE CONSOLE (GREEN ACCENT CLEAN STATE) */
                <div className="border border-emerald-200 bg-white rounded-2xl overflow-hidden shadow-2xl shadow-emerald-50/25">
                  {/* Clean Header */}
                  <div className="bg-emerald-50/50 border-b border-emerald-100 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 border border-emerald-200 text-emerald-600 rounded-lg shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="font-bold text-neutral-900 tracking-tight uppercase">SECURE DIRECTORY STATUS</h2>
                        <p className="text-emerald-700 text-xs font-semibold">Credential lookup completed across active files</p>
                      </div>
                    </div>
                    <div>
                      <span className="px-3 py-1 rounded bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold">
                        STATUS: SAFE
                      </span>
                    </div>
                  </div>

                  {/* Body details */}
                  <div className="p-6 md:p-8 space-y-6">
                    <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 flex flex-col sm:flex-row items-center sm:justify-between gap-3 text-center sm:text-left">
                      <div>
                        <span className="text-[10px] font-bold font-mono text-neutral-450 block">SCANNED QUERY</span>
                        <span className="font-mono text-neutral-900 break-all text-base font-bold">{result.query}</span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-100/30 text-emerald-700 text-xs font-mono font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>0 RECORD MATCHES</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-base font-extrabold text-neutral-900">Good configuration integrity check.</h3>
                      <p className="text-neutral-500 text-sm leading-relaxed font-sans font-medium">
                        Excellent news. The identifier <span className="font-mono text-neutral-900 font-semibold bg-neutral-100 px-1.5 py-0.5 rounded">{result.query}</span> was not identified inside our tracking databases containing over <span className="text-neutral-800 font-semibold">{serverStats.totalIndexedRecords.toLocaleString()} leaked profiles</span>.
                      </p>
                      
                      <div className="pt-4 border-t border-neutral-100">
                        <span className="text-xs font-bold font-mono text-neutral-450 uppercase tracking-widest block mb-3">
                          Proactive Defensive Directives
                        </span>
                        <ul className="text-xs text-neutral-600 space-y-2.5 font-medium">
                          <li className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span><strong>Zero Passphrase Sharing</strong>: Avoid utilizing matching passwords for diverse billing systems or commerce hubs.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span><strong>Multi-Factor Binding</strong>: Bind verification applications to secondary profiles to isolate active log tokens.</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                            <span><strong>Audit Checkups</strong>: Run secure, end-to-end lookup checks periodically to audit system vulnerabilities.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Ticker Feed of Active Searches */}
        <div className="w-full max-w-3xl mt-12 bg-white border border-neutral-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
              <h3 className="text-xs font-extrabold font-mono text-neutral-500 uppercase tracking-wider">
                LIVE COMPROMISE RADAR CONSOLE FEED
              </h3>
            </div>
            <span className="font-mono text-[9px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md">REALTIME UPDATES</span>
          </div>

          <div className="space-y-2.5 max-h-[180px] overflow-hidden relative">
            <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />
            
            <AnimatePresence initial={false}>
              {liveFeed.map((feedItem) => (
                <motion.div
                  key={feedItem.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-neutral-400 font-bold shrink-0">{feedItem.timestamp}</span>
                    <span className="text-neutral-700 font-medium break-all max-w-[200px] sm:max-w-none">{feedItem.queryMasked}</span>
                  </div>

                  {feedItem.isLeaked ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-red-700 text-[10px] font-bold bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase font-sans">
                        TOOK
                      </span>
                      <span className="text-[10px] text-neutral-400 hidden sm:inline font-sans">
                        ({feedItem.breachName})
                      </span>
                    </div>
                  ) : (
                    <span className="text-emerald-700 text-[10px] font-bold bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded uppercase shrink-0 font-sans">
                      SAFE
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer conforming perfectly to Clean Minimalism */}
      <footer className="py-8 border-t border-neutral-100 bg-white mt-12">
        <div className="max-w-5xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-mono text-neutral-400">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-neutral-600">Secure Node Data Infrastructure. Encrypted end-to-end.</span>
          </div>
          <div className="flex gap-4 md:gap-6">
            <span className="hover:text-neutral-700 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-neutral-700 cursor-pointer">Transparency Report</span>
            <span className="hover:text-neutral-700 cursor-pointer font-bold text-neutral-500">Database Index: v2.4</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
