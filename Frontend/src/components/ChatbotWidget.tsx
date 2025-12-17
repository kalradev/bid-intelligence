import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { Bot, User, X, Wand2, MessageCircle, Search, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Message {
  text: string;
  sender: "user" | "bot";
  timestamp: string;
  deepResearch?: boolean;
  googleResults?: Array<{title: string; snippet: string; link: string}>;
  sourcePages?: string[]; // Page numbers where the answer came from
}

export default function ChatbotWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
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
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const chatButtonRef = useRef<HTMLButtonElement>(null);

  // Get current document ID from localStorage or URL params
  useEffect(() => {
    // Check if there's a recent RFP analysis with fileHash
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

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Silent fail - no notification
    });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Check if click is outside the chat window
      if (
        chatWindowRef.current &&
        !chatWindowRef.current.contains(target) &&
        // Also check if it's not the button (if button exists)
        (!chatButtonRef.current || !chatButtonRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };

    // Add event listener with a small delay to prevent immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getTimeStamp = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      }

      const response = await fetch("http://localhost:8080/get", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // Handle network errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || "Failed to get response from chatbot" };
        }
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle response data
      let answerText = "";
      if (typeof data === "string") {
        answerText = data;
      } else if (data.answer) {
        answerText = data.answer;
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        answerText = JSON.stringify(data);
      }

      const botMessage: Message = {
        text: answerText,
        sender: "bot",
        timestamp: getTimeStamp(),
        deepResearch: data.deepResearch || false,
        googleResults: data.googleResults || [],
        sourcePages: data.sourcePages || []
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error: any) {
      console.error("Chatbot error:", error);
      
      // Check if it's a network error (server not running)
      const isNetworkError = error.message?.includes("Failed to fetch") || 
                            error.message?.includes("NetworkError") ||
                            error.name === "TypeError";
      
      const errorText = isNetworkError
        ? "⚠️ Cannot connect to the chatbot server. Please make sure the Flask server is running on port 8080.\n\nTo start the server, run:\ncd \"C:\\Users\\ASUS\\Downloads\\Chatbot GRC 3\\Build_chat\"\npy -3.10 app.py"
        : `Sorry, I encountered an error: ${error.message || "Unknown error"}`;
      
      toast.error(isNetworkError 
        ? "Chatbot server is not running. Please start the Flask server."
        : "Failed to get response from chatbot.", {
        duration: 5000,
        position: "bottom-right",
      });
      
      const errorMessage: Message = {
        text: errorText,
        sender: "bot",
        timestamp: getTimeStamp(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const widgetContent = (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          ref={chatButtonRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4), 0 0 0 0 rgba(59, 130, 246, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.4), 0 0 0 0 rgba(59, 130, 246, 0.5)';
          }}
          title="Open Chatbot"
        >
          <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.5} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <>
          {/* Backdrop overlay - invisible but clickable */}
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
              background: 'transparent',
              cursor: 'default'
            }}
          />
          <div
            ref={chatWindowRef}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 9999,
              width: '400px',
              height: '650px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(to bottom, #ffffff 0%, #fafafa 50%, #fef3f7 100%)',
              borderRadius: '24px',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden',
              animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
          {/* Professional Header */}
          <div style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Robot Avatar */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                position: 'relative'
              }}>
                {/* Robot Face */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: '#ffffff',
                  borderRadius: '50%',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
                }}>
                  {/* Blue Visor */}
                  <div style={{
                    width: '28px',
                    height: '16px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    borderRadius: '14px 14px 5px 5px',
                    position: 'relative',
                    top: '-3px',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)'
                  }}>
                    {/* Glowing Eyes */}
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      left: '7px',
                      width: '5px',
                      height: '5px',
                      background: '#60a5fa',
                      borderRadius: '50%',
                      boxShadow: '0 0 6px rgba(96, 165, 250, 0.9), 0 0 12px rgba(96, 165, 250, 0.6)',
                      animation: 'pulse 2s ease-in-out infinite'
                    }}></div>
                    <div style={{
                      position: 'absolute',
                      top: '5px',
                      right: '7px',
                      width: '5px',
                      height: '5px',
                      background: '#60a5fa',
                      borderRadius: '50%',
                      boxShadow: '0 0 6px rgba(96, 165, 250, 0.9), 0 0 12px rgba(96, 165, 250, 0.6)',
                      animation: 'pulse 2s ease-in-out infinite'
                    }}></div>
                  </div>
                  {/* Robot Ears */}
                  <div style={{
                    position: 'absolute',
                    left: '-5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '8px',
                    height: '14px',
                    background: '#3b82f6',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)'
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    right: '-5px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '8px',
                    height: '14px',
                    background: '#3b82f6',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)'
                  }}></div>
                </div>
              </div>
              
              {/* Name and Status */}
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#1f2937',
                  lineHeight: '1.2',
                  marginBottom: '2px'
                }}>
                  Piko
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#10b981',
                    boxShadow: '0 0 6px rgba(16, 185, 129, 0.5)'
                  }}></div>
                  <p style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#6b7280',
                    fontWeight: 400
                  }}>
                    Online
                  </p>
                </div>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#6b7280',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#6b7280';
              }}
              title="Close"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Chat Messages Container */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'transparent'
            }}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className="group relative"
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  justifyContent: message.sender === "user" ? "flex-end" : "flex-start",
                  flexDirection: message.sender === "user" ? "row-reverse" : "row"
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: message.sender === "user" 
                    ? 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)'
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: message.sender === "user"
                    ? '0 2px 4px rgba(0, 0, 0, 0.1)'
                    : '0 2px 8px rgba(59, 130, 246, 0.3)'
                }}>
                  {message.sender === "bot" ? (
                    <Bot className="w-4 h-4 text-white" strokeWidth={2.5} />
                  ) : (
                    <User className="w-4 h-4 text-gray-600" strokeWidth={2.5} />
                  )}
                </div>
                
                {/* Message Bubble */}
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '12px 16px',
                    borderRadius: message.sender === "user" ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: message.sender === "user" 
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'  // Changed to indigo for better visibility
                      : '#ffffff',
                    color: message.sender === "user" ? '#ffffff' : '#1f2937',
                    boxShadow: message.sender === "user"
                      ? '0 4px 12px rgba(99, 102, 241, 0.3)'
                      : '0 2px 8px rgba(0, 0, 0, 0.08)',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    wordWrap: 'break-word'
                  }}
                >
                  <p style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontWeight: message.sender === "user" ? 400 : 400
                  }}>
                    {message.text}
                  </p>
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
              <div style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                }}>
                  <Bot className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  background: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#9ca3af',
                      animation: 'bounce 1.4s ease-in-out infinite'
                    }}></div>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#9ca3af',
                      animation: 'bounce 1.4s ease-in-out infinite',
                      animationDelay: '0.2s'
                    }}></div>
                    <div style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#9ca3af',
                      animation: 'bounce 1.4s ease-in-out infinite',
                      animationDelay: '0.4s'
                    }}></div>
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

          {/* Professional Input Form */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '16px 20px',
              background: 'linear-gradient(to top, #ffffff 0%, #fafafa 100%)',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)'
            }}
          >
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px 100px 12px 16px',
                  borderRadius: '16px',
                  border: '2px solid transparent',
                  background: '#ffffff',
                  fontSize: '14px',
                  color: '#1f2937',
                  outline: 'none',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  backgroundImage: 'linear-gradient(#ffffff, #ffffff), linear-gradient(135deg, #3b82f6 0%, #a855f7 100%)',
                  backgroundOrigin: 'border-box',
                  backgroundClip: 'padding-box, border-box',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
              />
              <div style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Wand2 
                  size={16} 
                  style={{ 
                    color: '#3b82f6',
                    opacity: 0.7
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
                      ? '#e5e7eb' 
                      : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
        </>
      )}

      {/* Professional Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
        @keyframes bounce {
          0%, 80%, 100% {
            transform: translateY(0);
            opacity: 0.7;
          }
          40% {
            transform: translateY(-6px);
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        /* Custom Scrollbar */
        div::-webkit-scrollbar {
          width: 6px;
        }
        div::-webkit-scrollbar-track {
          background: transparent;
        }
        div::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </>
  );

  // Render to document body using portal to ensure correct positioning
  return createPortal(widgetContent, document.body);
}
