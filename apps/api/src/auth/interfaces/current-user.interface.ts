export interface ICurrentUser {
  username: string;
  name: string;
  email: string;
  roleId: number | null;
  roleName?: string;
  sessionId: string;
  permissions: string[];
  departments: string[];
  /** Authentication method: 'JWT' or 'API_KEY' */
  authType?: 'JWT' | 'API_KEY';
  /** Source ID (sessionId for JWT, apiKeyId for API_KEY) */
  sourceId?: string;
}
