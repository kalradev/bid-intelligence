import React from "react";
import { useNavigate } from "react-router-dom";

interface DepartmentCardProps {
  icon: React.ReactNode;
  name: string;
  textClass: string;
}

export default function DepartmentCard({ icon, name, textClass }: DepartmentCardProps) {
  const navigate = useNavigate();

  // Determine hover color based on department
  const getHoverClass = () => {
    if (name.includes("Bid")) return "hover-blue";
    if (name.includes("Technical")) return "hover-green";
    if (name.includes("Commercial")) return "hover-purple";
    if (name.includes("Finance")) return "hover-orange";
    if (name.includes("Legal")) return "hover-pink";
    if (name.includes("SCM")) return "hover-cyan";
    return "hover-blue";
  };

  // 🚀 Navigation Logic
  const handleNavigation = () => {
    if (name.includes("Bid")) navigate("/bid-management");
    else if (name.includes("Technical")) navigate("/technical");
    else if (name.includes("Commercial")) navigate("/commercial");
    else if (name.includes("Finance")) navigate("/finance");
    else if (name.includes("Legal")) navigate("/legal");
    else if (name.includes("SCM")) navigate("/scm");
    else alert("Page not configured!");
  };

  return (
    <div
      className={`dept-card hoverable-card ${getHoverClass()} flex flex-col items-center cursor-pointer`}
      onClick={handleNavigation}
    >
      <div className={`${textClass} mb-2 flex justify-center`}>
        {icon}
      </div>
      <p className="font-semibold text-sm text-gray-900 mt-2 text-center">
        {name}
      </p>
    </div>
  );
}
