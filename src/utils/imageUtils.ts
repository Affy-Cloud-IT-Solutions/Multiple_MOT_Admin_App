import { BASE_URL } from '../context/DataContext';

export const API_ORIGIN = BASE_URL.replace(/\/api\/?$/, '');

/**
 * Normalises an image or document URL so that React Native can load it reliably:
 * - Trims whitespace and ignores null/undefined/empty
 * - Preserves file://, content://, and data: URIs (local device gallery picks)
 * - Converts http://api.ondoorcarservice.com to https:// (fixes Android cleartext traffic blocking)
 * - Upgrades api.ondoorcarservice.com/uploads/ to /api/uploads/ (so Nginx reverse proxy forwards it to Node.js)
 * - Prepends API_ORIGIN to relative paths like /uploads/... or /api/uploads/...
 */
export const resolveImageUrl = (raw?: string | null): string => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return '';

  if (trimmed.startsWith('file://') || trimmed.startsWith('data:') || trimmed.startsWith('content://')) {
    return trimmed;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    let upgraded = trimmed.replace(/^http:\/\/api\.ondoorcarservice\.com/i, 'https://api.ondoorcarservice.com');
    if (upgraded.includes('api.ondoorcarservice.com/uploads/')) {
      upgraded = upgraded.replace('api.ondoorcarservice.com/uploads/', 'api.ondoorcarservice.com/api/uploads/');
    }
    return upgraded;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const apiPath = cleanPath.startsWith('/uploads/') ? `/api${cleanPath}` : cleanPath;
  return `${API_ORIGIN}${apiPath}`;
};
