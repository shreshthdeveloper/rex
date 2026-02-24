import { useState } from 'react';
import { TabProvider, useTabs } from '../context/TabContext';
import Sidebar from '../components/Sidebar';
import TabBar from '../components/TabBar';
import { LayoutDashboard } from 'lucide-react';

function AdminContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { activeTab, tabs } = useTabs();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TabBar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        />
        <main className="flex-1 overflow-auto p-6 bg-white">
          {activeTab ? (
            /* Render each tab's component, keeping them mounted but hidden */
            tabs.map((tab) => {
              const Comp = tab.component;
              return (
                <div key={tab.id} className={tab.id === activeTab.id ? '' : 'hidden'}>
                  <Comp />
                </div>
              );
            })
          ) : (
            <WelcomeScreen />
          )}
        </main>
      </div>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/10 flex items-center justify-center mb-6 border border-violet-200">
        <LayoutDashboard size={36} className="text-violet-600" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to E-Commerce Platform</h2>
      <p className="text-slate-500 max-w-md">
        Select a module from the sidebar to get started. Each module opens in a new tab that you can switch between or close.
      </p>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <TabProvider>
      <AdminContent />
    </TabProvider>
  );
}
