import { BarChart3, FileText, DollarSign, TrendingUp, Scale, Truck, Globe, Package, FileSearch } from "lucide-react";

export const features = [
  {
    icon: <FileSearch className="w-8 h-8 text-blue-500" />,
    title: "Smart RFP Analysis",
    description: "Automatically demystify complex RFPs into department-specific summaries",
    route: "/smart-rfp"
  },
  {
    icon: <Package className="w-8 h-8 text-green-500" />,
    title: "Product Mapping",
    description: "Match BOQ items with global OEMs and highlight Make in India products",
    route: "/product-mapping"
  },
  {
    icon: <Globe className="w-8 h-8 text-purple-500" />,
    title: "Global Intelligence",
    description: "Real-time product research using global internet search",
    route: "/global-intelligence"
  },
  {
    icon: <TrendingUp className="w-8 h-8 text-orange-500" />,
    title: "Cost Estimation",
    description: "AI-powered pricing intelligence and cost optimization",
    route: "/cost-estimation"
  }
];

export const departments = [
  { id: 'bid_management', name: 'Bid Management', icon: <BarChart3 className="w-5 h-5" />, bgClass: 'bg-blue-600', textClass: 'text-blue-600' },
  { id: 'technical', name: 'Technical', icon: <FileText className="w-5 h-5" />, bgClass: 'bg-green-600', textClass: 'text-green-600' },
  { id: 'commercial', name: 'Commercial', icon: <DollarSign className="w-5 h-5" />, bgClass: 'bg-purple-600', textClass: 'text-purple-600' },
  { id: 'finance', name: 'Finance', icon: <TrendingUp className="w-5 h-5" />, bgClass: 'bg-yellow-600', textClass: 'text-yellow-600' },
  { id: 'legal', name: 'Legal', icon: <Scale className="w-5 h-5" />, bgClass: 'bg-red-600', textClass: 'text-red-600' },
  { id: 'scm', name: 'SCM', icon: <Truck className="w-5 h-5" />, bgClass: 'bg-indigo-600', textClass: 'text-indigo-600' }
];
