import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <div className="w-full sticky top-0 z-50 bg-white border-b border-gray-300 py-4 px-8 shadow-sm flex items-center justify-between">
      <h1
        className="text-2xl font-bold text-gray-800 cursor-pointer"
        onClick={() => navigate("/")}
      >
        Bid Intelligence
      </h1>

      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/upload")} className="text-gray-700 hover:text-blue-600 font-medium">
          Upload RFP
        </button>
        <button onClick={() => navigate("/analysis")} className="text-gray-700 hover:text-blue-600 font-medium">
          Analysis
        </button>
        <button onClick={() => navigate("/global-intelligence")} className="text-gray-700 hover:text-blue-600 font-medium">
          Build Your Stack
        </button>
        <button
          onClick={() => navigate("/")}
          className="text-red-600 hover:text-red-700 font-semibold ml-4"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
