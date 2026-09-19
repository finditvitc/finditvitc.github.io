export const DEFAULT_CATEGORY_IMAGES = {
  'Electronics': 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80',
  'Keys': 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=600&auto=format&fit=crop&q=80',
  'Bags & Backpacks': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=80',
  'IDs & Cards': 'https://images.unsplash.com/photo-1589758438368-0ad531db3366?w=600&auto=format&fit=crop&q=80',
  'Clothing': 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
  'Books': 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
  'Eyewear': 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80',
  'Jewelry': 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80',
  'Other': 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=600&auto=format&fit=crop&q=80'
};

export const getCategoryFallbackImage = (category) => {
  if (!category) return DEFAULT_CATEGORY_IMAGES['Other'];
  return DEFAULT_CATEGORY_IMAGES[category] || DEFAULT_CATEGORY_IMAGES['Other'];
};

export const getImageUrl = (photoUrl, category) => {
  if (!photoUrl) {
    return getCategoryFallbackImage(category);
  }
  if (typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/')) {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    return `${baseUrl}${photoUrl}`;
  }
  return photoUrl;
};

