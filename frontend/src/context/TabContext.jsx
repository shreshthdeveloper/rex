import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const TabContext = createContext(null);

/* Registry: sidebar populates this so TabProvider can reconstruct tabs after refresh */
const tabRegistry = new Map();
export function registerTab(id, { label, icon, component }) {
  tabRegistry.set(id, { label, icon, component });
}
export { tabRegistry };

/* Persistence helpers */
const STORAGE_KEY = 'erp_open_tabs';
const loadPersistedTabs = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw); // { tabIds: [...], activeTabId: string|null }
  } catch { return null; }
};
const persistTabs = (tabIds, activeTabId) => {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tabIds, activeTabId })); } catch {}
};

export function TabProvider({ children }) {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [flashTabId, setFlashTabId] = useState(null);
  const initialized = useRef(false);

  /* On mount, restore tabs from sessionStorage once the registry is populated */
  useEffect(() => {
    if (initialized.current) return;
    const stored = loadPersistedTabs();
    if (stored && stored.tabIds?.length && tabRegistry.size > 0) {
      const restored = stored.tabIds
        .map((id) => {
          const reg = tabRegistry.get(id);
          return reg ? { id, label: reg.label, icon: reg.icon, component: reg.component } : null;
        })
        .filter(Boolean);
      if (restored.length) {
        setTabs(restored);
        const activeId = stored.activeTabId && restored.some((t) => t.id === stored.activeTabId)
          ? stored.activeTabId
          : restored[0].id;
        setActiveTabId(activeId);
      }
    }
    initialized.current = true;
  }, []);

  /* Persist whenever tabs or activeTabId change */
  useEffect(() => {
    if (!initialized.current) return;
    persistTabs(tabs.map((t) => t.id), activeTabId);
  }, [tabs, activeTabId]);

  const openTab = useCallback((tab) => {
    // tab = { id, label, icon, component }
    setTabs((prev) => {
      const exists = prev.find((t) => t.id === tab.id);
      if (exists) {
        setActiveTabId(tab.id);
        // Flash the tab to indicate it's already open
        setFlashTabId(tab.id);
        setTimeout(() => setFlashTabId(null), 700);
        return prev;
      }
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, []);

  const closeTab = useCallback((tabId) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId);
      // If closing the active tab, activate the previous one
      setActiveTabId((currentActive) => {
        if (currentActive === tabId) {
          const idx = prev.findIndex((t) => t.id === tabId);
          if (filtered.length === 0) return null;
          return filtered[Math.min(idx, filtered.length - 1)]?.id || null;
        }
        return currentActive;
      });
      return filtered;
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  return (
    <TabContext.Provider value={{
      tabs, activeTabId, activeTab, flashTabId,
      openTab, closeTab, closeAllTabs, setActiveTabId,
    }}>
      {children}
    </TabContext.Provider>
  );
}

export const useTabs = () => {
  const ctx = useContext(TabContext);
  if (!ctx) throw new Error('useTabs must be inside TabProvider');
  return ctx;
};
