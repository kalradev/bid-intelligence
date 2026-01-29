import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, RotateCw } from "lucide-react";
import { API_BASE_URL } from '../config';

export default function DocumentViewer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileHash = searchParams.get("hash");
  const fileName = searchParams.get("fileName") || "document.pdf";
  const pageNumber = parseInt(searchParams.get("page") || "1");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [currentPage, setCurrentPage] = useState(pageNumber);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [totalPages, setTotalPages] = useState<number | null>(null);

  // Update currentPage when page parameter changes in URL
  useEffect(() => {
    const pageFromUrl = parseInt(searchParams.get("page") || "1");
    if (pageFromUrl !== currentPage) {
      setCurrentPage(pageFromUrl);
    }
  }, [searchParams, currentPage]);

  useEffect(() => {
    if (fileHash && iframeRef.current) {
      // Load PDF in iframe with page anchor
      const baseUrl = `${API_BASE_URL}/api/rfp/document/${fileHash}?fileName=${encodeURIComponent(fileName)}`;
      const viewerUrl = `${baseUrl}#page=${currentPage}`;
      
      // Set the source - browser will handle page navigation via anchor
      iframeRef.current.src = viewerUrl;
      
      const handleLoad = () => {
        setError(null);
        // Try to get total pages from iframe (if PDF.js is available)
        try {
          if (iframeRef.current?.contentWindow) {
            // Scroll to top when page changes
            iframeRef.current.contentWindow.scrollTo(0, 0);
          }
        } catch (e) {
          console.debug('Could not access iframe content');
        }
      };
      
      const handleError = () => {
        setError('Failed to load document. Please check if the document exists and the backend server is running.');
      };
      
      iframeRef.current.addEventListener('load', handleLoad);
      iframeRef.current.addEventListener('error', handleError);
      
      return () => {
        if (iframeRef.current) {
          iframeRef.current.removeEventListener('load', handleLoad);
          iframeRef.current.removeEventListener('error', handleError);
        }
      };
    }
  }, [fileHash, fileName, currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      // Update URL
      const newUrl = `/document-viewer?hash=${fileHash}&fileName=${encodeURIComponent(fileName)}&page=${currentPage - 1}`;
      window.history.pushState({}, '', newUrl);
    }
  };

  const handleNextPage = () => {
    setCurrentPage(currentPage + 1);
    // Update URL
    const newUrl = `/document-viewer?hash=${fileHash}&fileName=${encodeURIComponent(fileName)}&page=${currentPage + 1}`;
    window.history.pushState({}, '', newUrl);
  };

  const handleZoomIn = () => {
    if (zoom < 200) {
      setZoom(prev => prev + 10);
    }
  };

  const handleZoomOut = () => {
    if (zoom > 50) {
      setZoom(prev => prev - 10);
    }
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handleDownload = () => {
    const downloadUrl = `${API_BASE_URL}/api/rfp/document/${fileHash}?fileName=${encodeURIComponent(fileName)}`;
    window.open(downloadUrl, '_blank');
  };

  const handleGoToPage = (page: number) => {
    if (page >= 1 && (!totalPages || page <= totalPages)) {
      setCurrentPage(page);
      const newUrl = `/document-viewer?hash=${fileHash}&fileName=${encodeURIComponent(fileName)}&page=${page}`;
      window.history.pushState({}, '', newUrl);
    }
  };

  if (!fileHash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg">
          <p className="text-gray-600 mb-4 text-lg">No document specified</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const pdfUrl = `${API_BASE_URL}/api/rfp/document/${fileHash}?fileName=${encodeURIComponent(fileName)}#page=${currentPage}`;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Enhanced Header */}
      <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between shadow-lg border-b border-gray-700">
        <div className="flex items-center gap-6 flex-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
            <h1 className="text-lg font-semibold text-white truncate max-w-md">
              {fileName}
            </h1>
          </div>
          
          {/* Page Navigation */}
          <div className="flex items-center gap-3 bg-gray-700 rounded-lg px-3 py-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage <= 1}
              className="p-1.5 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (!isNaN(page)) {
                    handleGoToPage(page);
                  }
                }}
                className="w-16 px-2 py-1 bg-gray-600 text-white text-center rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                min={1}
                max={totalPages || undefined}
              />
              <span className="text-gray-400 text-sm">
                {totalPages ? `of ${totalPages}` : ''}
              </span>
            </div>
            <button
              onClick={handleNextPage}
              className="p-1.5 rounded hover:bg-gray-600 transition-colors"
              title="Next Page"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className="p-1.5 rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-600 rounded transition-colors"
              title="Reset Zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="p-1.5 rounded hover:bg-gray-600 disabled:opacity-50 transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium"
          title="Download PDF"
        >
          <Download size={18} />
          <span>Download</span>
        </button>
      </div>

      {/* PDF Viewer Container */}
      <div className="flex-1 relative bg-gray-900 overflow-auto">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl">
              <p className="text-red-400 mb-4 text-lg">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  if (iframeRef.current) {
                    iframeRef.current.src = pdfUrl;
                  }
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        <div 
          className="w-full h-full flex items-start justify-center p-4 overflow-auto"
          style={{ 
            backgroundColor: '#525252'
          }}
        >
          <div
            style={{
              width: `${zoom}%`,
              maxWidth: '100%',
              height: '100%',
              transition: 'width 0.2s ease',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}
          >
            <iframe
              ref={iframeRef}
              src={pdfUrl}
              className="border-0 rounded-lg shadow-2xl"
              title="PDF Viewer"
              style={{ 
                background: "white",
                width: '100%',
                height: '100%',
                minHeight: '800px',
                border: 'none'
              }}
              allow="fullscreen"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

