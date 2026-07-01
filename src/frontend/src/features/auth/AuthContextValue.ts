import { createContext } from 'react';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  role: 'audience' | 'organizer' | 'gate_staff';
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
