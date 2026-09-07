import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

export type TransactionType = 'entree' | 'sortie';

export interface Category {
  id: string;
  type: TransactionType;
  name: string;
}

export interface Designation {
  id: string;
  category_id: string;
  name: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category_id: string;
  designation_id: string | null;
  designation_custom: string | null;
  amount: number;
  note: string | null;
  transaction_date: string;
  created_at: string;
  categories?: Category;
  designations?: Designation;
}
