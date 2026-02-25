import { useState } from 'react';
import { useTabs, registerTab } from '../context/TabContext';
import {
  LayoutDashboard, Users, FolderTree, Ruler, Barcode, Receipt, Warehouse,
  Package, Layers, ShoppingCart, UserCircle, ClipboardList, Truck, FileText,
  Tag, DollarSign, BarChart3, Bell, ChevronDown, ChevronRight, LogOut,
  Building2, Settings, Store, Zap, Plug
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* Import page components lazily via dynamic refs */
import Dashboard from '../pages/admin/Dashboard';
import UsersPage from '../pages/admin/Users';
import Categories from '../pages/admin/Categories';
import Units from '../pages/admin/Units';
import BarcodeTypes from '../pages/admin/BarcodeTypes';
import TaxSlabs from '../pages/admin/TaxSlabs';
import Warehouses from '../pages/admin/Warehouses';
import Products from '../pages/admin/Products';
import StockManagement from '../pages/admin/StockManagement';
import Customers from '../pages/admin/Customers';
import Orders from '../pages/admin/Orders';
import POS from '../pages/admin/POS';
import Suppliers from '../pages/admin/Suppliers';
import PurchaseOrders from '../pages/admin/PurchaseOrders';
import Coupons from '../pages/admin/Coupons';
import Pricing from '../pages/admin/Pricing';
import Reports from '../pages/admin/Reports';
import Notifications from '../pages/admin/Notifications';
import EcomSettings from '../pages/admin/EcomSettings';
import Brands from '../pages/admin/Brands';
import Integrations from '../pages/admin/Integrations';

const menuSections = [
  {
    title: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: Dashboard },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { id: 'products', label: 'Products', icon: Package, component: Products },
      { id: 'stock', label: 'Stock Management', icon: Layers, component: StockManagement },
    ],
  },
  {
    title: 'Sales',
    items: [
      { id: 'customers', label: 'Customers', icon: UserCircle, component: Customers },
      { id: 'orders', label: 'Orders', icon: ShoppingCart, component: Orders },
      { id: 'pos', label: 'POS', icon: Zap, component: POS },
      { id: 'coupons', label: 'Coupons', icon: Tag, component: Coupons },
      { id: 'pricing', label: 'Pricing', icon: DollarSign, component: Pricing },
    ],
  },
  {
    title: 'Procurement',
    items: [
      { id: 'suppliers', label: 'Suppliers', icon: Truck, component: Suppliers },
      { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText, component: PurchaseOrders },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { id: 'reports', label: 'Reports', icon: BarChart3, component: Reports },
      { id: 'notifications', label: 'Notifications', icon: Bell, component: Notifications },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { id: 'integrations', label: 'Integrations', icon: Plug, component: Integrations },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'ecom-settings', label: 'Ecom Settings', icon: Store, component: EcomSettings },
      { id: 'users', label: 'Users & Access', icon: Users, component: UsersPage },
      { id: 'categories', label: 'Categories', icon: FolderTree, component: Categories },
      { id: 'brands', label: 'Brands', icon: Tag, component: Brands },
      { id: 'units', label: 'Units', icon: Ruler, component: Units },
      { id: 'barcode-types', label: 'Barcode Types', icon: Barcode, component: BarcodeTypes },
      { id: 'tax-slabs', label: 'Tax Slabs', icon: Receipt, component: TaxSlabs },
      { id: 'warehouses', label: 'Warehouses', icon: Warehouse, component: Warehouses },
    ],
  },
];

/* Register all menu items so TabProvider can reconstruct tabs after page refresh */
menuSections.forEach((s) => s.items.forEach((item) => {
  registerTab(item.id, { label: item.label, icon: item.icon, component: item.component });
}));

export default function Sidebar({ collapsed, onToggle }) {
  const { openTab, activeTabId } = useTabs();
  const { logout, user } = useAuth();
  const [expandedSections, setExpandedSections] = useState(
    menuSections.reduce((acc, s) => ({ ...acc, [s.title]: true }), {})
  );

  const toggleSection = (title) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const handleClick = (item) => {
    openTab({
      id: item.id,
      label: item.label,
      icon: item.icon,
      component: item.component,
    });
  };

  return (
    <aside className={`glass-sidebar flex flex-col h-full transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-200 flex-shrink-0">
        <img src="/logo.jpeg" alt="Rex" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-slate-800 truncate">Rex</h1>
            <p className="text-[10px] text-violet-500 truncate">E-Commerce Platform</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {menuSections.map((section) => (
          <div key={section.title} className="mb-2">
            {!collapsed && (
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-violet-600 transition-colors"
              >
                {section.title}
                {expandedSections[section.title]
                  ? <ChevronDown size={12} />
                  : <ChevronRight size={12} />}
              </button>
            )}
            {(collapsed || expandedSections[section.title]) && (
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTabId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleClick(item)}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-violet-600/10 text-violet-700 border border-violet-200'
                          : 'text-slate-600 hover:text-violet-700 hover:bg-gray-50 border border-transparent'
                      } ${collapsed ? 'justify-center px-2' : ''}`}
                    >
                      <Icon size={18} className={isActive ? 'text-violet-600' : ''} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-3 flex-shrink-0">
        <button
          onClick={logout}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors ${collapsed ? 'justify-center px-2' : ''}`}
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

export { menuSections };
