import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { Bot, User, X, Maximize2, Wand2, Search, Copy } from "lucide-react";

interface Message {
  text: string;
  sender: "user" | "bot";
  timestamp: string;
  deepResearch?: boolean;
  googleResults?: Array<{title: string; snippet: string; link: string}>;
  sourcePages?: string[]; // Page numbers where the answer came from
}

export default function ChatbotPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      text: "Hello! I'm your Bid Intelligence.Ai assistant. Tell me how can i help you!",
      sender: "bot",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [currentDocument, setCurrentDocument] = useState<{fileHash: string; fileName: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Get current document ID from localStorage
  useEffect(() => {
    const recentAnalysis = localStorage.getItem('recentRfpAnalysis');
    const currentDoc = localStorage.getItem('currentDocument');
    
    if (recentAnalysis) {
      try {
        const analysis = JSON.parse(recentAnalysis);
        if (analysis.fileHash) {
          setCurrentDocumentId(analysis.fileHash);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    if (currentDoc) {
      try {
        const doc = JSON.parse(currentDoc);
        if (doc.fileHash && doc.fileName) {
          setCurrentDocument(doc);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getTimeStamp = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Silent fail - no notification
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      text: inputMessage.trim(),
      sender: "user",
      timestamp: getTimeStamp(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Get analysis data from localStorage
      const analysisDataStr = localStorage.getItem("analysisData");
      let analysisData = null;
      if (analysisDataStr) {
        try {
          const parsed = JSON.parse(analysisDataStr);
          analysisData = parsed?.data?.departmentalSummaries || null;
          if (analysisData) {
            console.log(`📊 Sending analysis data from UI (${Object.keys(analysisData).length} departments)`);
          }
        } catch (e) {
          console.warn("Failed to parse analysis data from localStorage");
        }
      }
      
      const requestBody: any = { 
        msg: userMessage.text,
        deepResearch: deepResearch,
        analysisData: analysisData  // Send analysis data from UI
      };
      
      // Add documentId if available
      if (currentDocumentId) {
        requestBody.documentId = currentDocumentId;
        console.log(`📄 Querying document-specific: ${currentDocument?.fileName || currentDocumentId}`);
      } else {
        console.log(`🌐 Querying general knowledge base (no document selected)`);
      }

      const response = await fetch("http://localhost:8080/get", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from chatbot");
      }

      const data = await response.json();
      
      // Debug: Log page references
      if (data.sourcePages && data.sourcePages.length > 0) {
        console.log(`📄 Page references received:`, data.sourcePages);
      } else {
        console.log(`⚠️ No page references in response. Response keys:`, Object.keys(data));
      }
      
      const botMessage: Message = {
        text: data.answer || data,
        sender: "bot",
        timestamp: getTimeStamp(),
        deepResearch: data.deepResearch || false,
        googleResults: data.googleResults || [],
        sourcePages: data.sourcePages || []
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      toast.error("Failed to get response. Please make sure the chatbot server is running on port 8080.", {
        duration: 4000,
        position: "top-right",
      });
      
      const errorMessage: Message = {
        text: "Sorry, I'm having trouble connecting. Please make sure the chatbot server is running.",
        sender: "bot",
        timestamp: getTimeStamp(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ 
      background: 'linear-gradient(135deg, #f5f7fa 0%, #e8eaf6 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <Toaster />
      
      {/* Chatbot Modal */}
      <div className="relative w-full max-w-2xl" style={{
        background: 'linear-gradient(to bottom, #ffffff 0%, #fef3f7 100%)',
        borderRadius: '24px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
        overflow: 'hidden',
        position: 'relative',
        minHeight: '600px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Floating Robot Icon */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            position: 'relative'
          }}>
            {/* Robot Face */}
            <div style={{
              width: '60px',
              height: '60px',
              background: '#ffffff',
              borderRadius: '50%',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Blue Visor */}
              <div style={{
                width: '45px',
                height: '25px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                borderRadius: '20px 20px 8px 8px',
                position: 'relative',
                top: '-5px'
              }}>
                {/* Glowing Eyes */}
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '12px',
                  width: '8px',
                  height: '8px',
                  background: '#60a5fa',
                  borderRadius: '50%',
                  boxShadow: '0 0 12px rgba(96, 165, 250, 0.8), 0 0 20px rgba(96, 165, 250, 0.6)',
                  animation: 'pulse 2s ease-in-out infinite'
                }}></div>
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '12px',
                  width: '8px',
                  height: '8px',
                  background: '#60a5fa',
                  borderRadius: '50%',
                  boxShadow: '0 0 12px rgba(96, 165, 250, 0.8), 0 0 20px rgba(96, 165, 250, 0.6)',
                  animation: 'pulse 2s ease-in-out infinite'
                }}></div>
              </div>
              {/* Robot Ears */}
              <div style={{
                position: 'absolute',
                left: '-8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '12px',
                height: '20px',
                background: '#3b82f6',
                borderRadius: '6px'
              }}></div>
              <div style={{
                position: 'absolute',
                right: '-8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '12px',
                height: '20px',
                background: '#3b82f6',
                borderRadius: '6px'
              }}></div>
            </div>
          </div>
        </div>

        {/* Header with Controls */}
        <div className="flex items-center justify-between p-4 pt-12" style={{ paddingTop: '60px' }}>
          <div className="flex items-center gap-3 flex-1">
            {currentDocument ? (
              <div style={{
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                padding: '6px 12px',
                borderRadius: '12px',
                border: '1px solid #93c5fd',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                maxWidth: '70%'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#10b981',
                  borderRadius: '50%',
                  boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                  animation: 'pulse 2s ease-in-out infinite'
                }}></div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#1e40af',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={currentDocument.fileName}>
                  📄 {currentDocument.fileName}
                </span>
              </div>
            ) : (
              <div style={{
                background: '#f3f4f6',
                padding: '6px 12px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: '#9ca3af',
                  borderRadius: '50%'
                }}></div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#6b7280'
                }}>
                  General Knowledge Base
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {}}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
              style={{ color: '#6b7280' }}
              title="Maximize"
            >
              <Maximize2 size={18} />
            </button>
            
            <button
              onClick={() => navigate("/")}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition"
              style={{ color: '#6b7280' }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Chat Messages Container */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
          style={{ 
            maxHeight: 'calc(85vh - 200px)',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 transparent'
          }}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 relative group ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.sender === "bot" && (
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0" style={{
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  message.sender === "user"
                    ? "text-white"
                    : "bg-white text-gray-800"
                }`}
                style={{
                  background: message.sender === "user" 
                    ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'  // Changed to indigo for better visibility
                    : '#ffffff',
                  boxShadow: message.sender === "user"
                    ? '0 4px 12px rgba(99, 102, 241, 0.3)'
                    : '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                {message.deepResearch && message.googleResults && message.googleResults.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#6b7280',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <Search size={12} />
                      Web Search Results:
                    </div>
                    {message.googleResults.map((result, idx) => (
                      <div key={idx} style={{
                        marginBottom: '8px',
                        padding: '8px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}>
                        <a 
                          href={result.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            color: '#3b82f6',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'block',
                            marginBottom: '4px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {result.title}
                        </a>
                        <p style={{
                          margin: 0,
                          color: '#6b7280',
                          lineHeight: '1.4'
                        }}>
                          {result.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {message.sender === "user" && (
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
              )}
              
              <button
                onClick={() => handleCopyMessage(message.text)}
                className="absolute opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy message"
                style={{
                  bottom: '0px',
                  right: message.sender === "user" ? '0px' : 'calc(25% + 8px)',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  color: message.sender === "user" ? 'rgba(99, 102, 241, 0.6)' : '#9ca3af',
                  padding: 0,
                  boxShadow: 'none',
                  zIndex: 10
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = message.sender === "user" ? 'rgba(99, 102, 241, 0.9)' : '#6b7280';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = message.sender === "user" ? 'rgba(99, 102, 241, 0.6)' : '#9ca3af';
                }}
              >
                <Copy size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white rounded-2xl px-4 py-3" style={{
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Deep Research Toggle */}
        <div style={{
          padding: '12px 20px',
          background: 'linear-gradient(to top, #fafafa 0%, #ffffff 100%)',
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} style={{ color: '#6b7280' }} />
            <span style={{ 
              fontSize: '13px', 
              color: '#6b7280',
              fontWeight: 500
            }}>
              Deep Research
            </span>
            {deepResearch && (
              <span style={{
                fontSize: '11px',
                color: '#10b981',
                background: '#d1fae5',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 500
              }}>
                Active
              </span>
            )}
          </div>
          <label style={{
            position: 'relative',
            display: 'inline-block',
            width: '44px',
            height: '24px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={deepResearch}
              onChange={(e) => setDeepResearch(e.target.checked)}
              style={{
                opacity: 0,
                width: 0,
                height: 0
              }}
            />
            <span style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: deepResearch ? '#3b82f6' : '#cbd5e1',
              borderRadius: '24px',
              transition: 'all 0.3s ease',
              boxShadow: deepResearch 
                ? '0 2px 8px rgba(59, 130, 246, 0.3)'
                : 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '18px',
                width: '18px',
                left: deepResearch ? '22px' : '3px',
                bottom: '3px',
                background: 'white',
                borderRadius: '50%',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
              }} />
            </span>
          </label>
        </div>

        {/* Input Form with Gradient Border */}
        <form
          onSubmit={handleSendMessage}
          className="p-4"
          style={{
            borderTop: '1px solid rgba(0, 0, 0, 0.05)'
          }}
        >
          <div className="relative">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Where do you want to go?"
              className="w-full px-4 py-3 pr-12 rounded-2xl focus:outline-none text-gray-700 placeholder-gray-400"
              style={{
                background: '#ffffff',
                border: '2px solid transparent',
                backgroundImage: 'linear-gradient(#ffffff, #ffffff), linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
              }}
              disabled={isLoading}
            />
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
              <Wand2 
                size={18} 
                style={{ 
                  color: '#3b82f6',
                  filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))'
                }} 
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  background: isLoading || !inputMessage.trim() 
                    ? '#cbd5e1' 
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isLoading || !inputMessage.trim() ? 0.5 : 1,
                  cursor: isLoading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isLoading || !inputMessage.trim() 
                    ? 'none'
                    : '0 4px 12px rgba(59, 130, 246, 0.4)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && inputMessage.trim()) {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = isLoading || !inputMessage.trim() 
                    ? 'none'
                    : '0 4px 12px rgba(59, 130, 246, 0.4)';
                }}
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="white" 
                  strokeWidth="4" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{ 
                    display: 'block',
                    flexShrink: 0,
                    filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))'
                  }}
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Add pulse animation for robot eyes */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}

