export interface AnalysisResult {
  project_name?: string;
  status?: string;
  mii_analysis?: {
    total_items?: number;
    mii_items?: number;
    mii_percentage?: string;
    mii_value?: string;
  };
  product_mapping?: {
    verified_oems?: number;
    indian_oems?: number;
  };
  summaries?: Record<string, unknown>;
}
