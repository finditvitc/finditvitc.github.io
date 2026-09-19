/**
 * CampusFind - Unified API Client
 * Seamlessly interfaces with local development server or live AWS API Gateway
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// AWS API Gateway prod stage routes directly to /items, /alerts, whereas local dev uses /api
const isAws = !!import.meta.env.VITE_API_URL;
const PREFIX = isAws ? '' : '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const idToken = localStorage.getItem('campusfind_id_token');
  
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || `HTTP error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API Error on [${options.method || 'GET'} ${url}]:`, err);
    throw err;
  }
}

export const api = {
  // Items API
  async getItems(params = {}) {
    const query = new URLSearchParams();
    if (params.type && params.type !== 'all') query.append('type', params.type);
    if (params.category && params.category !== 'all') query.append('category', params.category);
    if (params.location && params.location !== 'all') query.append('location', params.location);
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.userId) query.append('userId', params.userId);
    if (params.search) query.append('search', params.search);

    const qs = query.toString();
    return request(`${PREFIX}/items${qs ? `?${qs}` : ''}`);
  },

  async getItem(id) {
    return request(`${PREFIX}/items/${id}`);
  },

  async createItem(itemData) {
    return request(`${PREFIX}/items`, {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },

  async updateItemStatus(id, status) {
    return request(`${PREFIX}/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async deleteItem(id) {
    return request(`${PREFIX}/items/${id}`, {
      method: 'DELETE',
    });
  },

  async getItemMatches(id) {
    return request(`${PREFIX}/items/${id}/matches`);
  },

  // Upload photo & Rekognition Analysis
  async uploadPhoto(file, titleHint = '') {
    // If AWS live, generate S3 Presigned URL first, upload to S3, then Rekognition event analyzes it!
    if (isAws) {
      const presignRes = await request(`${PREFIX}/uploads/presign`, {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          fileType: file.type || 'image/jpeg',
        }),
      });

      // Direct PUT to Amazon S3
      await fetch(presignRes.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      });

      return {
        photoUrl: presignRes.photoUrl,
        filename: file.name,
        ai_tags: presignRes.ai_tags || [],
        detected_labels: presignRes.detected_labels || [],
      };
    }

    // Local simulation upload
    const formData = new FormData();
    formData.append('file', file);
    if (titleHint) formData.append('hint', titleHint);

    const url = `${BASE_URL}/api/uploads/photo`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Photo upload failed');
    }

    const data = await res.json();
    if (data.photoUrl && data.photoUrl.startsWith('/')) {
      data.photoUrl = `${BASE_URL}${data.photoUrl}`;
    }
    return {
      photoUrl: data.photoUrl,
      filename: data.filename,
      ai_tags: data.ai_tags || [],
      detected_labels: data.detected_labels || [],
      dominant_colors: data.dominant_colors || []
    };
  },

  async analyzeRekognition(title, category, description = '') {
    return request(`${PREFIX}/rekognition/analyze`, {
      method: 'POST',
      body: JSON.stringify({ title, category, description }),
    });
  },


  // Emergency Alerts API
  async getAlerts() {
    return request(`${PREFIX}/alerts`);
  },

  async broadcastAlert(alertData) {
    return request(`${PREFIX}/alerts`, {
      method: 'POST',
      body: JSON.stringify(alertData),
    });
  },

  async subscribeAlert(endpoint, protocol = 'email') {
    return request(`${PREFIX}/alerts/subscribe`, {
      method: 'POST',
      body: JSON.stringify({ endpoint, protocol }),
    });
  },

  // Demo Auth
  async getDemoUsers() {
    return request(`${PREFIX}/auth/demo-users`);
  }
};
