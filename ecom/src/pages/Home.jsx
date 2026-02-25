import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getSettings, getProducts, getFeatured, getCategories } from '../api';
import HeroBanner from '../components/HeroBanner';
import Carousel from '../components/Carousel';
import ProductCard from '../components/ProductCard';

export default function Home() {
  const [settings, setSettings] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getSettings().catch(() => ({ data: {} })),
      getFeatured().catch(() => ({ data: [] })),
      getProducts({ sort: 'newest', limit: 12 }).catch(() => ({ data: { products: [] } })),
      getCategories().catch(() => ({ data: [] })),
    ]).then(([s, f, n, c]) => {
      setSettings(s.data);
      setFeatured(Array.isArray(f.data) ? f.data : []);
      setNewArrivals(n.data?.products || []);
      setCategories(Array.isArray(c.data) ? c.data : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Hero Banner */}
      <HeroBanner banners={settings?.banners || []} />

      <div className="max-w-7xl mx-auto px-4 space-y-12 py-10">
        {/* Featured Brands - show categories as brands carousel */}
        {categories.length > 0 && (
          <Carousel title="Featured Brands">
            {categories.filter(c => !c.parentCategory).map((cat) => (
              <Link
                key={cat._id}
                to={`/products?category=${cat._id}`}
                className="shrink-0 w-40 h-24 glass-card flex items-center justify-center hover:border-brand-500/50 transition-all group"
              >
                <span className="text-base font-bold text-gray-400 group-hover:text-white transition-colors text-center px-2">{cat.name}</span>
              </Link>
            ))}
          </Carousel>
        )}

        {/* Trending Now (Featured) */}
        {featured.length > 0 && (
          <Carousel
            title="Trending Now"
            rightSlot={
              <Link to="/products?featured=true" className="text-sm text-gray-400 hover:text-brand-400 flex items-center gap-1 transition-colors">
                View all <ArrowRight size={14} />
              </Link>
            }
          >
            {featured.map((p) => (
              <div key={p._id} className="shrink-0 w-56">
                <ProductCard product={p} />
              </div>
            ))}
          </Carousel>
        )}

        {/* New Arrivals */}
        {newArrivals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">New Arrivals</h2>
                <div className="w-12 h-0.5 bg-brand-500 mt-1 rounded-full" />
              </div>
              <Link to="/products?sort=newest" className="text-sm text-gray-400 hover:text-brand-400 flex items-center gap-1 transition-colors">
                Browse catalogue <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {newArrivals.slice(0, 10).map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* If everything is empty */}
        {!featured.length && !newArrivals.length && (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-2">Welcome to {settings?.storeName || 'our store'}</h2>
            <p className="text-gray-500 mb-6">Products are being loaded. Check back soon!</p>
            <Link to="/products" className="btn-primary">Browse Products</Link>
          </div>
        )}
      </div>
    </div>
  );
}
