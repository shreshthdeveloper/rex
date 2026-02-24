import { useState, useEffect, useRef, useCallback } from 'react';
import { useTabs, tabRegistry } from '../context/TabContext';
import { notificationsAPI } from '../api';
import {
  X, PanelLeftClose, PanelLeft, XCircle,
  Search, Bell, Plus, ShoppingCart, Package, UserCircle,
  FileText, Layers, ChevronRight
} from 'lucide-react';

function timeAgo(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const QUICK_ACTIONS = [
  { tabId: 'orders', label: 'New Order', icon: ShoppingCart },
  { tabId: 'products', label: 'New Product', icon: Package },
  { tabId: 'customers', label: 'New Customer', icon: UserCircle },
  { tabId: 'purchase-orders', label: 'New Purchase Order', icon: FileText },
  { tabId: 'stock', label: 'Stock Management', icon: Layers },
];

export default function TabBar({ sidebarCollapsed, onToggleSidebar }) {
  const { tabs, activeTabId, setActiveTabId, closeTab, closeAllTabs, flashTabId, openTab } = useTabs();

  /* ── Notifications ── */
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await notificationsAPI.list({ isRead: false });
      const list = res.data?.notifications || [];
      setRecentNotifs(list.slice(0, 5));
      setUnreadCount(list.length);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNotifs();
    const id = setInterval(fetchNotifs, 30000);
    return () => clearInterval(id);
  }, [fetchNotifs]);

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setUnreadCount(0);
      setRecentNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  const openNotificationsTab = () => {
    setNotifOpen(false);
    const reg = tabRegistry.get('notifications');
    if (reg) openTab({ id: 'notifications', ...reg });
  };

  /* ── Quick Actions ── */
  const [quickOpen, setQuickOpen] = useState(false);
  const quickRef = useRef(null);

  const handleQuickAction = (tabId) => {
    setQuickOpen(false);
    const reg = tabRegistry.get(tabId);
    if (reg) openTab({ id: tabId, ...reg });
  };

  /* ── Global Search ── */
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setQuickOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const searchResults = searchQuery.trim()
    ? [...tabRegistry.entries()]
        .filter(([, v]) => v.label.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  /* ── Click outside to close dropdowns ── */
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (quickRef.current && !quickRef.current.contains(e.target)) setQuickOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex items-center h-11 bg-white border-b border-gray-200 flex-shrink-0 overflow-hidden">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="flex-shrink-0 p-2.5 text-slate-400 hover:text-violet-600 hover:bg-gray-50 transition-colors border-r border-gray-200"
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {/* Tabs */}
      <div className="flex-1 flex items-end overflow-x-auto gap-0.5 px-1 pt-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTabId === tab.id;
          const isFlashing = flashTabId === tab.id;
          return (
            <div
              key={tab.id}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer select-none transition-all max-w-[180px] ${
                isActive
                  ? 'bg-violet-50 text-violet-700 border-t border-x border-violet-200'
                  : 'text-slate-500 hover:text-violet-600 hover:bg-gray-50'
              } ${isFlashing ? 'tab-flash' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              {Icon && <Icon size={13} className="flex-shrink-0" />}
              <span className="truncate">{tab.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-red-400 transition-all"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Right section: Search, Quick Actions, Notifications, Close All ── */}
      <div className="flex items-center gap-0.5 px-2 flex-shrink-0">
        {/* Global Search */}
        <div className="relative">
          {searchOpen ? (
            <div className="relative">
              <input
                ref={searchRef}
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => setTimeout(() => { setSearchOpen(false); setSearchQuery(''); }, 200)}
                placeholder="Search modules..."
                className="w-44 h-7 pl-7 pr-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 bg-gray-50"
              />
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              {searchResults.length > 0 && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-auto">
                  {searchResults.map(([id, reg]) => {
                    const Icon = reg.icon;
                    return (
                      <button
                        key={id}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                        onMouseDown={() => {
                          openTab({ id, ...tabRegistry.get(id) });
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        {Icon && <Icon size={14} className="text-slate-400" />}
                        <span>{reg.label}</span>
                        <ChevronRight size={12} className="ml-auto text-slate-300" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-1.5 h-7 px-2 text-slate-400 hover:text-violet-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
              title="Search (Ctrl+K)"
            >
              <Search size={13} />
              <span className="text-[10px] hidden sm:inline">Ctrl+K</span>
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div className="relative" ref={quickRef}>
          <button
            onClick={() => { setQuickOpen(!quickOpen); setNotifOpen(false); }}
            className={`p-1.5 rounded transition-colors ${quickOpen ? 'text-violet-600 bg-violet-50' : 'text-slate-400 hover:text-violet-600 hover:bg-gray-50'}`}
            title="Quick Actions"
          >
            <Plus size={16} />
          </button>
          {quickOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Quick Actions</div>
              {QUICK_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.tabId}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                    onClick={() => handleQuickAction(a.tabId)}
                  >
                    <Icon size={14} className="text-violet-500" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(!notifOpen); setQuickOpen(false); }}
            className={`p-1.5 rounded transition-colors relative ${notifOpen ? 'text-violet-600 bg-violet-50' : 'text-slate-400 hover:text-violet-600 hover:bg-gray-50'}`}
            title="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">
                  Notifications {unreadCount > 0 && <span className="text-violet-500">({unreadCount})</span>}
                </span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-[10px] text-violet-600 hover:underline font-medium">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto">
                {recentNotifs.length === 0 ? (
                  <div className="flex flex-col items-center py-6 text-slate-400">
                    <Bell size={24} className="mb-2 opacity-40" />
                    <p className="text-xs">No new notifications</p>
                  </div>
                ) : (
                  recentNotifs.map((n) => (
                    <div
                      key={n._id}
                      className={`px-3 py-2.5 hover:bg-gray-50 text-xs border-b border-gray-50 last:border-0 cursor-pointer ${!n.isRead ? 'bg-violet-50/30' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-slate-700 font-medium leading-tight">{n.title}</p>
                        <span className="text-[9px] text-slate-400 whitespace-nowrap flex-shrink-0">{timeAgo(n.createdAt)}</span>
                      </div>
                      {n.message && <p className="text-slate-400 text-[10px] mt-0.5 line-clamp-2">{n.message}</p>}
                    </div>
                  ))
                )}
              </div>
              <div className="px-3 py-2 border-t border-gray-100 text-center">
                <button
                  onClick={openNotificationsTab}
                  className="text-[10px] text-violet-600 hover:underline font-medium"
                >
                  View all notifications →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        {tabs.length > 0 && <div className="w-px h-5 bg-gray-200 mx-1" />}

        {/* Close All Tabs */}
        {tabs.length > 0 && (
          <button
            onClick={closeAllTabs}
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
            title="Close all tabs"
          >
            <XCircle size={13} />
            <span className="hidden sm:inline">Close All</span>
          </button>
        )}
      </div>
    </div>
  );
}
