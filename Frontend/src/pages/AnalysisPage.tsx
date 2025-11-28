import { motion } from "framer-motion";
import CountUp from "react-countup";
import { Download, Package, CheckCircle, TrendingUp, Globe, FileCheck, Award, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useNavigate } from "react-router-dom";

export default function AnalysisPage() {
  const navigate = useNavigate();
  
  // Example data (you can replace this with real values from backend)
  const totalItems = 120;
  const miiCompliance = 75;
  const miiValue = 125000;
  const verifiedOEMs = 15;
  const indianOEMs = 10;

  const pieData = [
    { name: "MII Compliant", value: miiCompliance },
    { name: "Non-Compliant", value: 100 - miiCompliance },
  ];

  const COLORS = ["#10b981", "#f97316"];

  const handleDownload = () => {
    const blob = new Blob(["RFP Analysis Report: Success ✅"], {
      type: "text/plain",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "RFP_Analysis_Report.txt";
    link.click();
  };

  const metrics = [
    {
      icon: <Package className="w-8 h-8" />,
      label: "Total Items",
      value: totalItems,
      color: "blue",
      bgGradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
      delay: 0.1
    },
    {
      icon: <CheckCircle className="w-8 h-8" />,
      label: "MII Compliance",
      value: miiCompliance,
      suffix: "%",
      color: "green",
      bgGradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      delay: 0.2
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      label: "MII Value",
      value: miiValue,
      prefix: "₹ ",
      color: "purple",
      bgGradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
      delay: 0.3
    },
    {
      icon: <Globe className="w-8 h-8" />,
      label: "Verified OEMs",
      value: verifiedOEMs,
      subtitle: `${indianOEMs} Indian OEMs`,
      color: "orange",
      bgGradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
      delay: 0.4
    }
  ];

  return (
    <div className="analysis-page-wrapper">
      {/* Animated Background */}
      <div className="analysis-background">
        <div className="bg-gradient-1"></div>
        <div className="bg-gradient-2"></div>
        <div className="bg-gradient-3"></div>
      </div>

      <div className="analysis-content">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="analysis-header-card"
        >
          <div className="header-icon-wrapper">
            <FileCheck className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="analysis-title">RFP Analysis Report</h1>
          <p className="analysis-subtitle">
            Comprehensive analysis completed successfully
          </p>
          <div className="success-badge">
            <CheckCircle className="w-5 h-5" />
            <span>Analysis Complete</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownload}
            className="download-btn"
          >
            <Download className="w-5 h-5" />
            <span>Download Full Report</span>
          </motion.button>
        </motion.div>

        {/* Metrics Grid */}
        <div className="metrics-grid">
          {metrics.map((metric, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: metric.delay }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`metric-card metric-${metric.color}`}
            >
              <div 
                className="metric-icon-wrapper"
                style={{ background: metric.bgGradient }}
              >
                {metric.icon}
              </div>
              <h3 className="metric-label">{metric.label}</h3>
              <p className="metric-value">
                {metric.prefix}
                <CountUp 
                  end={metric.value} 
                  duration={2.5} 
                  separator=","
                  decimals={metric.suffix === "%" ? 0 : 0}
                />
                {metric.suffix}
              </p>
              {metric.subtitle && (
                <p className="metric-subtitle">{metric.subtitle}</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Compliance Chart Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="compliance-chart-card"
        >
          <div className="chart-header">
            <Award className="w-6 h-6 text-green-600" />
            <h2 className="chart-title">Make in India Compliance</h2>
          </div>
          <div className="chart-content">
            <div className="pie-chart-wrapper">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  >
                    {pieData.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        stroke="#fff"
                        strokeWidth={3}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-stats">
              <div className="stat-item">
                <div className="stat-dot stat-dot-green"></div>
                <div>
                  <p className="stat-value">{miiCompliance}%</p>
                  <p className="stat-label">MII Compliant</p>
                </div>
              </div>
              <div className="stat-item">
                <div className="stat-dot stat-dot-orange"></div>
                <div>
                  <p className="stat-value">{100 - miiCompliance}%</p>
                  <p className="stat-label">Non-Compliant</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="summary-grid">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="summary-card"
          >
            <BarChart3 className="w-6 h-6 text-blue-600 mb-3" />
            <h3 className="summary-title">Project Overview</h3>
            <p className="summary-text">
              {totalItems} items analyzed across multiple categories with comprehensive 
              compliance verification and OEM mapping.
            </p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="summary-card"
          >
            <Globe className="w-6 h-6 text-purple-600 mb-3" />
            <h3 className="summary-title">Global Reach</h3>
            <p className="summary-text">
              {verifiedOEMs} verified OEMs identified with {indianOEMs} Indian manufacturers 
              ensuring strong Make in India compliance.
            </p>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="analysis-footer"
        >
          <p>© 2025 RFP Analyzer | Professional Bid Intelligence Platform</p>
        </motion.div>

        {/* Home Button */}
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate("/")}
          className="home-button"
        >
          Home
        </motion.button>
      </div>
    </div>
  );
}
