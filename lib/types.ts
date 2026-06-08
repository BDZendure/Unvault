export type PieceStatus = 'pending' | 'analyzed';

export type Analysis = {
  confidence: number;
  metalType: string;
  metalPurity: string;
  gemstone: string;
  gemstoneDetails: string;
  estimatedValue: { low: number; high: number };
  style: string;
  era: string;
  condition: string;
  conditionScore: number;
  signals: string[];
  care: string[];
};

export type Piece = {
  id: number;
  user_id: string;
  name: string;
  image_path: string;
  image_url: string | null;
  status: PieceStatus;
  analysis: Analysis | null;
  created_at: string;
  date: string;
};

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  is_premium: boolean;
  analyses_used: number;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
};

export const FREE_ANALYSIS_LIMIT = 3;
