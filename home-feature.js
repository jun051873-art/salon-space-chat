export function homeFeatureData(config = {}, products = []) {
  if (!config.homeFeatureEnabled) return null;
  const product = Array.isArray(products)
    ? products.find(item => item.id === config.homeFeatureProductId && item.active !== false)
    : null;
  if (product) {
    const price = product.salePrice !== '' && product.salePrice != null
      ? `特價 $${product.salePrice}`
      : product.price !== '' && product.price != null ? `$${product.price}` : '';
    return {
      kind: '商品',
      title: product.title || '本月主打',
      text: [product.description, price].filter(Boolean).join('\n'),
      image: product.image || product.images?.[0] || '',
      product
    };
  }
  if (!(config.homeText || config.homeImage)) return null;
  return {
    kind: '服務',
    title: config.homeTitle || '本月主打',
    text: config.homeText || '',
    image: config.homeImage || '',
    product: null
  };
}
