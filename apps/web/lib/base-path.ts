export const APP_BASE_PATH = '/ansei' as const;

export function withBasePath(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error('Application paths must start with /');
  }

  if (path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) {
    return path;
  }

  return path === '/' ? `${APP_BASE_PATH}/` : `${APP_BASE_PATH}${path}`;
}

export function withoutBasePath(path: string): string {
  if (path === APP_BASE_PATH) return '/';
  if (path.startsWith(`${APP_BASE_PATH}/`)) {
    return path.slice(APP_BASE_PATH.length);
  }
  return path;
}
