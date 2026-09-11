export interface ICurrentUser {
  username: string;
  name: string;
  email: string;
  roleId: number | null;
  roleName?: string;
  sessionId: string;
  permissions: string[];
  departments: string[];
  globalRoles?: string[];
  authType?: 'SSO' | 'API_KEY';
  sourceId?: string;
}
