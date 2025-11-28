// import { useState } from "react";
// import { CheckCircle, ChevronRight, Upload, FileSearch } from "lucide-react";
// import { useNavigate } from "react-router-dom";
// import toast, { Toaster } from "react-hot-toast";

// export default function UploadPage() {
//   const navigate = useNavigate();
//   const [uploadedFile, setUploadedFile] = useState<File | null>(null);
//   const [isAnalyzing, setIsAnalyzing] = useState(false);

//   // ✅ File upload validation
//   const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const file = event.target.files?.[0];
//     if (!file) return;

//     // ✅ Allow only PDF files
//     if (file.type !== "application/pdf") {
//       toast.error("Invalid file type. Please upload a PDF document only.", {
//         duration: 3000,
//         position: "top-right",
//         style: {
//           border: "1px solid #ef4444",
//           padding: "12px",
//           color: "#b91c1c",
//           background: "#fee2e2",
//           fontWeight: "500",
//         },
//         iconTheme: {
//           primary: "#dc2626",
//           secondary: "#fff",
//         },
//       });
//       event.target.value = ""; // Reset input
//       setUploadedFile(null);
//       return;
//     }

//     // ✅ Valid PDF file
//     setUploadedFile(file);
//     console.log("✅ PDF Uploaded:", file.name);
//   };

//   // ✅ Webhook Integration: Send PDF → n8n
//   const handleAnalyze = async () => {
//     if (!uploadedFile) {
//       toast.error("Please upload a PDF file first!");
//       return;
//     }

//     setIsAnalyzing(true);

//     try {
//       // Prepare file for webhook
//       const formData = new FormData();
//       formData.append("file", uploadedFile);

//       // ✅ Replace this with your actual n8n webhook URL
//       const webhookUrl = "http://192.168.0.143:5678/webhook-test/upload-rfp";

//       // Send file to n8n
//       const response = await fetch(webhookUrl, {
//         method: "POST",
        
//         body: formData,
//       });

//       if (!response.ok) throw new Error("Webhook request failed");

//       // Parse the response
//       const result = await response.json();
//       console.log("✅ Webhook Response:", result);

//       // ✅ Save analysis result for AnalysisPage
//       localStorage.setItem("analysisResult", JSON.stringify(result));

//       toast.success("RFP successfully analyzed!", {
//         duration: 2500,
//         position: "top-right",
//         style: {
//           border: "1px solid #10b981",
//           padding: "12px",
//           color: "#065f46",
//           background: "#ecfdf5",
//           fontWeight: "500",
//         },
//       });

//       // ✅ Redirect after short delay
//       setTimeout(() => {
//         navigate("/insights");
//       }, 1500);

//     } catch (error) {
//       console.error("❌ Webhook Error:", error);
//       toast.error("Failed to trigger analysis. Please try again later.", {
//         duration: 3000,
//         position: "top-right",
//         style: {
//           border: "1px solid #ef4444",
//           padding: "12px",
//           color: "#b91c1c",
//           background: "#fee2e2",
//           fontWeight: "500",
//         },
//       });
//     } finally {
//       setIsAnalyzing(false);
//     }
//   };

//   return (
//     <div className="universal-page-wrapper">
//       {/* Animated Background */}
//       <div className="universal-background">
//         <div className="universal-bg-gradient-1"></div>
//         <div className="universal-bg-gradient-2"></div>
//         <div className="universal-bg-gradient-3"></div>
//       </div>

//       <div className="min-h-screen bg-gray-50 py-12" style={{ position: "relative", zIndex: 1 }}>
//         <Toaster />
//         <button onClick={() => navigate("/")} className="back-button">
//           ← Back to Home
//         </button>

//         <div className="container mx-auto px-4 max-w-4xl">
//           <div className="bg-white rounded-2xl shadow-xl p-8">
//           <h1 className="text-3xl font-bold mb-2">Upload RFP Document</h1>
//           <p className="text-gray-600 mb-8">
//             Upload your RFP PDF to begin intelligent analysis
//           </p>

//           <div className="upload-box mb-8">
//             <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
//             <h3 className="text-xl font-semibold mb-2">Drop your RFP here</h3>

//             <input
//               type="file"
//               accept=".pdf"
//               onChange={handleFileUpload}
//               className="hidden"
//               id="file-upload"
//             />
//             <label
//               htmlFor="file-upload"
//               className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold cursor-pointer hover:bg-blue-700 inline-block"
//             >
//               Select PDF File
//             </label>

//             {uploadedFile && (
//               <div className="mt-4 p-4 bg-green-50 rounded-lg inline-flex items-center gap-2">
//                 <CheckCircle className="w-5 h-5 text-green-600" />
//                 <span className="text-green-700 font-semibold">
//                   {uploadedFile.name}
//                 </span>
//               </div>
//             )}
//           </div>

//           {uploadedFile && (
//             <button
//               onClick={handleAnalyze}
//               disabled={isAnalyzing}
//               className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 flex justify-center gap-2"
//             >
//               {isAnalyzing ? (
//                 <>
//                   <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
//                   Analyzing RFP...
//                 </>
//               ) : (
//                 <>
//                   Start Analysis <ChevronRight className="w-5 h-5" />
//                 </>
//               )}
//             </button>
//           )}

//           <div className="mt-8 bg-blue-50 rounded-lg p-6 hoverable-card hover-blue">
//             <h4 className="font-semibold mb-3 flex items-center gap-2">
//               <FileSearch className="w-5 h-5 text-blue-600" />
//               What happens next?
//             </h4>

//             <ul className="space-y-2 text-sm text-gray-700">
//               <li>AI categorizes content by department</li>
//               <li>BOQ items mapped to OEMs + MII identification</li>
//               <li>Cost estimates auto-generated</li>
//             </ul>
//           </div>
//         </div>
//         </div>
//       </div>
//     </div>
//   );
// }

import { CheckCircle, ChevronRight, FileSearch, Upload } from "lucide-react";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
 
export default function UploadPage() {
  const navigate = useNavigate();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
 
  // ✅ File upload validation
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
 
    // Allow only PDF files
    if (file.type !== "application/pdf") {
      toast.error("Invalid file type. Please upload a PDF document only.", {
        duration: 3000,
        position: "top-right",
        style: {
          border: "1px solid #ef4444",
          padding: "12px",
          color: "#b91c1c",
          background: "#fee2e2",
          fontWeight: "500",
        },
        iconTheme: {
          primary: "#dc2626",
          secondary: "#fff",
        },
      });
 
      event.target.value = "";
      setUploadedFile(null);
      return;
    }
 
    // Valid PDF
    setUploadedFile(file);
    console.log("✅ PDF Uploaded:", file.name);
  };
 
  // ✅ Backend API Integration → Send PDF to localhost:3000
  const handleAnalyze = async () => {
    if (!uploadedFile) {
      toast.error("Please upload a PDF file first!");
      return;
    }

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      // ✅ Call backend API
      const apiUrl = "http://localhost:3000/api/rfp/analyze";

      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "API request failed");
      }

      const result = await response.json();
      console.log("✅ API Response:", result);

      // 🚀 Store data in localStorage for global access
      localStorage.setItem("analysisData", JSON.stringify(result));

      toast.success("RFP successfully analyzed!", {
        duration: 1500,
        position: "top-right",
        style: {
          border: "1px solid #10b981",
          padding: "12px",
          color: "#065f46",
          background: "#ecfdf5",
          fontWeight: "500",
        },
      });

      // ✅ Redirect to insights page
      setTimeout(() => {
        navigate("/insights");
      }, 1500);

    } catch (error) {
      console.error("❌ API Error:", error);
      toast.error("Failed to analyze RFP. Please try again later.", {
        duration: 3000,
        position: "top-right",
        style: {
          border: "1px solid #ef4444",
          padding: "12px",
          color: "#b91c1c",
          background: "#fee2e2",
          fontWeight: "500",
        },
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
 
  return (
    <div className="universal-page-wrapper">
      {/* Background */}
      <div className="universal-background">
        <div className="universal-bg-gradient-1"></div>
        <div className="universal-bg-gradient-2"></div>
        <div className="universal-bg-gradient-3"></div>
      </div>
 
      <div className="min-h-screen bg-gray-50 py-12" style={{ position: "relative", zIndex: 1 }}>
        <Toaster />
        <button onClick={() => navigate("/")} className="back-button">
          ← Back to Home
        </button>
 
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-3xl font-bold mb-2">Upload RFP Document</h1>
            <p className="text-gray-600 mb-8">
              Upload your RFP PDF to begin intelligent analysis
            </p>
 
            <div className="upload-box mb-8">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Drop your RFP here</h3>
 
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold cursor-pointer hover:bg-blue-700 inline-block"
              >
                Select PDF File
              </label>
 
              {uploadedFile && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg inline-flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-semibold">
                    {uploadedFile.name}
                  </span>
                </div>
              )}
            </div>
 
            {uploadedFile && (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 flex justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Analyzing RFP...
                  </>
                ) : (
                  <>
                    Start Analysis <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
 
            <div className="mt-8 bg-blue-50 rounded-lg p-6 hoverable-card hover-blue">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-blue-600" />
                What happens next?
              </h4>
 
              <ul className="space-y-2 text-sm text-gray-700">
                <li>AI categorizes content by department</li>
                <li>BOQ items mapped to OEMs + MII identification</li>
                <li>Cost estimates auto-generated</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
 
