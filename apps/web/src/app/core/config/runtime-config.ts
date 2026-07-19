type StatsForgeRuntimeConfig = {
  apiBaseUrl?: string;
};

declare global {
  interface Window {
    __STATSFORGE_CONFIG__?: StatsForgeRuntimeConfig;
  }
}

export function apiUrl(path: string): string {
  const baseUrl = window.__STATSFORGE_CONFIG__?.apiBaseUrl?.replace(/\/$/, '') ?? '';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}
