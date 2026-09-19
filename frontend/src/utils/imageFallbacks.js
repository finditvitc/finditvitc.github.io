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

export const compressImageFile = (file, maxDimension = 640, quality = 0.72) => {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ dataUrl: '', file: null });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result || '';
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl: compressedDataUrl, width, height });
      };
      img.onerror = () => {
        resolve({ dataUrl: rawDataUrl, width: 0, height: 0 });
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      resolve({ dataUrl: '', file });
    };
    reader.readAsDataURL(file);
  });
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


