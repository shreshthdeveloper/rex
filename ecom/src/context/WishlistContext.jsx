import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);
export const useWishlist = () => useContext(WishlistContext);

const STORAGE_KEY = 'ecom_wishlist';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}

export function WishlistProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState(load);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }, [items]);

  // Clear wishlist completely on logout
  useEffect(() => {
    if (!isAuthenticated) setItems([]);
  }, [isAuthenticated]);

  const toggle = useCallback((product) => {
    setItems((prev) => {
      const exists = prev.find((i) => i._id === product._id);
      if (exists) {
        toast.success('Removed from wishlist');
        return prev.filter((i) => i._id !== product._id);
      }
      toast.success('Added to wishlist');
      // Store all fields ProductCard needs for proper price gating
      return [...prev, {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        type: product.type,
        images: product.images,
        basePrice: product.basePrice,
        compareAtPrice: product.compareAtPrice,
        priceRange: product.priceRange,
        brand: product.brand,
        categories: product.categories,
        inStock: product.inStock,
      }];
    });
  }, []);

  const isWishlisted = useCallback((id) => items.some((i) => i._id === id), [items]);

  return (
    <WishlistContext.Provider value={{ items, toggle, isWishlisted, count: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}
