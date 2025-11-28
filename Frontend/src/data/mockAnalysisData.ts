// src/data/mockAnalysisData.ts
const mockAnalysisData = {
  project_name: "Smart City Infrastructure RFP",
  summaries: {
    bid_management: {
      overview: "Large-scale smart city project worth ₹450 Cr",
      deadlines: "Submission: 15 days | Technical: 30 days",
      strategy: "Focus on MII compliance and local partnerships",
      success_factors: [
        "Strong technical capability",
        "MII compliance at 67%",
        "Competitive pricing strategy"
      ]
    },
    technical: {
      total_items: 45,
      compliance_percentage: 92,
      key_specs: ["IoT sensors", "5G infrastructure", "Smart lighting systems"],
      gaps: ["Advanced AI analytics module needs clarification"]
    },
    commercial: {
      estimated_value: "₹450 Cr",
      payment_terms: "30-60-90 days",
      warranties: "5 years comprehensive",
      penalties: "0.5% per week delay"
    },
    finance: {
      turnover_required: "₹200 Cr",
      bank_guarantee: "₹45 Cr (10%)",
      eligibility: "Compliant",
      profitability: "Expected 12-15% margin"
    },
    legal: {
      contract_type: "EPC with O&M",
      liability_cap: "Contract value",
      dispute_resolution: "Arbitration",
      compliance_docs: ["ISO 9001", "ISO 14001", "Make in India Certificate"]
    },
    scm: {
      lead_time: "6-8 months",
      critical_items: 12,
      sourcing_strategy: "67% domestic, 33% import",
      risk_level: "Medium"
    }
  },
  mii_analysis: {
    total_items: 45,
    mii_items: 30,
    mii_percentage: "67%",
    mii_value: "₹301.5 Cr"
  },
  product_mapping: {
    total_products: 45,
    categories: 8,
    verified_oems: 23,
    indian_oems: 15
  }
};

export default mockAnalysisData;
