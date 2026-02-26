import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

const STORAGE_KEY = 'ecom_cart';

function loadCart() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  const { isAuthenticated } = useAuth();

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }, [items]);

  // Clear cart completely on logout
  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [isAuthenticated]);

  const addItem = useCallback((product, variant, qty = 1) => {
    setItems((prev) => {
      const id = variant?._id || product._id;
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        toast.success('Quantity updated');
        return prev.map((i) => i.id === id ? { ...i, quantity: i.quantity + qty } : i);
      }
      toast.success('Added to cart');
      return [...prev, {
        id,
        productId: variant?._id || product._id,
        name: variant ? `${product.name} — ${variant.variantValue}` : product.name,
        sku: variant?.sku || product.sku,
        image: variant?.images?.[0]?.url || product.images?.[0]?.url || '',
        price: variant?.basePrice || product.basePrice,
        quantity: qty,
        slug: product.slug,
      }];
    });
  }, []);

  const updateQuantity = useCallback((id, qty) => {
    if (qty < 1) return;
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: qty } : i));
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success('Removed from cart');
  }, []);

  const clearCart = useCallback(() => { setItems([]); }, []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}
