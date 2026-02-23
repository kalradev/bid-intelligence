import React from "react";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  workInProgress?: boolean;
}

export default function FeatureCard({ icon, title, description, onClick, workInProgress }: FeatureCardProps) {
  // Determine hover color based on title
  const getHoverClass = () => {
    if (title.includes("Smart RFP")) return "hover-blue";
    if (title.includes("Product")) return "hover-green";
    if (title.includes("Global")) return "hover-purple";
    if (title.includes("Cost")) return "hover-orange";
    return "hover-blue";
  };

  return (
    <div
      onClick={workInProgress ? undefined : onClick}
      className={`feature-card hoverable-card ${getHoverClass()} ${workInProgress ? "feature-card-disabled" : "cursor-pointer"}`}
    >
      <div className="feature-icon">{icon}</div>
      <h3 className="font-semibold text-lg mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}
