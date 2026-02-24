/**
 * 4-Tier Price Resolution Service
 *
 * Tier 1 (Highest): Customer tier price from customer_tier_prices
 * Tier 2: Warehouse price from product_stocks.warehousePrice
 * Tier 3: SKU base price from products.basePrice
 * Tier 4 (Fallback): Parent product base price
 *
 * First non-null wins.
 */

const resolvePrice = async (models, { productId, warehouseId, customerId, qty = 1 }) => {
  const Product = models.Product;
  const ProductStock = models.ProductStock;
  const CustomerTierPrice = models.CustomerTierPrice;
  const Customer = models.Customer;

  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found');

  // Tier 1: Customer tier price
  if (customerId) {
    const customer = await Customer.findById(customerId);
    if (customer && customer.tier) {
      const tierPrice = await CustomerTierPrice.findOne({
        product: productId,
        tier: customer.tier,
        minQty: { $lte: qty },
      }).sort({ minQty: -1 });
      if (tierPrice && tierPrice.price != null) {
        return { price: tierPrice.price, tier: 'customer_tier', tierName: customer.tier };
      }
    }
  }

  // Tier 2: Warehouse price
  if (warehouseId) {
    const stock = await ProductStock.findOne({ product: productId, warehouse: warehouseId });
    if (stock && stock.warehousePrice != null) {
      return { price: stock.warehousePrice, tier: 'warehouse' };
    }
  }

  // Tier 3: SKU base price
  if (product.basePrice != null && product.basePrice > 0) {
    return { price: product.basePrice, tier: 'sku' };
  }

  // Tier 4: Parent product base price
  if (product.parentProduct) {
    const parent = await Product.findById(product.parentProduct);
    if (parent && parent.basePrice != null && parent.basePrice > 0) {
      return { price: parent.basePrice, tier: 'parent' };
    }
  }

  return { price: 0, tier: 'none' };
};

module.exports = { resolvePrice };
