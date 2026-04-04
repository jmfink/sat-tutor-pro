'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextValue {
  user: User | null;
  userId: string | null;
  name: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userId: null,
  name: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setName(null);
  }, [supabase]);

  const fetchName = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('students')
      .select('name')
      .eq('id', uid)
      .single();
    setName(data?.name ?? null);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchName(user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchName(u.id).finally(() => setLoading(false));
      } else {
        setName(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, userId: user?.id ?? null, name, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
