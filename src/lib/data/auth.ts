import { client } from './dataClient';
// import { supabase as client } from '@/integrations/supabase/client';

// Auth Helpers (centralized wrappers around Supabase auth)

export async function getAuthSession() {
    return client.auth.getSession();
}

export async function getAuthUser() {
    return client.auth.getUser();
}

export function onAuthStateChange(callback: (event: any, session: any) => void) {
    return client.auth.onAuthStateChange(callback);
}

export async function signInWithOAuth(provider: 'github' | 'google', redirectTo?: string) {
    return client.auth.signInWithOAuth({ provider, options: redirectTo ? { redirectTo } : undefined as any });
}

export async function resetPasswordForEmail(email: string, redirectTo: string) {
    return client.auth.resetPasswordForEmail(email, { redirectTo });
}

export async function signUpWithEmail(email: string, password: string, fullName: string, redirectURL: string) {
    return client.auth.signUp(
        {
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
                emailRedirectTo: redirectURL,
            }
        }
    );
}

export async function signInWithPassword(email: string, password: string) {
    return client.auth.signInWithPassword({ email, password });
}

export async function setAuthSession(accessToken: string, refreshToken: string) {
    return client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
}

export async function updateAuthUser(payload: { password?: string }) {
    return client.auth.updateUser(payload);
}

export async function signOut() {
    return client.auth.signOut();
}
