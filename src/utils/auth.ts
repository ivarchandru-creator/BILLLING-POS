import { AdminUser, AuthSession } from '../types';

const ADMIN_USERS_STORAGE_KEY = 'elec_shop_admin_users_v2';
const AUTH_SESSION_STORAGE_KEY = 'elec_shop_auth_session_v2';

export const DEFAULT_INITIAL_ADMIN: AdminUser = {
  adminId: 'admin',
  name: 'admin',
  password: 'admin',
  role: 'admin',
  createdAt: new Date().toISOString(),
};

export function loadAdminUsers(): AdminUser[] {
  try {
    const raw = localStorage.getItem(ADMIN_USERS_STORAGE_KEY);
    if (!raw) {
      const initial = [DEFAULT_INITIAL_ADMIN];
      localStorage.setItem(ADMIN_USERS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return [DEFAULT_INITIAL_ADMIN];
  } catch {
    return [DEFAULT_INITIAL_ADMIN];
  }
}

export function saveAdminUser(newUser: AdminUser): void {
  try {
    const users = loadAdminUsers();
    const existingIndex = users.findIndex(
      (u) => u.adminId.trim().toLowerCase() === newUser.adminId.trim().toLowerCase()
    );
    if (existingIndex >= 0) {
      users[existingIndex] = newUser;
    } else {
      users.push(newUser);
    }
    localStorage.setItem(ADMIN_USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save admin user', e);
  }
}

export function verifyAdminCredentials(adminId: string, password: string): AdminUser | null {
  const users = loadAdminUsers();
  const trimmedId = adminId.trim().toLowerCase();
  const found = users.find(
    (u) => u.adminId.trim().toLowerCase() === trimmedId && u.password === password
  );
  if (found) {
    found.lastLoginAt = new Date().toISOString();
    saveAdminUser(found);
    return found;
  }
  return null;
}

export function getActiveAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setActiveAuthSession(session: AuthSession | null): void {
  try {
    if (session) {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to update auth session', e);
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear auth session', e);
  }
}
