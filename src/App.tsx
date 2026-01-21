import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { WalletTab } from './components/WalletTab';
import { Swap } from './components/swap/Swap';
import { Unlock } from './components/onboarding/Unlock';
import { WalletMenu } from './components/WalletMenu';
import { Settings } from './components/Settings';
import { BackupModal } from './components/dashboard/BackupModal';
import { Staking } from './components/staking/Staking';
import { Governance } from './components/governance/Governance';
import { VaultManager } from './modules/vault/vault';
import { openExpandedView } from './utils/navigation';
import { Send } from './components/send/Send';
import type { LumenWallet } from './modules/sdk/key-manager';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  /* Multi-Wallet State */
  const [wallets, setWallets] = useState<LumenWallet[]>([]);
  const [activeWalletIndex, setActiveWalletIndex] = useState<number>(0);

  /* Derived active wallet */
  const activeWallet = wallets[activeWalletIndex] || null;

  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const isLockedRef = useRef(isLocked);

  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);

  const [backupWalletIdx, setBackupWalletIdx] = useState<number | null>(null);

  /* Link Modal State */
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);

  /* Theme State */
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  /* Persist active wallet */
  useEffect(() => {
    if (wallets.length > 0 && wallets[activeWalletIndex]) {
      localStorage.setItem('lastActiveWalletAddress', wallets[activeWalletIndex].address);
    }
  }, [activeWalletIndex, wallets]);

  /* Initial Load & Session Check */
  useEffect(() => {
    const checkSession = async () => {
      const hasWallet = await VaultManager.hasWallet();
      if (hasWallet) {
        // Check if we already have an active session
        try {
          const unlockedWallets = await VaultManager.getWallets();
          if (unlockedWallets && unlockedWallets.length > 0) {
            setWallets(unlockedWallets);
            setIsLocked(false);

            // Restore active wallet
            const lastActive = localStorage.getItem('lastActiveWalletAddress');
            const foundIdx = unlockedWallets.findIndex(w => w.address === lastActive);
            if (foundIdx !== -1) {
              setActiveWalletIndex(foundIdx);
            }

            if (location.pathname === '/' || location.pathname === '/onboarding') {
              navigate('/dashboard');
            }
          } else {
            setIsLocked(true);
            if (location.pathname === '/onboarding') {
              navigate('/');
            }
          }
        } catch {
          setIsLocked(true);
          if (location.pathname === '/onboarding') {
            navigate('/');
          }
        }
      } else {
        // No wallet -> Onboarding.
        setIsLocked(false);
        if (window.innerWidth < 400 && (location.pathname === '/onboarding' || location.pathname === '/')) {
          openExpandedView('/wallet/create');
          window.close();
          return;
        }

        if (location.pathname === '/onboarding' || location.pathname === '/') {
          navigate('/wallet/create');
        }
      }
      setLoading(false);
    };
    checkSession();

    const interval = setInterval(async () => {
      const hasWallet = await VaultManager.hasWallet();
      if (!hasWallet || isLockedRef.current) return;
      const expired = await VaultManager.isSessionExpired();
      if (expired) {
        handleLock();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleUnlock = async (password: string) => {
    try {
      const unlockedWallets = await VaultManager.unlock(password);
      setWallets(unlockedWallets);

      /* Restore active wallet */
      const lastActive = localStorage.getItem('lastActiveWalletAddress');
      const foundIdx = unlockedWallets.findIndex(w => w.address === lastActive);
      if (foundIdx !== -1) {
        setActiveWalletIndex(foundIdx);
      }

      setIsLocked(false);
      setUnlockError(null);
      navigate('/dashboard');
    } catch (e: any) {
      setUnlockError(e?.message || "Incorrect password.");
    }
  };

  const handleWalletReady = async () => {
    try {
      const unlockedWallets = await VaultManager.getWallets();

      /* Only jump to last wallet if we just added one */
      if (unlockedWallets.length > wallets.length && wallets.length > 0) {
        setActiveWalletIndex(unlockedWallets.length - 1);
      } else {
        /* Restore active wallet check */
        const lastActive = localStorage.getItem('lastActiveWalletAddress');
        const foundIdx = unlockedWallets.findIndex(w => w.address === lastActive);
        if (foundIdx !== -1) {
          setActiveWalletIndex(foundIdx);
        }
      }

      setWallets(unlockedWallets);
      setIsLocked(false);
      navigate('/dashboard');
    } catch {
      setIsLocked(true);
    }
  };

  const handleLock = async () => {
    await VaultManager.clearSession();
    setIsLocked(true);
    navigate('/');
  };

  const handleDeleteWallet = async (address: string) => {
    try {
      const deletedIndex = wallets.findIndex(w => w.address === address);
      const newWallets = await VaultManager.removeWallet(address);

      setWallets(newWallets);

      if (newWallets.length === 0) {
        navigate('/');
      } else {
        if (activeWalletIndex === deletedIndex) {
          setActiveWalletIndex(0);
        } else if (activeWalletIndex > deletedIndex) {
          setActiveWalletIndex(activeWalletIndex - 1);
        }
      }
    } catch (e) {
      console.error("Failed to delete wallet:", e);
    }
  };

  const handleRename = async (index: number, newName: string) => {
    try {
      const updatedWallets = [...wallets];
      updatedWallets[index] = {
        ...updatedWallets[index],
        pqcKey: { ...updatedWallets[index].pqcKey, name: newName },
        pqc: { ...updatedWallets[index].pqc, name: newName } /* Support both legacy and new structures */
      };

      await VaultManager.saveWallets(updatedWallets);
      setWallets(updatedWallets);
    } catch (e) {
      console.error("Failed to rename wallet:", e);
    }
  };

  const handleInteraction = async () => {
    if (activeWallet && !isLocked) {
      await VaultManager.touchSession();
    }
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center bg-background text-primary">Loading...</div>;
  }

  const isLandingPage = (location.pathname.includes('/wallet/create') || location.pathname === '/onboarding') && wallets.length === 0;

  if (isLandingPage) {
    return (
      <div className="bg-background text-foreground font-sans w-screen h-screen overflow-y-auto" onClick={handleInteraction}>
        <main className="w-full min-h-full flex flex-col">
          <Routes>
            <Route path="/wallet/create" element={
              <WalletTab
                onWalletReady={handleWalletReady}
                activeKeys={null}
                isAdding={wallets.length > 0}
                onCancel={() => navigate('/dashboard')}
                showLinkModal={false}
                onCloseLinkModal={() => { }}
              />
            } />
            <Route path="*" element={<Navigate to="/wallet/create" />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <div
      className="bg-background text-foreground font-sans overflow-hidden flex flex-col h-full w-full max-w-md mx-auto"
      onClick={handleInteraction}
      onKeyDown={handleInteraction}
      onMouseMove={handleInteraction}
    >
      {/* Header */}
      {!isLocked && activeWallet && (
        <header className="h-16 premium-header flex items-center px-5 justify-between backdrop-blur-xl z-10 shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/icons/logo.png" alt="Lumen" className="w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(99,102,241,0.4)] animate-pulse-slow" />
            <span className="font-bold text-foreground text-lg tracking-tight">Lumen</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-surfaceHighlight text-gray-500 hover:text-foreground transition-colors"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <WalletMenu
              wallets={wallets}
              activeWalletIndex={activeWalletIndex}
              activeWalletName={activeWallet.pqcKey?.name || activeWallet.pqc?.name || 'Wallet'}
              onSwitch={(idx) => {
                setActiveWalletIndex(idx);
                navigate('/dashboard');
              }}
              onAdd={() => openExpandedView('/wallet/create')}
              onLock={handleLock}
              onSettings={() => navigate('/settings')}
              onRename={handleRename}
              onBackup={(idx) => setBackupWalletIdx(idx)}
              onLinkPqc={() => setIsLinkModalOpen(true)}
              onDelete={handleDeleteWallet}
            />
          </div>
        </header>
      )}

      {backupWalletIdx !== null && (
        <BackupModal
          wallet={wallets[backupWalletIdx]}
          onClose={() => setBackupWalletIdx(null)}
        />
      )}

      <main className="flex-1 overflow-y-auto relative">
        <Routes>
          <Route path="/" element={
            isLocked
              ? <div className="h-full"><Unlock onUnlock={handleUnlock} error={unlockError} /></div>
              : (wallets.length > 0 ? <Navigate to="/dashboard" /> : <Navigate to="/wallet/create" />)
          } />
          <Route path="/dashboard" element={
            activeWallet ? (
              <WalletTab
                onWalletReady={handleWalletReady}
                activeKeys={activeWallet}
                isAdding={false}
                onCancel={() => { }}
                showLinkModal={isLinkModalOpen}
                onCloseLinkModal={() => setIsLinkModalOpen(false)}
              />
            ) : <Navigate to="/" />
          } />
          <Route path="/wallet/create" element={
            <div className="h-full">
              <WalletTab
                onWalletReady={handleWalletReady}
                activeKeys={null}
                isAdding={wallets.length > 0}
                onCancel={() => navigate('/dashboard')}
                /* No modal for create flow */
                showLinkModal={false}
                onCloseLinkModal={() => { }}
              />
            </div>
          } />
          <Route path="/swap" element={
            activeWallet ? <Swap walletKeys={activeWallet} /> : <Navigate to="/" />
          } />
          <Route path="/send" element={
            activeWallet ? <Send activeKeys={activeWallet} onBack={() => navigate('/dashboard')} /> : <Navigate to="/" />
          } />
          <Route path="/stake" element={
            activeWallet ? <Staking walletKeys={activeWallet} onBack={() => navigate('/dashboard')} /> : <Navigate to="/" />
          } />
          <Route path="/governance" element={
            activeWallet ? <Governance walletKeys={activeWallet} onBack={() => navigate('/dashboard')} /> : <Navigate to="/" />
          } />
          <Route path="/settings" element={
            <Settings onBack={() => navigate('/dashboard')} />
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>

      {/* Footer Navigation */}
      {!isLocked && activeWallet && location.pathname !== '/settings' && location.pathname !== '/wallet/create' && (
        <footer className="h-16 bg-surface/80 backdrop-blur-xl border-t border-border flex items-center justify-around px-2 z-10 shrink-0">
          <button
            onClick={() => navigate('/dashboard')}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 ${location.pathname === '/dashboard' ? 'text-primary scale-110' : 'text-gray-500 hover:text-gray-300 hover:scale-105'} `}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            <span className="text-[10px] font-semibold">Wallet</span>
          </button>
          <button
            disabled
            className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all text-gray-700/50 cursor-not-allowed opacity-40"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
            <span className="text-[10px] font-semibold">Swap</span>
          </button>
          <button
            disabled
            className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all text-gray-700/50 cursor-not-allowed opacity-40"
          >
            {/* Using a Bridge-like icon (External Link or similar) */}
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            <span className="text-[10px] font-semibold">Bridge</span>
          </button>
        </footer>
      )}
    </div>
  );
}

export default App;
