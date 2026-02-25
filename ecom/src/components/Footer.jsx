import { Link } from 'react-router-dom';
import { Truck, Shield, Clock, Twitter, Instagram, Facebook, Youtube } from 'lucide-react';

export default function Footer({ settings }) {
  const storeName = settings?.storeName || 'STORE';
  const social = settings?.socialLinks || {};

  return (
    <footer className="border-t border-gray-800 bg-gray-950 mt-16">
      {/* Trust bar */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Truck, text: 'Fast wholesale delivery' },
          { icon: Shield, text: 'Secure payments' },
          { icon: Clock, text: '24×7 order tracking' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center justify-center gap-2 text-gray-400 text-sm">
            <Icon size={18} className="text-gray-500" />
            {text}
          </div>
        ))}
      </div>

      <div className="border-t border-gray-800" />

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Brand */}
        <div>
          <h3 className="font-bold text-lg mb-3">{storeName}</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            {settings?.tagline || 'B2B wholesale platform for fast-moving consumer goods. Bulk pricing, live stock, and instant re-ordering.'}
          </p>
          <div className="flex items-center gap-3">
            {social.twitter && <a href={social.twitter} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white"><Twitter size={18} /></a>}
            {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white"><Instagram size={18} /></a>}
            {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white"><Facebook size={18} /></a>}
            {social.youtube && <a href={social.youtube} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white"><Youtube size={18} /></a>}
          </div>
        </div>

        {/* Shop */}
        <div>
          <h4 className="font-semibold mb-3">Shop</h4>
          <div className="flex flex-col gap-2 text-sm text-gray-400">
            <Link to="/products" className="hover:text-white transition-colors">All Products</Link>
            <Link to="/products?featured=true" className="hover:text-white transition-colors">Featured</Link>
            <Link to="/products?sort=newest" className="hover:text-white transition-colors">New Arrivals</Link>
          </div>
        </div>

        {/* Company */}
        <div>
          <h4 className="font-semibold mb-3">Company</h4>
          <div className="flex flex-col gap-2 text-sm text-gray-400">
            <span className="cursor-default">Contact</span>
            <span className="cursor-default">Terms & Conditions</span>
            <span className="cursor-default">Returns & Refunds</span>
            <span className="cursor-default">Privacy Policy</span>
          </div>
        </div>

        {/* Account */}
        <div>
          <h4 className="font-semibold mb-3">Account</h4>
          <div className="flex flex-col gap-2 text-sm text-gray-400">
            <Link to="/login" className="hover:text-white transition-colors">Login</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
            <Link to="/account" className="hover:text-white transition-colors">My Account</Link>
            <Link to="/cart" className="hover:text-white transition-colors">Cart</Link>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-600">&copy; {new Date().getFullYear()} {storeName}. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <span className="hover:text-gray-400 cursor-pointer">Terms</span>
            <span className="hover:text-gray-400 cursor-pointer">Privacy</span>
            <span className="hover:text-gray-400 cursor-pointer">Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
