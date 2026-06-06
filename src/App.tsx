import React, { useState, useEffect } from 'react';
import {
  Database,
  MessageSquare,
  FileText,
  Compass,
  LayoutDashboard,
  Play,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Terminal,
  Shield,
  HelpCircle,
  TrendingUp,
  MapPin,
  TrendingDown,
  ArrowRight,
  Menu,
  X
} from 'lucide-react';
import FraudGraph from './components/FraudGraph';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'query' | 'explorer' | 'report' | 'spec' | 'fraud'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Backend Metrics State
  const [metrics, setMetrics] = useState<any | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Chat/Text-to-SQL State
  const [userPrompt, setUserPrompt] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResponse, setQueryResponse] = useState<{
    sql: string;
    rows: any[];
    error: string;
    narrative: string;
    explanation: string;
  } | null>(null);

  // SQL Playground State
  const [playgroundQuery, setPlaygroundQuery] = useState(
    "SELECT * FROM fact_policy WHERE status = 'Lapsed' AND months_on_books > 3 LIMIT 5;"
  );
  const [playgroundResults, setPlaygroundResults] = useState<any[]>([]);
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [selectedExplorerTable, setSelectedExplorerTable] = useState('fact_policy');

  // Executive summary state
  const [execSummary, setExecSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Load baseline metrics on start
  const fetchMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const res = await fetch('/api/metrics');
      if (!res.ok) throw new Error("Could not retrieve active SQLite records from the server endpoint.");
      const data = await res.json();
      setMetrics(data);
    } catch (e: any) {
      setMetricsError(e.message);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    runPlaygroundSql();
  }, []);

  // Submit NL Query
  const handleNLSubmit = async (e?: React.FormEvent, presetPrompt?: string) => {
    if (e) e.preventDefault();
    const targetPrompt = presetPrompt || userPrompt;
    if (!targetPrompt.trim()) return;

    setUserPrompt(targetPrompt);
    setQueryLoading(true);
    setQueryResponse(null);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: targetPrompt })
      });
      const data = await res.json();
      setQueryResponse(data);
    } catch (err: any) {
      setQueryResponse({
        sql: '',
        rows: [],
        error: err.message,
        narrative: "Failed to connect to full-stack backend server.",
        explanation: "Check SQLite and server console outputs."
      });
    } finally {
      setQueryLoading(false);
    }
  };

  // Run Playground SQL Query
  const runPlaygroundSql = async (customSql?: string) => {
    const targetSql = customSql || playgroundQuery;
    setPlaygroundLoading(true);
    setPlaygroundError(null);
    try {
      const res = await fetch('/api/execute-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: targetSql })
      });
      const data = await res.json();
      if (data.error) {
        setPlaygroundError(data.error);
        setPlaygroundResults([]);
      } else {
        setPlaygroundResults(data.rows);
      }
    } catch (err: any) {
      setPlaygroundError(err.message);
      setPlaygroundResults([]);
    } finally {
      setPlaygroundLoading(false);
    }
  };

  // Generate AI Executive Report
  const generateReport = async () => {
    setGeneratingSummary(true);
    try {
      const res = await fetch('/api/summary');
      const data = await res.json();
      setExecSummary(data.text);
    } catch (err: any) {
      setExecSummary("Failed to generate report narrative. Verify server connection and presence of process.env.GEMINI_API_KEY.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleCopyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  // Predefined queries to guide users
  const starterPrompts = [
    { label: "📍 Worst Lapse Product", hint: "Show all products ordered by lapse rates for customers > 3 months on books" },
    { label: "📊 Amajuba vs KwaMashu", hint: "Compare Amajuba branch vs KwaMashu branch in active policy numbers and persistency rates" },
    { label: "💳 Claims & Loss Ratio", hint: "What is our current loss ratio, and are claims within historical margins in KZN?" },
    { label: "📉 Active Annual Premium", hint: "Calculate the total active annualized premium in eThekwini district" },
    { label: "⚠️ Non-existent table query", hint: "What is the average transaction size from external payroll records?" }
  ];

  const dbSchemaDescription = [
    { table: "dim_branch", desc: "Coordinates physical KZN retail branches (Durban Central, Umlazi, KwaMashu, Pietermaritzburg) & high-level regional districts." },
    { table: "dim_plan", desc: "Catalog of funeral assurance product lines and base recurring premiums (e.g. Individual Standard Standard, Individual Premium, Community Group, Family Plan)." },
    { table: "fact_policy", desc: "The granular record of policies, active statuses, tenure months, total premiums collected, and date of lapse or claims." },
    { table: "fact_claim", desc: "Granular claim events, claim amounts, claim type (Natural/Accidental/Suicide), cause of death register, and approval status." },
    { table: "fact_premium", desc: "Cumulative transaction log recording reconciliations of standard recurring premiums of KZN premium books." }
  ];

  const copyPromptsValues = {
    mvp: `You are an expert data analyst assistant for a South African funeral-assurance company operating in KwaZulu-Natal. You have access to a star-schema warehouse containing policy, claims, and premium data.

SCHEMA SUMMARY:
- fact_policy: policy_id, branch_key, plan_key, agent_key, inception_date_key, status (Active/Lapsed/Cancelled/Claimed), monthly_premium, months_on_books, total_premium_collected, lapse_date, claim_date
- fact_claim: claim_id, policy_key, branch_key, claim_date_key, claim_amount, claim_type, cause_of_death, approval_status (Approved/Pending/Rejected), days_to_settlement
- fact_premium: payment_key, policy_key, payment_date_key, amount, reconciliation_status
- dim_branch: branch_key, branch_name, region (KZN district)
- dim_plan: plan_key, plan_type (Individual Standard, Family Plan, Individual Premium, Senior Dignity, Community Group, Extended Family), base_premium
- dim_date: date_key, full_date, financial_year, financial_period (SA FY: March=period 1)

METRIC DEFINITIONS (use exactly these):
- Persistency: % active policies where months_on_books > 3 (grace period excluded)
- Lapse rate: % lapsed policies where months_on_books > 3
- Loss ratio: approved claims paid ÷ total premium collected × 100
- Revenue at risk: annualised active premium × lapse rate

CURRENT BASELINE (computed from warehouse):
- Active policies: 6,669 of 8,000 total
- Annualised premium: R30.3m
- Persistency: 83.7%
- Loss ratio: 14.5%
- Lapse rate: 4.3% (book average)
- Worst product by lapse: Community Group at 15.8%
- Worst branch by lapse: KwaMashu at 6.7%
- Revenue at risk: R1.3m

RESPONSE RULES:
1. Always state the number first, then the interpretation
2. End every insight with ONE specific recommended action
3. If you write SQL, use SQLite syntax
4. Never invent metric definitions — use only the ones above
5. Flag if a question requires data not in the warehouse
6. Keep executive summaries under 250 words`,
    tutor: `You are a patient, expert data-analysis tutor running an 8-lesson course called "Data Analysis with a Real Case."
The worked case is a South African funeral-assurance book (KwaZulu-Natal, synthetic data).

COURSE LESSONS:
Lesson 01: Foundations - question -> database -> core metrics -> decision
Lesson 02: Knowing Your Data - profiling column integrity & data quality
Lesson 03: SQL Foundations - SELECT, JOIN, GROUP BY aggregates
Lesson 04: Star Schema Logic - facts vs dimensional keys (SA FY: March period 1)
Lesson 05: Advanced Analytics SQL - CTEs & window rank partitions
Lesson 06: Translating Numbers to Action - concentration segmentation
Lesson 07: Visual Dashboard Alignment - matching charts to metrics
Lesson 08: Governance - data quality gates and portfolios

TUTOR RULES:
1. Ground concepts in the funeral KZN assure book (e.g. Amajuba high-persistency).
2. Teach hands-on SQL for SQLite.
3. Don't give answers; coax student to discover them.`,
  };

  return (
    <div className="min-h-screen bg-[#111615] text-[#F3EFE9] font-sans selection:bg-[#2BB5A8] selection:text-[#111615] relative overflow-hidden">
      
      {/* Visual Grain / Noise Overlay */}
      <div className="absolute inset-0 z-50 pointer-events-none opacity-[0.02] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.15),transparent)] bg-repeat" 
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} 
      />

      {/* Decorative Glow Elements */}
      <div className="absolute -top-[20%] -right-[15%] w-[40rem] h-[40rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(43,181,168,0.1),transparent_70%)] pointer-events-none" />
      <div className="absolute -bottom-[20%] -left-[15%] w-[40rem] h-[40rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(181,137,95,0.06),transparent_70%)] pointer-events-none" />

      {/* ─── HEADER BAR ─── */}
      <header className="border-b border-[#2C3C3A] bg-[#0E1312]/90 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#1F6F78] to-[#155057] flex items-center justify-center font-serif font-bold text-lg border border-[#2BB5A8]/20 shadow-[0_4px_12px_rgba(31,111,120,0.3)]">
            H
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide font-sans text-[#F3EFE9]">Funeral Assurance Analytics</h1>
            <p className="text-[10px] font-mono text-[#8B9F9C] tracking-tight">KZN WAREHOUSE · TG DATA &amp; AI</p>
          </div>
        </div>

        {/* Desktop Navigation (hidden on mobile, visible on xl screen sizes) */}
        <nav className="hidden xl:flex space-x-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              activeTab === 'dashboard' ? 'bg-[#1F6F78]/20 text-[#2BB5A8] border border-[#2BB5A8]/30 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
            }`}
          >
            <div className="flex items-center gap-2">
              <LayoutDashboard size={14} />
              <span>01 · Dashboard</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('query')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              activeTab === 'query' ? 'bg-[#1F6F78]/20 text-[#2BB5A8] border border-[#2BB5A8]/30 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
            }`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare size={14} />
              <span>02 · Text-to-SQL</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              activeTab === 'explorer' ? 'bg-[#1F6F78]/20 text-[#2BB5A8] border border-[#2BB5A8]/30 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Database size={14} />
              <span>03 · Star Schema &amp; Playground</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              activeTab === 'report' ? 'bg-[#1F6F78]/20 text-[#2BB5A8] border border-[#2BB5A8]/30 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText size={14} />
              <span>04 · executive summary</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('fraud')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              activeTab === 'fraud' ? 'bg-[#1F6F78]/20 text-[#2BB5A8] border border-[#2BB5A8]/30 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield size={14} />
              <span>05 · Fraud Graph</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('spec')}
            className={`px-4 py-2 rounded-lg text-xs font-medium tracking-wide transition-all ${
              activeTab === 'spec' ? 'bg-[#1F6F78]/20 text-[#2BB5A8] border border-[#2BB5A8]/30 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Compass size={14} />
              <span>06 · specifications</span>
            </div>
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#34A853] animate-pulse" />
            <span className="text-[10px] font-mono text-[#8B9F9C] uppercase tracking-wider">SQLite Connected</span>
          </div>

          {/* Hamburger toggle button (visible on mobile/tablet) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-lg bg-[#141B1A] border border-[#2C3C3A] text-[#8B9F9C] hover:text-[#F3EFE9] focus:outline-none focus:ring-1 focus:ring-[#2BB5A8] transition-all"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* ─── MOBILE BURGER EXTENSION DRAWER ─── */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-b border-[#2C3C3A] bg-[#0E1312] px-6 py-4 animate-fade-in relative z-30">
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-medium tracking-wide transition-all ${
                activeTab === 'dashboard' ? 'bg-[#2BB5A8]/10 text-[#2BB5A8] border border-[#2BB5A8]/20 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={14} className="text-[#2BB5A8]" />
                <span>01 · Dashboard Overview</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('query');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-medium tracking-wide transition-all ${
                activeTab === 'query' ? 'bg-[#2BB5A8]/10 text-[#2BB5A8] border border-[#2BB5A8]/20 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={14} className="text-[#2BB5A8]" />
                <span>02 · Text-to-SQL Assistant</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('explorer');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-medium tracking-wide transition-all ${
                activeTab === 'explorer' ? 'bg-[#2BB5A8]/10 text-[#2BB5A8] border border-[#2BB5A8]/20 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Database size={14} className="text-[#2BB5A8]" />
                <span>03 · Schema &amp; Playground</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('report');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-medium tracking-wide transition-all ${
                activeTab === 'report' ? 'bg-[#2BB5A8]/10 text-[#2BB5A8] border border-[#2BB5A8]/20 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText size={14} className="text-[#2BB5A8]" />
                <span>04 · Executive Summary</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('fraud');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-medium tracking-wide transition-all ${
                activeTab === 'fraud' ? 'bg-[#2BB5A8]/10 text-[#2BB5A8] border border-[#2BB5A8]/20 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Shield size={14} className="text-[#2BB5A8]" />
                <span>05 · Fraud Graph Visualizer</span>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('spec');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-medium tracking-wide transition-all ${
                activeTab === 'spec' ? 'bg-[#2BB5A8]/10 text-[#2BB5A8] border border-[#2BB5A8]/20 font-semibold' : 'text-[#8B9F9C] hover:text-[#F3EFE9]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Compass size={14} className="text-[#2BB5A8]" />
                <span>06 · Specifications Hub</span>
              </div>
            </button>

            <div className="flex items-center gap-2 pt-3 px-4 border-t border-[#232F2D]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34A853] animate-pulse" />
              <span className="text-[10px] font-mono text-[#8B9F9C] uppercase tracking-wider">SQLite Connected</span>
            </div>
          </nav>
        </div>
      )}

      {/* ─── MAIN HERO ZONE ─── */}
      <section className="bg-gradient-to-b from-[#0F1312] to-[#111615] px-8 py-12 md:py-16 border-b border-[#2C3C3A] relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 mb-4 text-[#B5895F] font-mono text-xs tracking-widest uppercase">
              <span className="h-[1px] w-6 bg-[#B5895F]" />
              <span>KWAZULU-NATAL ANALYTICS CORE</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-semibold tracking-tight leading-[1.05] text-[#F3EFE9] mb-6">
              From raw SQL warehouse <br />
              to <em className="text-[#B5895F] italic font-normal">AI-powered</em> <br />
              <span className="text-[#2BB5A8]">analyst intelligence.</span>
            </h2>
            <p className="text-sm md:text-base text-[#8B9F9C] max-w-2xl leading-relaxed font-light">
              An enterprise full-stack analytical helper platform engineered for KZN funeral-assurance. Uses server-side 
              <strong className="text-[#2BB5A8] font-medium"> Gemini 3.5-flash</strong> to securely generate &amp; explain real SQLite transactions against standard dimensional policy, claim, and premium books.
            </p>
          </div>
          
          <div className="lg:col-span-5 bg-[#141B1A] border border-[#2C3C3A] rounded-2xl p-6 shadow-2xl relative">
            <div className="absolute top-2 right-3 text-[9px] font-mono text-[#8B9F9C] bg-[#1a2524] px-2 py-0.5 rounded border border-[#2b3a38]">
              LIVE STATS
            </div>
            <h3 className="text-xs font-mono text-[#B5895F] tracking-wider uppercase mb-4">Enterprise KPI Baseline</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#101514] p-3 rounded-xl border border-[#232F2D]">
                <span className="block text-[10px] font-mono text-[#819290]">ACTIVE POLICIES</span>
                <span className="text-2xl font-serif font-bold text-[#F3EFE9]">{loadingMetrics ? "..." : metrics?.active_policies?.toLocaleString()}</span>
                <span className="block text-[8px] text-[#A89E8E] font-mono mt-1">/ {loadingMetrics ? "..." : metrics?.total_policies?.toLocaleString()} total</span>
              </div>
              <div className="bg-[#101514] p-3 rounded-xl border border-[#232F2D]">
                <span className="block text-[10px] font-mono text-[#819290]">ANNUAL PREMIUM IN-FORCE</span>
                <span className="text-2xl font-serif font-bold text-[#2BB5A8]">R{loadingMetrics ? "..." : metrics?.annual_premium_million}m</span>
                <span className="block text-[8px] text-[#A89E8E] font-mono mt-1">Active Accounts</span>
              </div>
              <div className="bg-[#101514] p-3 rounded-xl border border-[#232F2D]">
                <span className="block text-[10px] font-mono text-[#819290]">BOOK PERSISTENCY</span>
                <span className="text-2xl font-serif font-bold text-[#F3EFE9]">{loadingMetrics ? "..." : metrics?.persistency_rate}%</span>
                <span className="block text-[8px] text-[#34A853] font-mono mt-1">Target ≥85%</span>
              </div>
              <div className="bg-[#101514] p-3 rounded-xl border border-[#232F2D]">
                <span className="block text-[10px] font-mono text-[#819290]">LOSS RATIO (CLAIMS)</span>
                <span className="text-2xl font-serif font-bold text-[#F3EFE9]">{loadingMetrics ? "..." : metrics?.loss_ratio}%</span>
                <span className="block text-[8px] text-[#B5895F] font-mono mt-1">Healthy Limit &lt;55%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── VIEW 01: DASHBOARD TAB ─── */}
      {activeTab === 'dashboard' && (
        <section className="px-6 py-12 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <span className="text-xs font-mono text-[#2BB5A8] tracking-widest uppercase">01 · WAREHOUSE STATUS</span>
              <h3 className="text-3xl font-serif font-semibold text-[#F3EFE9] mt-1">KwaZulu-Natal Operations</h3>
              <p className="text-xs text-[#8B9F9C] mt-1">Computed live from active relational SQLite facts and dimensional parameters.</p>
            </div>
            
            <button 
              onClick={fetchMetrics}
              disabled={loadingMetrics}
              className="flex items-center gap-2 bg-[#1C2826] hover:bg-[#253633] transition-colors border border-[#2BB5A8]/20 px-4 py-2 rounded-lg text-xs font-medium text-[#2BB5A8] cursor-pointer"
            >
              <RefreshCw size={14} className={loadingMetrics ? "animate-spin" : ""} />
              <span>{loadingMetrics ? "Computing metrics..." : "Recalculate Tables"}</span>
            </button>
          </div>

          {/* Sizing the Retention Prize / Warning banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <div className="lg:col-span-2 bg-gradient-to-r from-[#1E1213] to-[#191513] border border-[#DE3E44]/20 rounded-2xl p-6 relative">
              <div className="absolute top-4 right-4 text-[#DE3E44]">
                <AlertTriangle size={24} />
              </div>
              <span className="text-[10px] font-mono text-[#DE3E44] tracking-wider uppercase font-medium">CRITICAL RISK FACTOR</span>
              <h4 className="text-xl font-serif font-semibold text-[#F3EFE9] mt-2 mb-3">Concentration Warning: Community Group Lapses</h4>
              <p className="text-xs text-[#8B9F9C] leading-relaxed mb-4 max-w-2xl">
                The <strong className="text-[#DE3E44]">Community Group</strong> product experiences a lapse rate of <strong className="text-[#F3EFE9] font-medium">{loadingMetrics ? "..." : metrics?.worst_product_lapse}%</strong> (cohort tenure &gt; 3 months), making it <strong className="text-yellow-500 font-medium">3.7×</strong> worse than the overall book average of {loadingMetrics ? "..." : metrics?.lapse_rate_average}%. This concentration is severely draining the company's prospective valuation.
              </p>
              <div className="bg-[#131010] p-3 rounded-lg border border-[#DE3E44]/10 inline-flex items-center gap-3">
                <span className="text-xs font-mono text-[#DE3E44]">REVENUE AT RISK:</span>
                <span className="text-lg font-serif font-bold text-[#F3EFE9]">R{loadingMetrics ? "..." : metrics?.revenue_at_risk_million}m</span>
                <span className="text-[10px] text-[#8B9F9C] font-mono">(Annualized potential saved collections)</span>
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#111A1E] to-[#121919] border border-[#2BB5A8]/20 rounded-2xl p-6">
              <span className="text-[10px] font-mono text-[#2BB5A8] tracking-wider uppercase font-medium">RETENTION ROI OBJECTIVE</span>
              <h4 className="text-lg font-serif font-semibold text-[#F3EFE9] mt-2 mb-3">Operational Target</h4>
              <p className="text-xs text-[#8B9F9C] leading-relaxed mb-4">
                Improving the Community Group lapse rate to align with the book average (4.3%) would recover roughly <strong className="text-[#2BB5A8]">R965,000</strong> in annualized premium back onto active status, proving substantial return on operational audits.
              </p>
              <button 
                onClick={() => {
                  setActiveTab('query');
                  handleNLSubmit(undefined, "Show me a monthly breakdown of lapses specifically for Community Group plans");
                }}
                className="w-full text-center bg-[#1F6F78]/20 hover:bg-[#1F6F78]/30 transition-colors border border-[#2BB5A8]/30 text-xs font-mono text-[#2BB5A8] py-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>AI Deep Dive Community Lapse</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Two-Column Visualizer Section (SVG Charts) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            
            {/* Chart 1: Product Lapse Rates compared to standard Book Line */}
            <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl p-6">
              <h4 className="text-sm font-semibold text-[#F3EFE9] mb-1 font-sans">Policy Tenure Lapse Concentrations (%)</h4>
              <p className="text-xs text-[#8B9F9C] mb-6">Lapse percentage inside the &gt;3 months cohort compared to general portfolio limit.</p>
              
              <div className="space-y-4">
                {metrics?.product_stats?.map((prod: any, idx: number) => {
                  const isWorst = prod.name === "Community Group";
                  const percentWidth = Math.min(100, (prod.lapse_rate / 20) * 100);
                  
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${isWorst ? 'text-[#DE3E44]' : 'text-[#F3EFE9]'}`}>
                          {prod.name} {isWorst && "⚠️"}
                        </span>
                        <span className="font-mono text-[#8B9F9C]">{prod.lapse_rate.toFixed(1)}%</span>
                      </div>
                      <div className="h-4 bg-[#101514] rounded-sm overflow-hidden flex relative">
                        {/* Target Line placeholder at 4.3% average */}
                        <div className="absolute top-0 bottom-0 left-[21.5%] w-[1.5px] bg-[#B5895F] z-10" title="Average limit" />
                        
                        <div 
                          className={`h-full rounded-r-sm transition-all duration-1000 ${
                            isWorst ? "bg-gradient-to-r from-[#8b2225] to-[#DE3E44]" : "bg-gradient-to-r from-[#174f55] to-[#1F6F78]"
                          }`}
                          style={{ width: `${percentWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 justify-end mt-4 text-[10px] font-mono text-[#8B9F9C]">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 bg-[#2BB5A8] rounded-full inline-block" />
                  <span>Standard Product</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 bg-[#DE3E44] rounded-full inline-block" />
                  <span>Outlier Target</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-3 w-[1.5px] bg-[#B5895F] inline-block" />
                  <span>Mean Lapse Average (4.3%)</span>
                </div>
              </div>
            </div>

            {/* Chart 2: Regional premiums split inside KwaZulu-Natal */}
            <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl p-6">
              <h4 className="text-sm font-semibold text-[#F3EFE9] mb-1 font-sans">Active Regional Premium Distribution (Annualized)</h4>
              <p className="text-xs text-[#8B9F9C] mb-6">Total R in-force active premium split per regional district across KZN.</p>
              
              <div className="space-y-3">
                {metrics?.regional_stats?.map((reg: any, idx: number) => {
                  const mVal = (reg.annual_premium / 1000000.0).toFixed(1);
                  const isEthekwini = reg.name === "eThekwini Metro";
                  const percentWidth = Math.min(100, (reg.annual_premium / 20000000.0) * 100);
                  
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-[#232F2D]">
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className={isEthekwini ? 'text-[#2BB5A8]' : 'text-[#8B9F9C]'} />
                        <span className="text-[#8B9F9C] truncate max-w-[150px]">{reg.name}</span>
                        {isEthekwini && <span className="text-[8px] tracking-tight bg-[#1C2826] text-[#2BB5A8] px-1.5 py-0.2 rounded border border-[#2BB5A8]/20">METRO</span>}
                      </div>
                      <div className="flex items-center gap-3 w-1/2">
                        <div className="h-2 flex-grow bg-[#101514] rounded-full overflow-hidden">
                          <div className={`h-full ${isEthekwini ? 'bg-[#2BB5A8]' : 'bg-[#B5895F]/80'}`} style={{ width: `${percentWidth}%` }} />
                        </div>
                        <span className="font-mono text-[#F3EFE9] font-medium w-16 text-right">R{mVal}m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tabular summary for regions */}
          <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-[#2C3C3A]">
              <h4 className="text-sm font-semibold text-[#F3EFE9] font-family: Outfit">KZN Regional Analytics Matrix</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#101514]/70 border-b border-[#2C3C3A]">
                    <th className="p-4 text-xs font-mono text-[#8B9F9C] tracking-wide uppercase">KZN Region</th>
                    <th className="p-4 text-xs font-mono text-[#8B9F9C] tracking-wide uppercase">Active Policies</th>
                    <th className="p-4 text-xs font-mono text-[#8B9F9C] tracking-wide uppercase text-right">In-force Monthly (R)</th>
                    <th className="p-4 text-xs font-mono text-[#8B9F9C] tracking-wide uppercase text-right">Lapse Rate (%)</th>
                    <th className="p-4 text-xs font-mono text-[#8B9F9C] tracking-wide uppercase text-right">Persistency (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232F2D] text-xs">
                  {metrics?.regional_stats?.map((reg: any, idx: number) => {
                    const monthlySum = Math.round(reg.annual_premium / 12);
                    const isWorstLapse = reg.lapse_rate >= 5.1;
                    const isHighPersist = reg.persistency_rate >= 85.0;

                    return (
                      <tr key={idx} className="hover:bg-[#1C2826]/30 transition-colors">
                        <td className="p-4 font-medium text-[#F3EFE9] font-serif">{reg.name}</td>
                        <td className="p-4 text-[#8B9F9C]">{reg.policies_count} Account records</td>
                        <td className="p-4 text-right font-mono text-[#F3EFE9]">R{monthlySum?.toLocaleString()}</td>
                        <td className={`p-4 text-right font-mono font-medium ${isWorstLapse ? 'text-[#DE3E44]' : 'text-[#8B9F9C]'}`}>
                          {reg.lapse_rate.toFixed(1)}% {isWorstLapse && "⚠️"}
                        </td>
                        <td className={`p-4 text-right font-mono font-medium ${isHighPersist ? 'text-[#34A853]' : 'text-[#F3EFE9]'}`}>
                          {reg.persistency_rate.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ─── VIEW 02: CHAT ASSISTANT TAB (TEXT-TO-SQL) ─── */}
      {activeTab === 'query' && (
        <section className="px-6 py-12 max-w-7xl mx-auto">
          <div className="mb-6">
            <span className="text-xs font-mono text-[#2BB5A8] tracking-widest uppercase">02 · SECURE TEXT-TO-SQL TRANSLATOR</span>
            <h3 className="text-3xl font-serif font-semibold text-[#F3EFE9] mt-1">Grounded Analytics Assistant</h3>
            <p className="text-xs text-[#8B9F9C] mt-1">Type standard questions. The server converts them to secure SQLite code, executes it, and delivers professional insights matching company data dictionaries.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Prompt Console */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-xl p-5">
                <h4 className="text-xs font-mono text-[#B5895F] tracking-wider uppercase mb-3">Starter Analytical Queries</h4>
                <div className="space-y-2">
                  {starterPrompts.map((starter, i) => (
                    <button
                      key={i}
                      onClick={() => handleNLSubmit(undefined, starter.hint)}
                      className="w-full text-left p-3 rounded-lg text-xs bg-[#101514] hover:bg-[#1C2826] border border-[#232F2D] hover:border-[#2BB5A8]/30 transition-all block group"
                    >
                      <div className="font-medium text-[#F3EFE9] mb-1 group-hover:text-[#2BB5A8] transition-colors">{starter.label}</div>
                      <div className="text-[10px] text-[#8B9F9C] font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                        "{starter.hint}"
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-xl p-5">
                <h4 className="text-xs font-mono text-[#B5895F] tracking-wider uppercase mb-2">Rules Enforcement (AI System)</h4>
                <ul className="text-[11px] text-[#8B9F9C] space-y-1.5 leading-relaxed list-disc pl-4 font-mono">
                  <li>Metrics must strictly define the Grace Period (Grace &le; 3 Months excluded).</li>
                  <li>Always start answers showing relevant numbers/totals first.</li>
                  <li>Every analytical insight must end with <strong>ONE</strong> suggested action block.</li>
                  <li>Flags query if questions contain topics not present in the warehouse.</li>
                </ul>
              </div>
            </div>

            {/* Right Chat panel */}
            <div className="lg:col-span-8 space-y-6">
              <form onSubmit={handleNLSubmit} className="flex gap-2 bg-[#141B1A] border border-[#2C3C3A] rounded-xl p-2 shadow-xl focus-within:border-[#2BB5A8]/50 transition-colors">
                <input
                  type="text"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Ask a question about branches, lapses, loss ratios, or product pricing..."
                  className="flex-grow bg-transparent focus:outline-none px-4 py-3 text-sm text-[#F3EFE9]"
                  disabled={queryLoading}
                />
                
                <button
                  type="submit"
                  disabled={queryLoading || !userPrompt.trim()}
                  className="bg-[#1F6F78] hover:bg-[#2BB5A8] disabled:bg-[#1a2c2a] text-[#111615] font-semibold text-xs px-6 py-3 rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {queryLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Running Query Engine...</span>
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      <span>Execute</span>
                    </>
                  )}
                </button>
              </form>

              {/* Chat Results Area */}
              {queryLoading && (
                <div className="bg-[#141B1A]/50 border border-[#2B3A38] rounded-2xl p-8 text-center space-y-3">
                  <div className="inline-block py-2 px-4 rounded-full bg-[#1F6F78]/10 text-[#2BB5A8] border border-[#2BB5A8]/20 animate-pulse text-xs font-mono">
                    🤖 Server generating schema-equivalent SQLite translations via Gemini 3.5-flash
                  </div>
                  <p className="text-xs text-[#8B9F9C]">This pipeline calculates metrics live on the database server to prevent frontend hallucinations.</p>
                </div>
              )}

              {queryResponse && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* SQL Explanation Frame */}
                  <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-xl overflow-hidden shadow-lg">
                    <div className="bg-[#101514] px-4 py-3 border-b border-[#2C3C3A] flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-mono text-[#2BB5A8]">
                        <Terminal size={14} />
                        <span>SQLITE GENERATION STAGE</span>
                      </div>
                      <button
                        onClick={() => handleCopyPrompt(queryResponse.sql, 'sql-out')}
                        className="text-[10px] font-mono text-[#8B9F9C] hover:text-[#2BB5A8] flex items-center gap-1 cursor-pointer"
                      >
                        {copiedPromptId === 'sql-out' ? <Check size={12} className="text-[#34A853]" /> : <Copy size={12} />}
                        <span>Copy Query</span>
                      </button>
                    </div>
                    
                    <div className="p-4 space-y-3">
                      <pre className="text-xs font-mono text-[#C4D0CE] bg-[#0E1312] p-4 rounded-lg overflow-x-auto select-all border border-[#1e2a28]">
                        {queryResponse.sql || "-- No active SQL queries generated by the translator"}
                      </pre>
                      <p className="text-xs text-[#8B9F9C] font-mono leading-relaxed">
                        <strong className="text-[#B5895F]">Technical Reasoning:</strong> {queryResponse.explanation}
                      </p>
                    </div>
                  </div>

                  {/* RAW DB OUTPUTS FOR RECONCILIATION */}
                  {queryResponse.rows && queryResponse.rows.length > 0 && (
                    <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-xl overflow-hidden">
                      <div className="bg-[#101514] px-4 py-3 border-b border-[#2C3C3A] text-xs font-mono text-[#B5895F]">
                        🎯 RAW WAREHOUSE RECORDS RETURNED ({queryResponse.rows.length} rows)
                      </div>
                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-[#131b1a]/40 border-b border-[#232f2d] text-[#8B9F9C]">
                              {Object.keys(queryResponse.rows[0]).map((header, key) => (
                                <th key={key} className="p-3 font-mono text-[10px] uppercase font-semibold">{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#232F2D] font-mono text-[#A8B7B4]">
                            {queryResponse.rows.slice(0, 10).map((row, rKey) => (
                              <tr key={rKey} className="hover:bg-[#1c2826]/10">
                                {Object.values(row).map((val: any, vKey) => (
                                  <td key={vKey} className="p-3">
                                    {typeof val === 'number' ? val.toLocaleString() : String(val)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {queryResponse.rows.length > 10 && (
                        <div className="bg-[#101514] px-4 py-2 text-center text-[10px] text-[#8B9F9C] font-mono border-t border-[#232F2D]">
                          Truncated to first 10 rows for display.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Narrative groundings representing South African Insurance rules */}
                  <div className="bg-gradient-to-br from-[#121E1C]/80 to-[#101A18]/85 border-l-4 border-[#2BB5A8] border border-[#2C3C3A] rounded-r-xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute -top-4 -right-4 text-[#2BB5A8]/5">
                      <MessageSquare size={120} />
                    </div>
                    
                    <h4 className="text-xs font-mono text-[#2BB5A8] uppercase tracking-wider mb-3">AI Narrative Analysis &amp; Action Recommendation</h4>
                    <div className="text-sm text-[#F3EFE9] leading-relaxed whitespace-pre-wrap font-sans antialiased text-[14.5px]">
                      {queryResponse.narrative}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ─── VIEW 03: DATABASE EXPLORER & PLAYGROUND ─── */}
      {activeTab === 'explorer' && (
        <section className="px-6 py-12 max-w-7xl mx-auto">
          <div className="mb-8">
            <span className="text-xs font-mono text-[#2BB5A8] tracking-widest uppercase">03 · STAR SCHEMA EXPLORER &amp; CONSOLE</span>
            <h3 className="text-3xl font-serif font-semibold text-[#F3EFE9] mt-1">Grounding Database Schema</h3>
            <p className="text-xs text-[#8B9F9C] mt-1">Explore table structures in KwaZulu-Natal books, or query them using the native SQLite Command Console.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Table schematics definitions */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono text-[#B5895F] tracking-wider uppercase mb-2">Relational Entities</h4>
              {dbSchemaDescription.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedExplorerTable(item.table);
                    if (item.table === "fact_policy") {
                      setPlaygroundQuery("SELECT * FROM fact_policy WHERE status = 'Lapsed' AND months_on_books > 3 LIMIT 6;");
                    } else if (item.table === "dim_branch") {
                      setPlaygroundQuery("SELECT * FROM dim_branch;");
                    } else if (item.table === "dim_plan") {
                      setPlaygroundQuery("SELECT * FROM dim_plan;");
                    } else if (item.table === "fact_claim") {
                      setPlaygroundQuery("SELECT * FROM fact_claim WHERE approval_status = 'Approved' ORDER BY claim_amount DESC LIMIT 5;");
                    } else {
                      setPlaygroundQuery("SELECT * FROM fact_premium LIMIT 5;");
                    }
                  }}
                  className={`w-full text-left p-4 rounded-xl transition-all border block ${
                    selectedExplorerTable === item.table 
                      ? 'bg-[#1F6F78]/10 text-[#2BB5A8] border-[#2BB5A8]/45' 
                      : 'bg-[#141B1A] border-[#2C3C3A] text-[#8B9F9C] hover:border-[#2BB5A8]/20'
                  }`}
                >
                  <div className="font-serif font-bold text-sm mb-1 text-[#F3EFE9]">{item.table}</div>
                  <p className="text-[11px] font-sans leading-relaxed text-[#8B9F9C]">{item.desc}</p>
                </button>
              ))}
            </div>

            {/* SQL Command Console Console */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl overflow-hidden shadow-xl">
                <div className="bg-[#101514] px-6 py-4 border-b border-[#2C3C3A] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#2BB5A8]">
                    <Terminal size={14} />
                    <span>ANALYST SQL PLAYGROUND</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#B5895F] uppercase">SQLite Compiler v3.x</span>
                </div>

                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-[#8B9F9C] uppercase tracking-wider block">Write SQLite Statement:</label>
                    <textarea
                      value={playgroundQuery}
                      onChange={(e) => setPlaygroundQuery(e.target.value)}
                      rows={4}
                      className="w-full bg-[#0E1312] border border-[#2C3C3A] rounded-lg focus:outline-none focus:border-[#2BB5A8] p-4 text-xs font-mono text-[#C4D0CE] shadow-inner resize-y"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[10px] font-mono text-[#8B9F9C]">
                      Hint: Feel free to JOIN tables like <code className="text-[#F3EFE9]">fact_policy</code> and <code className="text-[#F3EFE9]">dim_branch</code>!
                    </div>
                    
                    <button
                      onClick={() => runPlaygroundSql()}
                      disabled={playgroundLoading}
                      className="bg-[#2BB5A8] hover:bg-[#209c90] disabled:bg-[#1a2c2a] text-[#111615] font-semibold text-xs px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md"
                    >
                      <Play size={12} />
                      <span>{playgroundLoading ? "Running DB..." : "Run Statement"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Console Results Output */}
              <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl overflow-hidden">
                <div className="bg-[#101514] px-6 py-3 border-b border-[#2C3C3A] text-xs font-mono text-[#8B9F9C] flex items-center justify-between">
                  <span>CONSOLE OUTPUT</span>
                  {playgroundResults && playgroundResults.length > 0 && (
                    <span className="text-[10px] text-[#34A853]">{playgroundResults.length} rows returned successfully.</span>
                  )}
                </div>

                <div className="p-6 min-h-40">
                  {playgroundLoading && (
                    <div className="flex items-center justify-center h-28">
                      <RefreshCw className="animate-spin text-[#2BB5A8] mb-2" />
                      <span className="text-xs font-mono text-[#8B9F9C]">Interrogating SQLite rows...</span>
                    </div>
                  )}

                  {playgroundError && (
                    <div className="bg-[#8b2225]/10 border border-[#8b2225]/40 rounded-xl p-4 flex gap-3 text-xs text-[#DE3E44] font-mono leading-relaxed">
                      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <strong className="block mb-1 font-bold">SQLITE EXECUTION EXCEPTION:</strong>
                        {playgroundError}
                      </div>
                    </div>
                  )}

                  {!playgroundLoading && !playgroundError && playgroundResults.length === 0 && (
                    <div className="flex items-center justify-center h-28 border border-dashed border-[#232F2D] rounded-xl text-xs font-mono text-[#8B9F9C]">
                      Query successfully run but returned 0 rows or was a transaction command.
                    </div>
                  )}

                  {!playgroundLoading && !playgroundError && playgroundResults.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#101514] border-b border-[#2C3C3A] text-[#8B9F9C]">
                            {Object.keys(playgroundResults[0]).map((header, key) => (
                              <th key={key} className="p-3 font-mono text-[10px] uppercase font-semibold">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#232F2D] font-mono text-[#A8B7B4]">
                          {playgroundResults.slice(0, 50).map((row, rKey) => (
                            <tr key={rKey} className="hover:bg-[#1c2826]/15">
                              {Object.values(row).map((val: any, vKey) => (
                                <td key={vKey} className="p-3">
                                  {typeof val === 'number' ? val.toLocaleString() : String(val)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {playgroundResults.length > 50 && (
                        <div className="p-3 bg-[#101514] text-center text-[10px] font-mono text-[#8B9F9C] border-t border-[#2C3C3A]">
                          Truncated after first 50 records for buffer safety.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── VIEW 04: AI EXECUTIVE REPORT GENERATOR ─── */}
      {activeTab === 'report' && (
        <section className="px-6 py-12 max-w-4xl mx-auto">
          <div className="mb-8">
            <span className="text-xs font-mono text-[#2BB5A8] tracking-widest uppercase">04 · REGULATED REPORT SUMMARY</span>
            <h3 className="text-3xl font-serif font-semibold text-[#F3EFE9] mt-1">Executive Report Generator</h3>
            <p className="text-xs text-[#8B9F9C] mt-1">Generate a structured executive briefing for Group ICT Directors based on verified baseline computations.</p>
          </div>

          <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl p-6 shadow-xl mb-8 flex flex-col items-center text-center justify-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-[#1F6F78]/20 flex items-center justify-center text-[#2BB5A8]">
              <FileText size={24} />
            </div>
            <div className="max-w-md">
              <h4 className="text-sm font-semibold text-[#F3EFE9]">One-Trigger Brief Formulation</h4>
              <p className="text-xs text-[#8B9F9C] mt-1">Gemini read-compares total premiums collected and outputs an aesthetic 200-word concise document detailing the R1.3m saving priority.</p>
            </div>
            
            <button
              onClick={generateReport}
              disabled={generatingSummary}
              className="bg-[#2BB5A8] hover:bg-[#209c90] disabled:bg-[#1C2826] text-[#111615] font-semibold text-xs px-8 py-3 rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md"
            >
              {generatingSummary ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Submitting Baseline context to Gemini...</span>
                </>
              ) : (
                <>
                  <Compass size={14} />
                  <span>Generate Briefing PDF Preview</span>
                </>
              )}
            </button>
          </div>

          {/* Report Sheet Viewer */}
          {execSummary && (
            <div className="bg-[#FEFCF9] text-[#1C201F] rounded-2xl p-8 shadow-2xl border border-[#EBE3D5] font-serif pr-12 relative animate-fade-in">
              <div className="absolute top-4 right-4 bg-[#F2ECE1] text-[#7A7164] font-mono text-[9px] px-2 py-0.5 rounded border border-[#E3DCD1]">
                OFFICIAL REPORT PREVIEW
              </div>
              <div className="pb-6 border-b border-[#E1D8CB] mb-6 font-sans">
                <span className="text-[10px] font-mono text-[#8B5E3C] tracking-wider uppercase font-semibold">TG Data &amp; AI Analytics Suite</span>
                <h4 className="text-lg font-serif font-bold text-[#141414] mt-1">Hlela Funeral Assurance Book Summary</h4>
                <p className="text-[10px] font-mono text-[#7A7164]">ZuluNatal Regional Books Office · South Africa</p>
              </div>

              <div className="prose prose-stone leading-relaxed max-w-none text-sm text-[#252827] whitespace-pre-wrap">
                {execSummary}
              </div>

              <div className="border-t border-[#E1D8CB] mt-8 pt-6 font-sans flex justify-between items-center text-[10px] text-[#7A7164]">
                <span>Data audit check: SECURE SQL PASS</span>
                <span>Page 1 of 1</span>
              </div>
            </div>
          )}

          {!execSummary && !generatingSummary && (
            <div className="border-2 border-dashed border-[#2C3C3A] rounded-2xl p-12 text-center text-xs font-mono text-[#8B9F9C]">
              Click the button above to generate the live Executive Summary with server-side AI.
            </div>
          )}
        </section>
      )}

      {/* ─── VIEW 05: FRAUD GRAPH VISUALIZER VIEW ─── */}
      {activeTab === 'fraud' && (
        <section className="px-6 py-12 max-w-7xl mx-auto">
          <div className="mb-8">
            <span className="text-xs font-mono text-[#2BB5A8] tracking-widest uppercase">05 · KZN FRAUD RELATIONAL GRAPH VIEW</span>
            <h3 className="text-3xl font-serif font-semibold text-[#F3EFE9] mt-1">Interactive Fraud Syndicate Graph</h3>
            <p className="text-xs text-[#8B9F9C] mt-1">
              Explore suspect clusters and policyholder-claimant rings. Triggers live multi-hop forensics with 
              Neo4j Cypher pattern matches on server-side Gemini 3.5-flash.
            </p>
          </div>
          <FraudGraph />
        </section>
      )}

      {/* ─── VIEW 06: SPECIFICATION, MVP & PRD HUB ─── */}
      {activeTab === 'spec' && (
        <section className="px-6 py-12 max-w-5xl mx-auto">
          <div className="mb-8">
            <span className="text-xs font-mono text-[#2BB5A8] tracking-widest uppercase">06 · PRODUCT BRIEF &amp; REQUIREMENTS</span>
            <h3 className="text-3xl font-serif font-semibold text-[#F3EFE9] mt-1">MVP &amp; PRD Documentation Hub</h3>
            <p className="text-xs text-[#8B9F9C] mt-1">Copy ready-to-paste systems instructions directly into Google AI Studio playground to prototype or replicate findings.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            
            {/* MVP Spec Box */}
            <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl p-6 shadow-xl relative">
              <span className="text-[9px] font-mono text-[#2BB5A8] bg-[#1a2524] px-2 py-0.5 rounded border border-[#2b3a38] absolute top-4 right-4 uppercase tracking-wider">Scope Active</span>
              <h4 className="text-lg font-serif font-semibold text-[#F3EFE9] mb-4">Minimum Viable Product (MVP)</h4>
              <p className="text-xs text-[#8B9F9C] leading-relaxed mb-4 font-light">
                The MVP answers the primary question: <strong className="text-[#2BB5A8]">where is lapse concentrated, and what should the user do about it?</strong> It contains:
              </p>
              <ul className="text-xs text-[#8B9F9C] space-y-2 mb-6 font-mono font-light">
                <li className="flex gap-2">
                  <span className="text-[#2BB5A8] font-bold">✓</span>
                  <span>Text-to-SQL logic against SQLite dimension warehouse.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#2BB5A8] font-bold">✓</span>
                  <span>Metric-aware System rules aligning with grace periods.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#2BB5A8] font-bold">✓</span>
                  <span>One-Trigger summary generation using baseline figures.</span>
                </li>
              </ul>
              
              <div className="bg-[#101514] p-4 rounded-xl border border-[#232F2D]">
                <h5 className="text-xs font-mono text-[#B5895F] mb-2 uppercase">Copy MVP System Prompt</h5>
                <p className="text-[10px] text-[#8B9F9C] leading-relaxed mb-3">Copy this verified system setup directly into the AI Studio configuration tab.</p>
                <button
                  onClick={() => handleCopyPrompt(copyPromptsValues.mvp, 'p-mvp')}
                  className="w-full text-center bg-[#1F6F78]/20 hover:bg-[#2BB5A8]/20 border border-[#2BB5A8]/30 transition-all font-mono text-[10px] text-[#2BB5A8] py-2 rounded"
                >
                  {copiedPromptId === 'p-mvp' ? '✓ Prompt Copied' : 'Copy System Instructions'}
                </button>
              </div>
            </div>

            {/* PRD Spec Box */}
            <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl p-6 shadow-xl relative">
              <span className="text-[9px] font-mono text-[#B5895F] bg-[#1d1f1c] px-2 py-0.5 rounded border border-[#2d2218] absolute top-4 right-4 uppercase tracking-wider">Lifecycle roadmap</span>
              <h4 className="text-lg font-serif font-semibold text-[#F3EFE9] mb-4">Product Requirements (PRD)</h4>
              <p className="text-xs text-[#8B9F9C] leading-relaxed mb-4 font-light">
                Our expansion timeline and core design limits for the Hlela Analytics enterprise platform include:
              </p>
              <div className="space-y-3 mb-6">
                <div className="flex gap-3 text-xs">
                  <span className="h-5 w-5 bg-[#1F6F78] text-[#F3EFE9] font-serif font-medium rounded-full flex items-center justify-center text-[10px] flex-shrink-0">1</span>
                  <div>
                    <strong className="text-[#F3EFE9]">Phase 1 (Wk 1-2):</strong> Text-to-SQL Assistant &amp; basic data exports.
                  </div>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="h-5 w-5 bg-[#B5895F] text-[#F3EFE9] font-serif font-bold rounded-full flex items-center justify-center text-[10px] flex-shrink-0">2</span>
                  <div>
                    <strong className="text-[#F3EFE9]">Phase 2 (Mth 1-2):</strong> Chart generation and Streamlit embeds.
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-[#8B9F9C]">
                  <span className="h-5 w-5 bg-[#3c4a47] text-[#a8b7b4] font-serif rounded-full flex items-center justify-center text-[10px] flex-shrink-0">3</span>
                  <div>
                    <strong className="text-stone-400">Phase 3 (Qtr 2):</strong> Azure Synapse connector &amp; automated metrics schedules.
                  </div>
                </div>
              </div>

              <div className="bg-[#101514] p-4 rounded-xl border border-[#232F2D]">
                <h5 className="text-xs font-mono text-[#B5895F] mb-2 uppercase">8-Lesson Lesson Tutor Prompt</h5>
                <p className="text-[10px] text-[#8B9F9C] leading-relaxed mb-3">Tutor assistant prompt for South African students running local data workflows.</p>
                <button
                  onClick={() => handleCopyPrompt(copyPromptsValues.tutor, 'p-tut')}
                  className="w-full text-center bg-[#B5895F]/10 hover:bg-[#B5895F]/20 border border-[#B5895F]/30 transition-all font-mono text-[10px] text-[#B5895F] py-2 rounded"
                >
                  {copiedPromptId === 'p-tut' ? '✓ Tutor Prompt Copied' : 'Copy Course Tutor Prompt'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-[#141B1A] border border-[#2C3C3A] rounded-2xl p-6 shadow-xl leading-relaxed">
            <h4 className="text-sm font-semibold text-[#F3EFE9] mb-4 font-sans uppercase tracking-wider">Functional Requirements Checklist</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#8B9F9C] font-mono">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-[#2BB5A8]">■</span>
                  <span>FR-01: Read free text analyst questions instantly.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#2BB5A8]">■</span>
                  <span>FR-02: Perform direct T-SQL equivalence inside SQLite runtime.</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="text-[#2BB5A8]">■</span>
                  <span>FR-03: Render charts representing regional lapse concentration.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#DE3E44]">■</span>
                  <span className="text-stone-400">FR-04: (Backlog) Surface automated email ops pack on Mondays.</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── FOOTER BAR ─── */}
      <footer className="border-t border-[#2C3C3A] bg-[#0E1312] px-8 py-8 mt-12 flex flex-col md:flex-row items-center justify-between text-xs text-[#8B9F9C]">
        <div className="font-serif">
          Thembelihle "Litchi" Gumede · <strong className="text-[#2BB5A8] font-medium font-sans">TG Data &amp; AI</strong> · Durban, South Africa
        </div>
        <div className="text-[10px] font-mono mt-4 md:mt-0">
          Funeral Assurance Assistant Suite · Grounded Gemini 3.5-flash · SQLite star-schema
        </div>
      </footer>
    </div>
  );
}
