import { useWishlist } from '../context/WishlistContext';
import { Link } from 'react-router-dom';
import { Heart, ArrowRight } from 'lucide-react';
import ProductCard from '../components/product/ProductCard';

export default function WishlistPage() {
  const { items, count } = useWishlist();

  if (items.length === 0) {
    return (
      <div className="container-main py-20 text-center">
        <Heart className="w-16 h-16 mx-auto text-content/30 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Your wishlist is empty</h2>
        <p className="text-content/60 mb-6">Save your favourite items here to find them easily later.</p>
        <Link to="/products" className="btn btn-primary btn-md inline-flex items-center gap-2">
          Browse Products <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="container-main py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Wishlist ({count})</h1>
        <Link to="/products" className="text-sm text-brand hover:underline">Continue Shopping</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {items.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
}
