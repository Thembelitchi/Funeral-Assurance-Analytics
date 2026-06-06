export interface Branch {
  branch_key: number;
  branch_name: string;
  region: string; // KZN district
}

export interface Plan {
  plan_key: number;
  plan_type: string; // Individual Standard, Family Plan, Individual Premium, Senior Dignity, Community Group, Extended Family
  base_premium: number;
}

export interface Policy {
  policy_id: number;
  branch_key: number;
  plan_key: number;
  agent_key: number;
  inception_date_key: number;
  status: 'Active' | 'Lapsed' | 'Cancelled' | 'Claimed';
  monthly_premium: number;
  months_on_books: number;
  total_premium_collected: number;
  lapse_date: string | null;
  claim_date: string | null;
}

export interface Claim {
  claim_id: number;
  policy_key: number;
  branch_key: number;
  claim_date_key: number;
  claim_amount: number;
  claim_type: string; // Natural, Accidental, Suicide
  cause_of_death: string;
  approval_status: 'Approved' | 'Pending' | 'Rejected';
  days_to_settlement: number;
}

export interface Premium {
  payment_key: number;
  policy_key: number;
  payment_date_key: number;
  amount: number;
  reconciliation_status: string;
}

export interface DateDim {
  date_key: number;
  full_date: string;
  financial_year: number;
  financial_period: number; // South African Financial Period (March = Month 1)
}

export interface DashboardMetrics {
  active_policies: number;
  total_policies: number;
  annual_premium_million: number;
  persistency_rate: number;
  loss_ratio: number;
  lapse_rate_average: number;
  worst_product_name: string;
  worst_product_lapse: number;
  worst_branch_name: string;
  worst_branch_lapse: number;
  revenue_at_risk_million: number;
}
