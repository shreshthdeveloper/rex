import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import OrdersTab from '../components/account/OrdersTab';
import LedgerTab from '../components/account/LedgerTab';
import AddressesTab from '../components/account/AddressesTab';
import PaymentsTab from '../components/account/PaymentsTab';
import ProfileTab from '../components/account/ProfileTab';

const TABS = [
  { key: 'orders', label: 'Orders' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'addresses', label: 'Addresses' },
  { key: 'payments', label: 'Payments' },
  { key: 'profile', label: 'Profile' },
];

export default function AccountPage() {
  const { customer } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') || 'orders');

  useEffect(() => {
    const t = params.get('tab');
    if (t && TABS.find((x) => x.key === t)) setTab(t);
  }, [params]);

  const switchTab = (key) => {
    setTab(key);
    setParams({ tab: key });
  };

  return (
    <div className="container-main py-8">
      <h1 className="text-2xl font-bold mb-1">Hi, {customer?.name || 'Customer'}</h1>

      {/* Tabs */}
      <div className="flex items-center gap-2 mt-4 mb-6 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === t.key ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: tab === t.key ? 'var(--color-brand)' : 'var(--color-surface-tertiary)',
              color: tab === t.key ? 'white' : 'var(--color-content-secondary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'ledger' && <LedgerTab />}
      {tab === 'addresses' && <AddressesTab />}
      {tab === 'payments' && <PaymentsTab />}
      {tab === 'profile' && <ProfileTab />}
    </div>
  );
}
