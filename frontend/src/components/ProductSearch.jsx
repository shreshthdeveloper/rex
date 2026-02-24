/**
 * ProductSearch — Global reusable product search component.
 *
 * Props:
 *   warehouseId  {string}   Optional. When provided, stock quantity is shown in dropdown rows.
 *   onSelect     {Function} Called with an array of { product, currentStock } objects.
 *                           Single/variant products → array with 1 item.
 *                           Parent product selected  → array of ALL its variants.
 *   placeholder  {string}   Input placeholder text.
 *   label        {string}   Optional field label rendered above the input.
 *   className    {string}   Extra wrapper classes.
 *   disabled     {boolean}  Disable the input.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Package, Loader2, Tag, Layers, AlertCircle } from 'lucide-react';
import { productsAPI, stockAPI } from '../api';

export default function ProductSearch({
  warehouseId,
  onSelect,
  placeholder = 'Search by name or SKU…',
  label,
  className = '',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [fetchingVariants, setFetchingVariants] = useState(null); // productId being fetched
  const [stockMap, setStockMap] = useState({}); // productId -> { quantity, reservedQuantity }
  const [stockLoading, setStockLoading] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── Load stock map whenever warehouse changes ── */
  useEffect(() => {
    if (!warehouseId) {
      setStockMap({});
      return;
    }
    const load = async () => {
      setStockLoading(true);
      try {
        // Fetch up to 999 stock records for this warehouse so we can look up quickly
        const res = await stockAPI.list({ warehouse: warehouseId, limit: 999 });
        const map = {};
        (res.data?.stocks || []).forEach((s) => {
          const id = s.product?._id || s.product;
          if (id) map[id] = { quantity: s.quantity ?? 0, reserved: s.reservedQuantity ?? 0 };
        });
        setStockMap(map);
      } catch {
        setStockMap({});
      } finally {
        setStockLoading(false);
      }
    };
    load();
  }, [warehouseId]);

  /* ── Debounced product search ── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Search all types including variants explicitly
        const res = await productsAPI.list({ search: q, limit: 10 });
        setResults(res.data?.products || []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  /* ── Handle selection ── */
  const handleSelect = useCallback(
    async (product) => {
      setQuery('');
      setResults([]);
      setOpen(false);

      if (product.type === 'parent') {
        setFetchingVariants(product._id);
        try {
          const res = await productsAPI.get(product._id);
          const variants = res.data?.variants || [];
          if (variants.length > 0) {
            onSelect(
              variants.map((v) => ({
                product: v,
                currentStock: stockMap[v._id]?.quantity ?? 0,
                reserved: stockMap[v._id]?.reserved ?? 0,
              }))
            );
          } else {
            // Parent with no variants — add the parent itself
            onSelect([
              {
                product,
                currentStock: stockMap[product._id]?.quantity ?? 0,
                reserved: stockMap[product._id]?.reserved ?? 0,
              },
            ]);
          }
        } catch {
          onSelect([
            {
              product,
              currentStock: stockMap[product._id]?.quantity ?? 0,
              reserved: stockMap[product._id]?.reserved ?? 0,
            },
          ]);
        } finally {
          setFetchingVariants(null);
        }
      } else {
        onSelect([
          {
            product,
            currentStock: stockMap[product._id]?.quantity ?? 0,
            reserved: stockMap[product._id]?.reserved ?? 0,
          },
        ]);
      }
    },
    [onSelect, stockMap]
  );

  /* ── Helpers ── */
  const getAvailable = (productId) => {
    const s = stockMap[productId];
    if (!s) return null;
    return s.quantity - s.reserved;
  };

  const typeColor = {
    single: 'bg-blue-100 text-blue-700',
    parent: 'bg-violet-100 text-violet-700',
    variant: 'bg-amber-100 text-amber-700',
  };

  const isLoading = searching || fetchingVariants;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}

      {/* Input */}
      <div className="relative">
        <Search
          size={15}
          className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
            open ? 'text-violet-500' : 'text-slate-400'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={
            stockLoading && warehouseId
              ? 'Loading stock data…'
              : placeholder
          }
          disabled={disabled || !!fetchingVariants}
          className="w-full glass-input pl-9 pr-10 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isLoading && (
          <Loader2
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-violet-500"
          />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {results.length === 0 && !searching ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
              <AlertCircle size={15} />
              No products found for &quot;{query}&quot;
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
              {results.map((product) => {
                const available = getAvailable(product._id);
                const isParent = product.type === 'parent';
                return (
                  <li key={product._id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                      onClick={() => handleSelect(product)}
                      disabled={!!fetchingVariants}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 transition-colors text-left disabled:opacity-50"
                    >
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        {product.images?.[0]?.url ? (
                          <img
                            src={product.images[0].url}
                            alt={product.name}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        ) : isParent ? (
                          <Layers size={16} className="text-violet-500" />
                        ) : (
                          <Package size={16} className="text-slate-400" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {product.name}
                          </span>
                          {product.variantValue && (
                            <span className="text-xs text-slate-500">({product.variantValue})</span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase ${
                              typeColor[product.type] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {product.type}
                          </span>
                          {isParent && (
                            <span className="text-[10px] text-violet-500 italic">
                              → adds all variants
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Tag size={10} />
                            {product.sku}
                          </span>
                          {warehouseId && available !== null && (
                            <span
                              className={`text-xs font-medium ${
                                available <= 0
                                  ? 'text-red-500'
                                  : available <= 10
                                  ? 'text-amber-500'
                                  : 'text-emerald-600'
                              }`}
                            >
                              Stock: {available}
                            </span>
                          )}
                          {warehouseId && available === null && (
                            <span className="text-xs text-slate-300">No stock record</span>
                          )}
                        </div>
                      </div>

                      {/* Price hint */}
                      {product.basePrice > 0 && (
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          ₹{product.basePrice}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
