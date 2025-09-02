import { type Database as GeneratedDatabase } from '../integrations/supabase/types.ts';
import { type Selections } from '../hooks/usePokerSession.ts';

export type PokerSessionRow = GeneratedDatabase['public']['Tables']['poker_sessions']['Row'] & {
  selections: Selections;
};

export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedDatabase['public'], 'Tables'> & {
    Tables: Omit<GeneratedDatabase['public']['Tables'], 'poker_sessions'> & {
      poker_sessions: {
        Row: PokerSessionRow;
        Insert: Omit<GeneratedDatabase['public']['Tables']['poker_sessions']['Insert'], 'selections'> & {
          selections: Selections;
        };
        Update: Omit<GeneratedDatabase['public']['Tables']['poker_sessions']['Update'], 'selections'> & {
          selections: Selections;
        };
      };
    };
  };
}; 