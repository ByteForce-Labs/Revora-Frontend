import { useState, type MouseEvent } from "react";
import {
  createBrowserRouter,
  Link,
  Outlet,
  type RouteObject,
  RouterProvider,
} from "react-router-dom";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ForgotPassword } from "./pages/ForgotPassword";
import { TwoFactorRecoveryPage } from "./pages/TwoFactorRecoveryPage";
import TwoFactorBackupCodesPage from "./pages/TwoFactorBackupCodesPage";
import { DesignTokensPage } from "./pages/DesignTokens/DesignTokensPage";
import { InvestorDiscovery } from "./components/InvestorDiscovery"; // Import here
import { InvestorPortfolioSummary } from "./pages/InvestorPortfolioSummary";
import { RevenueReportForm } from "./components/RevenueReportForm";
import { LedgerDemoPage } from "./pages/LedgerDemoPage";
import { OfferingRegistrationDemo } from "./pages/OfferingRegistrationDemo";
import NotificationBell from "./components/Notifications/NotificationBell";
import { notificationsMock } from "./components/Notifications/notificationsData";
import { OfferingWizardSummary } from "./pages/OfferingWizardSummary";
import { ScheduledExportsPage } from "./pages/ScheduledExportsPage";
import { StartupDashboard } from "./pages/StartupDashboard";
import { GovernanceProposalCreatePage } from "./pages/GovernanceProposalCreatePage";
import { AdminAlertsInbox } from "./pages/AdminAlertsInbox";
import { PayoutSchedule } from "./pages/PayoutSchedule";
import { GovernanceVoteReceiptDemo } from "./pages/GovernanceVoteReceiptDemo";
import { useContractRead } from "./hooks/useContractRead";
import { getContractSummary } from "./lib/soroban/revoraContract";
import {
  CONTRACT_ID,
  buildContractExplorerUrl,
  buildStellarLabUrl,
} from "./constants/stellar";

const LIVE_URL = "https://revora-frontend-omega.vercel.app";
const REPO_URL = "https://github.com/RevoraOrg/Revora-Frontend";
const STELLAR_LAB_URL = buildStellarLabUrl();
const STELLAR_EXPERT_URL = buildContractExplorerUrl();

function SiteFooter() {
  const { data: contractSummary, isLoading, isError, error, retry } = useContractRead(
    getContractSummary,
    { retryCount: 2, retryDelay: 1000 },
  );

  return (
    <footer className="site-footer">
      <div className="site-footer__row">
        <strong>On-chain (Stellar testnet)</strong>
        <span className="text-muted">
          Revora revenue-deposit contract, deployed on the Stellar <em>testnet</em> (no real funds):
        </span>
      </div>
      <code className="site-footer__contract">{CONTRACT_ID}</code>
      
      {/* On-chain status panel */}
      <div className="site-footer__status">
        {isLoading && (
          <div className="site-footer__status-loading">
            <span className="text-muted">Loading contract data...</span>
          </div>
        )}
        {isError && (
          <div className="site-footer__status-error">
            <span className="text-muted" style={{ color: '#ef4444' }}>
              Failed to load contract data: {error}
            </span>
            <button
              type="button"
              onClick={retry}
              className="link-styled"
              style={{ background: 'none', border: 'none', padding: 0, marginLeft: '0.5rem', cursor: 'pointer' }}
            >
              Retry
            </button>
          </div>
        )}
        {contractSummary && !isLoading && (
          <div className="site-footer__status-success">
            <span className="text-muted">
              {contractSummary.periodCount} period{contractSummary.periodCount !== 1 ? 's' : ''} registered, 
              {contractSummary.authorizedOfferingsCount} authorized offering{contractSummary.authorizedOfferingsCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      
      <div className="site-footer__row">
        <a href={STELLAR_EXPERT_URL} className="link-styled" target="_blank" rel="noopener noreferrer">Stellar Expert</a>
        <a href={STELLAR_LAB_URL} className="link-styled" target="_blank" rel="noopener noreferrer">Stellar Lab</a>
        <a href={REPO_URL} className="link-styled" target="_blank" rel="noopener noreferrer">Source on GitHub</a>
        <a href={LIVE_URL} className="link-styled" target="_blank" rel="noopener noreferrer">Live site</a>
      </div>
    </footer>
  );
}

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/login", element: <Login /> },
      { path: "/signup", element: <Signup /> },
      { path: "/forgot-password", element: <ForgotPassword /> },
      { path: "/recover-2fa", element: <TwoFactorRecoveryPage /> },
      { path: "/settings/2fa/backup-codes", element: <TwoFactorBackupCodesPage /> },

      // Startup routes
      { path: "/startup/dashboard", element: <StartupDashboard /> },
      { path: "/startup/report-revenue", element: <RevenueReportForm /> },
      // Issue #199 – Inline document uploader (Offering Registration wizard)
      { path: "/startup/offering-registration", element: <OfferingRegistrationDemo /> },
      // Issue #247 – Governance proposal creation multi-step form
      { path: "/startup/governance/proposals/create", element: <GovernanceProposalCreatePage /> },
      // Issue #472 – Governance vote receipt with on-chain link
      { path: "/startup/governance/vote-receipt", element: <GovernanceVoteReceiptDemo /> },

      // Investor routes
      { path: "/investor/portal", element: <InvestorDiscovery /> },
      { path: "/investor/portfolio", element: <InvestorPortfolioSummary /> },
      { path: "/investor/payouts", element: <PayoutSchedule /> },
      // Issue #139 – Virtualized Ledger Table
      { path: "/investor/ledger", element: <LedgerDemoPage /> },

      // Admin routes
      { path: "/admin/alerts", element: <AdminAlertsInbox /> },
      { path: "/admin/scheduled-exports", element: <ScheduledExportsPage /> },

      { path: "*", element: <Placeholder title="Page not found" /> },
    ],
  },
];

export function App() {
  // Created lazily so the router picks up the current URL at mount time.
  const [router] = useState(() => createBrowserRouter(routes));
  return <RouterProvider router={router} />;
}

function AppLayout() {
  const handleSkipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById("main-content");
    if (!main) return;
    event.preventDefault();
    main.focus();
    main.scrollIntoView?.({ block: "start" });
    window.location.hash = "main-content";
  };

  return (
    <>
      <a href="#main-content" className="skip-link" onClick={handleSkipToContent}>
        Skip to main content
      </a>
      <header className="site-header">
        <Link to="/" className="site-header__brand">Revora</Link>
        <nav className="site-header__nav" aria-label="Primary">
          <Link to="/startup/dashboard" className="site-link">Startup</Link>
          <Link to="/investor/portal" className="site-link">Investor</Link>
          <Link to="/admin/alerts" className="site-link">Admin</Link>
          <a href={REPO_URL} className="site-link" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}

function Home() {
  return (
    <div className="home-container animate-fade-in">
      {/* Header bar with notification bell */}
      <div className="w-full flex justify-end mb-4">
        <NotificationBell notifications={notificationsMock} />
      </div>
      <div className="home-card glass-card">
        <h1 className="home-title">
          Revora on <span className="text-primary">Stellar</span>
        </h1>
        <p className="home-description">
          Tokenized revenue-sharing infrastructure. Bridge the gap
          between visionaries and supporters with secure, on-chain execution.
        </p>
        <p className="home-description" role="note" style={{ fontSize: '0.875rem', opacity: 0.8 }}>
          This is a front-end demo. All data shown is sample data; no real
          wallets, funds or customers are involved.
        </p>

        <div className="home-grid">
          <section className="home-section glass-card">
            <h2 className="home-section-title">Startup Dashboard</h2>
            <ul className="home-list">
              <li>
                • <Link to="/startup/dashboard" className="link-styled">Issuer Dashboard</Link>
              </li>
              <li>• Configure RevenueShare offerings</li>
              <li>
                • <Link to="/startup/report-revenue" className="link-styled">Report monthly revenue</Link>
              </li>
              <li>
                • <Link to="/startup/offering-registration" className="link-styled">Register a RevenueShare offering</Link>
              </li>
              <li>
                • <Link to="/startup/governance/proposals/create" className="link-styled">Create a governance proposal</Link>
              </li>
              <li>
                • <Link to="/startup/governance/vote-receipt" className="link-styled">Governance vote receipt</Link>
              </li>
            </ul>
          </section>

          <section className="home-section glass-card">
            <h2 className="home-section-title">Investor Portal</h2>
            <ul className="home-list">
              <li>• <Link to="/investor/portal" className="link-styled">Discover offerings</Link></li>
              <li>• Invest using USDC on Stellar</li>
              <li>• <Link to="/investor/portfolio" className="link-styled">View portfolio summary</Link></li>
              <li>• <Link to="/investor/ledger" className="link-styled">Browse ledger entries</Link></li>
              <li>• <Link to="/investor/payouts" className="link-styled">View payout schedule</Link></li>
            </ul>
          </section>

          <section className="home-section glass-card">
            <h2 className="home-section-title">Admin &amp; Account</h2>
            <ul className="home-list">
              <li>• <Link to="/admin/alerts" className="link-styled">Alerts inbox</Link></li>
              <li>• <Link to="/admin/scheduled-exports" className="link-styled">Scheduled exports</Link></li>
              <li>• <Link to="/settings/2fa/backup-codes" className="link-styled">2FA backup codes</Link></li>
              <li>• <Link to="/recover-2fa" className="link-styled">2FA recovery</Link></li>
            </ul>
          </section>
        </div>

        <div className="home-actions" style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
          <Link to="/signup" className="btn btn-primary" style={{ width: '100%' }}>
            Get started
          </Link>
          <div className="relative flex items-center w-full my-2">
            <div className="flex-grow border-t border-[rgba(148,163,184,0.1)]"></div>
            <span className="flex-shrink mx-4 text-muted text-xs uppercase tracking-wider font-medium">
              Or continue with email
            </span>
            <div className="flex-grow border-t border-[rgba(148,163,184,0.1)]"></div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
            <Link to="/signup" className="btn btn-secondary" style={{ flex: 1 }}>
              Sign Up
            </Link>
            <Link to="/login" className="btn btn-secondary" style={{ flex: 1 }}>
              Sign In
            </Link>
          </div>
        </div>

        <div className="home-footer">
          revora-frontend (React + Vite + TS) • Powered by Stellar •{" "}
          <a href={REPO_URL} className="link-styled" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
      </div>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="placeholder-container">
      <div className="placeholder-card glass-card">
        <h1 className="placeholder-title">{title}</h1>
        <p className="placeholder-text">
          We could not find that page.
        </p>
        <Link to="/" className="btn btn--secondary btn--md">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
