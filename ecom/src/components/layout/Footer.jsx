import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Instagram, Facebook, Youtube, Truck, Shield, Clock } from 'lucide-react';
import { catalogService } from '../../services/catalogService';

export default function Footer() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    catalogService.getSettings().then(setSettings).catch(() => {});
  }, []);

  const social = settings?.socialLinks || {};

  return (
    <footer>
      {/* Trust bar */}
      <div className="border-t border-b" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
        <div className="container-main py-5 flex flex-wrap items-center justify-center gap-8 sm:gap-16">
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-content-secondary)' }}>
            <Truck className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
            <span>Fast wholesale delivery</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-content-secondary)' }}>
            <Shield className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
            <span>Secure payments</span>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-content-secondary)' }}>
            <Clock className="w-5 h-5" style={{ color: 'var(--color-brand)' }} />
            <span>24×7 order tracking</span>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div style={{ backgroundColor: 'var(--color-surface-secondary)' }}>
        <div className="container-main py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand info */}
          <div>
            <h3 className="text-lg font-bold mb-3">{settings?.storeName || 'Store'}</h3>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--color-content-secondary)' }}>
              {settings?.tagline || 'B2B wholesale platform for fast-moving consumer goods. Bulk pricing, live stock by location, and instant re-ordering.'}
            </p>
            <div className="flex gap-2">
              {social.twitter && <a href={social.twitter} target="_blank" rel="noreferrer" className="p-2 rounded-full border transition-colors hover:bg-[var(--color-surface-tertiary)]" style={{ borderColor: 'var(--color-border)' }}><Twitter className="w-4 h-4" /></a>}
              {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="p-2 rounded-full border transition-colors hover:bg-[var(--color-surface-tertiary)]" style={{ borderColor: 'var(--color-border)' }}><Instagram className="w-4 h-4" /></a>}
              {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer" className="p-2 rounded-full border transition-colors hover:bg-[var(--color-surface-tertiary)]" style={{ borderColor: 'var(--color-border)' }}><Facebook className="w-4 h-4" /></a>}
              {social.youtube && <a href={social.youtube} target="_blank" rel="noreferrer" className="p-2 rounded-full border transition-colors hover:bg-[var(--color-surface-tertiary)]" style={{ borderColor: 'var(--color-border)' }}><Youtube className="w-4 h-4" /></a>}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-semibold mb-3">Shop</h4>
            <nav className="flex flex-col gap-2 text-sm" style={{ color: 'var(--color-content-secondary)' }}>
              <Link to="/products" className="hover:text-[var(--color-content)] transition-colors">All Products</Link>
              <Link to="/products?featured=true" className="hover:text-[var(--color-content)] transition-colors">Featured</Link>
              <Link to="/products?sort=newest" className="hover:text-[var(--color-content)] transition-colors">New Arrivals</Link>
              <Link to="/wishlist" className="hover:text-[var(--color-content)] transition-colors">Wishlist</Link>
            </nav>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold mb-3">Company</h4>
            <nav className="flex flex-col gap-2 text-sm" style={{ color: 'var(--color-content-secondary)' }}>
              <Link to="/about-us" className="hover:text-[var(--color-content)] transition-colors">About Us</Link>
              <Link to="/contact-us" className="hover:text-[var(--color-content)] transition-colors">Contact Us</Link>
              <Link to="/terms-and-conditions" className="hover:text-[var(--color-content)] transition-colors">Terms & Conditions</Link>
              <Link to="/privacy-policy" className="hover:text-[var(--color-content)] transition-colors">Privacy Policy</Link>
              <Link to="/return-and-refund-policy" className="hover:text-[var(--color-content)] transition-colors">Return and Refund Policy</Link>
            </nav>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-semibold mb-3">Account</h4>
            <nav className="flex flex-col gap-2 text-sm" style={{ color: 'var(--color-content-secondary)' }}>
              <Link to="/login" className="hover:text-[var(--color-content)] transition-colors">Login</Link>
              <Link to="/register" className="hover:text-[var(--color-content)] transition-colors">Register</Link>
              <Link to="/account?tab=orders" className="hover:text-[var(--color-content)] transition-colors">My Orders</Link>
              <Link to="/account?tab=ledger" className="hover:text-[var(--color-content)] transition-colors">Ledger</Link>
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div className="container-main py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs" style={{ color: 'var(--color-content-tertiary)' }}>
            <span>{settings?.footerText || `© ${new Date().getFullYear()} ${settings?.storeName || 'Store'}. All rights reserved.`}</span>
            <div className="flex gap-4">
              <Link to="/terms-and-conditions" className="hover:text-[var(--color-content)] transition-colors">Terms</Link>
              <Link to="/privacy-policy" className="hover:text-[var(--color-content)] transition-colors">Privacy</Link>
              <Link to="/return-and-refund-policy" className="hover:text-[var(--color-content)] transition-colors">Returns</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
