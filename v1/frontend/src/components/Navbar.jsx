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
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ activeTab, setActiveTab, onOpenArchitecture }) => {
  const { currentUser, switchUser, demoUsers, isAdmin, setIsAuthModalOpen, logout } = useAuth();
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
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('feed')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <span className="font-black text-lg tracking-tighter">CF</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg tracking-tight text-slate-900">CampusFind</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                  AWS
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-none">Lost & Found + Emergency Alerts</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                      isAdmin ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Action: Architecture + User Profile */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenArchitecture}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 text-xs font-medium transition shadow-xs"
              title="View AWS Serverless Architecture"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-600" />
              <span>AWS Cloud Arch</span>
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition shadow-xs text-left"
              >
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={currentUser?.name}
                  className="w-7 h-7 rounded-lg object-cover ring-2 ring-slate-100"
                />
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[110px]">
                      {currentUser?.name}
                    </span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                      isAdmin ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {currentUser?.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                    {currentUser?.email}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Switch Demo Profile
                    </p>
                    <p className="text-xs text-slate-500">
                      Test Student report flow vs Admin emergency broadcast
                    </p>
                  </div>

                  <div className="py-1">
                    {demoUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          switchUser(user);
                          setIsUserDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-xs hover:bg-slate-50 transition ${
                          currentUser?.id === user.id ? 'bg-blue-50/70 font-semibold' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-900">{user.name}</span>
                              <span className={`text-[9px] font-bold uppercase px-1 rounded ${
                                user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {user.role}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">{user.email}</span>
                          </div>
                        </div>
                        {currentUser?.id === user.id && (
                          <Check className="w-4 h-4 text-blue-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="px-4 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <button
                      onClick={() => {
                        setIsAuthModalOpen(true);
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full text-center py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition"
                    >
                      Sign In with Another Account
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setIsUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1 shadow-lg">
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
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isAdmin ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                onOpenArchitecture();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>AWS Cloud Architecture</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};
