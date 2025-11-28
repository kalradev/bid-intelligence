import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  valueColor?: string; // optional text color class
}

export default function MetricCard({ label, value, icon, valueColor = "text-gray-900" }: MetricCardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-gray-600 text-sm font-semibold">{label}</h3>
        {icon}
      </div>
      <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
