import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Search, 
  PlusCircle, 
  FileText, 
  Cloud, 
  User, 
  ChevronDown, 
  Radio, 
  Check, 
  LogOut,
  Sparkles,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const Navbar = ({ activeTab, setActiveTab, onOpenArchitecture }) => {
  const { currentUser, isAdmin, setIsAuthModalOpen, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'feed', label: 'Item Feed', icon: Search },
    { id: 'report-lost', label: 'Report Lost', icon: PlusCircle },
    { id: 'report-found', label: 'Report Found', icon: PlusCircle },
    { id: 'my-reports', label: 'My Reports', icon: FileText },
    { 
      id: 'admin-alerts', 
      label: 'Emergency Console', 
      icon: ShieldAlert,
      badge: 'ADMIN',
      highlight: true
    },
  ];

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('feed')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-white shadow-md shadow-primary/20">
              <span className="font-headline font-black text-lg tracking-tighter">FI</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-headline font-black text-lg tracking-tight text-on-surface dark:text-white">FindIt VITC</span>
                <span className="text-[10px] uppercase font-label font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary-fixed text-primary dark:bg-blue-900/60 dark:text-blue-300">
                  AWS
                </span>
              </div>
              <p className="text-[10px] text-outline dark:text-slate-400 leading-none font-body">VIT Chennai Lost &amp; Found + Safety Grid</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                      isAdmin ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Action: Architecture + Dark/Light Theme Toggle + User Profile */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={onOpenArchitecture}
              className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-300 text-xs font-medium transition shadow-xs"
              title="View AWS Serverless Architecture"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>AWS Cloud Arch</span>
            </button>

            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 sm:px-2.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs flex items-center justify-center group"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle dark/light theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300 group-hover:-rotate-12 transition-transform duration-300" />
              )}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs text-left"
              >
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser?.name}
                  className="w-7 h-7 rounded-lg object-cover ring-2 ring-slate-100 dark:ring-slate-700"
                />
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[110px]">
                      {currentUser?.name}
                    </span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                      isAdmin ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300' : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                    }`}>
                      {currentUser?.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate max-w-[120px]">
                    {currentUser?.email}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

                  {/* Dropdown Menu */}
                  {isUserDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-3 z-50 animate-fadeIn">
                      <div className="px-4 pb-3 border-b border-slate-100 dark:border-slate-800 space-y-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {currentUser?.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {currentUser?.email}
                        </p>
                        {currentUser?.department && (
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium truncate pt-0.5">
                            {currentUser.department}
                          </p>
                        )}
                        <div className="pt-1">
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            isAdmin ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300' : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                          }`}>
                            {isAdmin ? 'Campus Admin / Security' : 'Verified Student'}
                          </span>
                        </div>
                      </div>

                      <div className="px-3 pt-2">
                        <button
                          onClick={() => {
                            logout();
                            setIsUserDropdownOpen(false);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/70 text-red-600 dark:text-red-400 font-semibold text-xs transition"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}

            </div>

            {/* Mobile / Tablet Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 space-y-1 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition ${
                  isActive ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isAdmin ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                onOpenArchitecture();
                setIsMobileMenuOpen(false);
              }}
              className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>AWS Cloud Architecture</span>
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};
