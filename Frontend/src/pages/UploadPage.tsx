import { ArrowLeft, LayoutDashboard, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast, { Toaster } from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardNavbar, { NAVBAR_HEIGHT } from "../components/DashboardNavbar";
import { API_BASE_URL } from '../config';

export default function UploadPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

    useEffect(() => {
        const u = localStorage.getItem("user");
        if (u) {
            try {
                const parsed = JSON.parse(u);
                const role = (parsed.role || "").toLowerCase();
                setUserRole(role);
                if (role === "technical_manager") setIsExistingMode(true);
            } catch {
                setUserRole(null);
            }
        } else {
            setUserRole(null);
        }
    }, []);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisTime, setAnalysisTime] = useState(0); // Time in seconds
    const [analysisStage, setAnalysisStage] = useState<string>("");
    const [progressPercent, setProgressPercent] = useState(0);
    const abortControllerRef = useRef<AbortController | null>(null);
    const timerIntervalRef = useRef<number | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const progressIntervalRef = useRef<number | null>(null);

    const [projectName, setProjectName] = useState("");
    const [tenderId, setTenderId] = useState("");
    const [clientName, setClientName] = useState("");
    const [updateType, setUpdateType] = useState("BASE_RFP");
    const [projectExists, setProjectExists] = useState<boolean | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const [hasBaseRfp, setHasBaseRfp] = useState(false);

    const [isExistingMode, setIsExistingMode] = useState(false);
    const [allProjects, setAllProjects] = useState<any[]>([]);
    const [projectSearchTerm, setProjectSearchTerm] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const dropdownPanelRef = useRef<HTMLDivElement | null>(null);
    const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const [teamQuota, setTeamQuota] = useState<{ teamProjectsUsed?: number; teamProjectsLimit?: number; teamProjectsLeft?: number; appliesToTeam?: boolean } | null>(null);

    const [showAssignTMs, setShowAssignTMs] = useState(false);
    const [lastAnalyzedProjectName, setLastAnalyzedProjectName] = useState("");
    const [myTeam, setMyTeam] = useState<{ id: number; fullName: string; email: string; role?: string }[]>([]);
    const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
    const [assignSaving, setAssignSaving] = useState(false);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    console.error("No authentication token found");
                    setAllProjects([]);
                    setTeamQuota(null);
                    return;
                }

                const response = await fetch(`${API_BASE_URL}/api/rfp/projects`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    console.error("Authentication failed");
                    setAllProjects([]);
                    setTeamQuota(null);
                    return;
                }

                const data = await response.json();
                if (data.success) {
                    setAllProjects(data.projects);
                    if (data.teamQuota && data.teamQuota.appliesToTeam) {
                        setTeamQuota(data.teamQuota);
                    } else {
                        setTeamQuota(null);
                    }
                }
            } catch (error) {
                console.error("Error fetching projects:", error);
                setAllProjects([]);
                setTeamQuota(null);
            }
        };
        fetchProjects();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inTrigger = dropdownRef.current?.contains(target);
            const inPanel = dropdownPanelRef.current?.contains(target);
            if (!inTrigger && !inPanel) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Update dropdown position when open (for portal positioning)
    useEffect(() => {
        if (!isDropdownOpen || !dropdownRef.current) {
            setDropdownRect(null);
            return;
        }
        const update = () => {
            if (dropdownRef.current) {
                const rect = dropdownRef.current.getBoundingClientRect();
                setDropdownRect({ top: rect.bottom + 8, left: rect.left, width: rect.width });
            }
        };
        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [isDropdownOpen]);

    // Prevent page scroll when scrolling inside dropdown
    useEffect(() => {
        if (isDropdownOpen) {
            const handleWheel = (e: WheelEvent) => {
                const target = e.target as HTMLElement;
                const scrollableArea = dropdownRef.current?.querySelector('[style*="overflowY"]') as HTMLElement;

                if (scrollableArea && (scrollableArea.contains(target) || scrollableArea === target)) {
                    const { scrollTop, scrollHeight, clientHeight } = scrollableArea;
                    const isAtTop = scrollTop <= 0;
                    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

                    // Only prevent default if we're at the boundaries
                    if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
                        e.preventDefault();
                    }
                    // Always stop propagation to prevent page scroll
                    e.stopPropagation();
                }
            };

            document.addEventListener("wheel", handleWheel, { passive: false });
            return () => {
                document.removeEventListener("wheel", handleWheel);
            };
        }
    }, [isDropdownOpen]);

    // Format date to show actual time and date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isThisYear = date.getFullYear() === now.getFullYear();

        const timeStr = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        if (isToday) {
            // Today: just show time "2:30 PM"
            return timeStr;
        } else if (isThisYear) {
            // This year: "Jan 19, 2:30 PM"
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            }) + ', ' + timeStr;
        } else {
            // Other years: "Jan 19, 2024, 2:30 PM"
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }) + ', ' + timeStr;
        }
    };

    // Filter projects based on search term
    const filteredProjects = allProjects.filter((p: any) =>
        p.project_name.toLowerCase().includes(projectSearchTerm.toLowerCase())
    );

    const checkProjectStatus = async (nameToCheck?: string) => {
        const name = nameToCheck || projectName;
        if (!name.trim()) {
            toast.error("Please enter a project name first");
            return;
        }

        setIsLoadingStatus(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login to check project status");
                setIsLoadingStatus(false);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/rfp/project-status/${encodeURIComponent(name)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error("Status check failed");
            const data = await response.json();

            if (data.exists) {
                setProjectExists(true);
                setTenderId(data.project.tenderId || "");
                setClientName(data.project.clientName || "");
                setHasBaseRfp(data.project.hasBaseRfp);
                setUpdateType(data.project.hasBaseRfp ? "CORRIGENDUM" : "BASE_RFP");
                toast.success(`Project Recognized!`, { icon: '📂', duration: 2000 });
            } else {
                setProjectExists(false);
                setTenderId("");
                setClientName("");
                setHasBaseRfp(false);
                setUpdateType("BASE_RFP");
                if (!isExistingMode) toast.success("New project detected.", { icon: '🆕' });
            }
        } catch (error) {
            console.error("Error checking project status:", error);
            toast.error("Failed to check project status.");
        } finally {
            setIsLoadingStatus(false);
        }
    };

    const handleProjectSelect = (selectedName: string) => {
        console.log("🔵 handleProjectSelect called:", selectedName);
        console.log("   Previous projectName:", projectName);

        if (!selectedName) {
            setProjectName("");
            setProjectExists(null);
            setProjectSearchTerm("");
            setIsDropdownOpen(false);
            return;
        }

        // Clear previous project state when switching to a different project
        setProjectExists(null);
        setTenderId("");
        setClientName("");

        setProjectName(selectedName);
        // Don't set projectSearchTerm - it should only be used for search filtering
        setIsDropdownOpen(false);

        console.log("✅ Project changed to:", selectedName);
        checkProjectStatus(selectedName);
    };

    // Preselected project from TM dashboard "Upload docs" — run once when landing with state
    useEffect(() => {
        const preselected = (location.state as { preselectedProjectName?: string } | null)?.preselectedProjectName;
        if (preselected && preselected.trim()) {
            setProjectName(preselected.trim());
            setIsExistingMode(true);
            setProjectSearchTerm("");
            checkProjectStatus(preselected.trim());
            navigate(location.pathname, { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleResetProject = () => {
        setProjectName("");
        setProjectExists(null);
        setTenderId("");
        setClientName("");
        setHasBaseRfp(false);
        setUpdateType("BASE_RFP");
        setProjectSearchTerm("");
        setIsDropdownOpen(false);
        toast.success("Project selection reset! Choose a new project.", { icon: '🔄', duration: 2000 });
    };



    const handleViewOldAnalysis = async () => {
        if (!projectName) return;
        setIsAnalyzing(true);
        try {
            const { fetchProjectAnalysis, updateAnalysisData } = await import("../utils/documentAnalysis");
            const result = await fetchProjectAnalysis(projectName);
            updateAnalysisData(result, projectName);

            toast.success("Project history loaded! 🚀");
            setTimeout(() => navigate("/insights"), 1000);
        } catch (error: any) {
            toast.error(error.message || "Error loading project history");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files);
        const allowedExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp"];

        const validFiles = newFiles.filter(file => {
            const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
            return allowedExtensions.includes(fileExtension);
        });

        if (validFiles.length < newFiles.length) {
            toast.error("Some files were skipped due to invalid types.");
        }

        if (validFiles.length > 0) {
            setUploadedFiles(prev => [...prev, ...validFiles]);
            toast.success(`Added ${validFiles.length} file(s)`);
        }

        event.target.value = "";
    };

    const removeFile = (index: number) => {
        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsAnalyzing(false);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
            setAnalysisTime(0);
            setAnalysisStage("");
            setProgressPercent(0);
            startTimeRef.current = null;
            toast.success("Analysis cancelled");
        }
    };

    // Format time in a user-friendly way
    const formatTime = (seconds: number): string => {
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (remainingSeconds === 0) {
            return `${minutes}m`;
        }
        return `${minutes}m ${remainingSeconds}s`;
    };

    const handleAnalyze = async () => {
        if (!projectName) {
            toast.error("Project Name is mandatory!");
            return;
        }

        // Check quota only for NEW projects (not for updating existing ones)
        if (projectExists === false && teamQuota && teamQuota.appliesToTeam && teamQuota.teamProjectsLeft === 0) {
            toast.error(`Your team has reached the limit of ${teamQuota.teamProjectsLimit} projects. Please contact your Bid Manager to delete old projects or increase quota.`);
            return;
        }

        if (updateType === "BASE_RFP" && (!tenderId || !clientName)) {
            toast.error("Tender ID and Client Name are mandatory for a new Base RFP!");
            return;
        }
        if (uploadedFiles.length === 0) {
            toast.error("Please upload at least one file!");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisTime(0);
        setProgressPercent(0);
        setAnalysisStage("Initializing analysis...");
        startTimeRef.current = Date.now();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        // Analysis stages with estimated progress
        const stages = [
            { stage: "Uploading files...", progress: 5 },
            { stage: "Extracting text from documents...", progress: 20 },
            { stage: "Processing document content...", progress: 35 },
            { stage: "Analyzing with AI...", progress: 50 },
            { stage: "Extracting key information...", progress: 65 },
            { stage: "Mapping products and OEMs...", progress: 80 },
            { stage: "Generating summaries...", progress: 90 },
            { stage: "Finalizing analysis...", progress: 95 }
        ];

        let currentStageIndex = 0;

        // Start timer
        timerIntervalRef.current = setInterval(() => {
            if (startTimeRef.current) {
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setAnalysisTime(elapsed);
            }
        }, 1000);

        // Simulate progress through stages
        const updateProgress = () => {
            if (currentStageIndex < stages.length) {
                setAnalysisStage(stages[currentStageIndex].stage);
                setProgressPercent(stages[currentStageIndex].progress);
                currentStageIndex++;
            }
        };

        // Initial stage
        updateProgress();

        // Update stages every 3-5 seconds (simulated, actual progress will vary)
        progressIntervalRef.current = setInterval(() => {
            if (currentStageIndex < stages.length) {
                updateProgress();
            } else {
                // Keep at 95% until actual completion
                setProgressPercent(95);
                setAnalysisStage("Almost done...");
            }
        }, 4000);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error("Please login to analyze documents");
                setIsAnalyzing(false);
                return;
            }

            const formData = new FormData();
            uploadedFiles.forEach(file => formData.append("files", file));
            formData.append("project_name", projectName);
            formData.append("tender_id", tenderId);
            formData.append("client_name", clientName);
            formData.append("update_type", updateType);

            const response = await fetch(`${API_BASE_URL}/api/rfp/analyze`, {
                method: "POST",
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
                signal: signal,
            });

            if (signal.aborted) return;
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || errorData.message || "API request failed");
            }

            const result = await response.json();
            localStorage.setItem("analysisData", JSON.stringify(result));
            if (result.data && result.data.fileHash) {
                const documentInfo = {
                    fileHash: result.data.fileHash,
                    fileName: result.data.fileName || uploadedFiles[0].name,
                    projectName: projectName
                };
                localStorage.setItem("recentRfpAnalysis", JSON.stringify(documentInfo));
                localStorage.setItem("currentDocument", JSON.stringify(documentInfo));
            }

            const totalTime = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : analysisTime;
            setProgressPercent(100);
            setAnalysisStage("Analysis complete!");
            toast.success(`Analysis complete! (${formatTime(totalTime)})`, { duration: 3000 });
            const userStr = localStorage.getItem("user");
            const role = (userStr ? (JSON.parse(userStr).role || "") : "").toString().toLowerCase();
            if (projectName && role === "bid_manager") {
                setLastAnalyzedProjectName(projectName);
                setShowAssignTMs(true);
                const token = localStorage.getItem("token");
                if (token) {
                    try {
                        const [assignRes, teamRes] = await Promise.all([
                            fetch(`${API_BASE_URL}/api/rfp/project-assignments/${encodeURIComponent(projectName)}`, { headers: { Authorization: `Bearer ${token}` } }),
                            fetch(`${API_BASE_URL}/api/auth/my-team`, { headers: { Authorization: `Bearer ${token}` } })
                        ]);
                        if (assignRes.ok) {
                            const assignData = await assignRes.json();
                            setAssignedUserIds(assignData.assignedUserIds || []);
                        }
                        if (teamRes.ok) {
                            const teamData = await teamRes.json();
                            const list = teamData.team || teamData.technicalManagers || teamData.members || [];
                            setMyTeam((Array.isArray(list) ? list : []).map((m: any) => ({ id: m.id, fullName: m.fullName || m.full_name, email: m.email, role: m.role })));
                        }
                    } catch (e) {
                        console.error("Failed to load team/assignments", e);
                    }
                }
            } else {
                setTimeout(() => navigate("/insights"), 1500);
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
                if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                }
                setAnalysisTime(0);
                setAnalysisStage("");
                setProgressPercent(0);
                startTimeRef.current = null;
                return;
            }
            setAnalysisStage("Analysis failed");
            toast.error(error.message || "Failed to analyze RFP.");
        } finally {
            setIsAnalyzing(false);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
            }
            startTimeRef.current = null;
            abortControllerRef.current = null;
        }
    };

    return (
        <div className="universal-page-wrapper">
            <DashboardNavbar />

            <div className="universal-background">
                <div className="universal-bg-gradient-1"></div>
                <div className="universal-bg-gradient-2"></div>
                <div className="universal-bg-gradient-3"></div>
            </div>

            <div className="min-h-screen py-12" style={{ position: "relative", zIndex: 1, paddingTop: NAVBAR_HEIGHT + 24 }}>
                <Toaster />

                <div className="upload-container">
                    {showAssignTMs && lastAnalyzedProjectName && (
                        <div style={{
                            marginBottom: "24px",
                            padding: "24px",
                            borderRadius: "20px",
                            background: "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(250,243,225,0.5) 100%)",
                            border: "1px solid rgba(255,143,143,0.4)",
                            boxShadow: "0 4px 0 rgba(255,143,143,0.2), 0 1px 0 rgba(255,255,255,0.8) inset, 0 20px 40px rgba(0,0,0,0.06)"
                        }}>
                            <h3 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#3d4a2c" }}>
                                Assign Technical Managers to “{lastAnalyzedProjectName}”
                            </h3>
                            <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#64748b" }}>
                                Optional: assign Technical Managers who can upload corrigendum and reference documents. You can also add TMs to your team and assign them to this project later from your dashboard.
                            </p>
                            {myTeam.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                                    {myTeam.map((m) => (
                                        <label key={m.id} style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "10px 14px", borderRadius: "12px", background: assignedUserIds.includes(m.id) ? "rgba(99, 102, 241, 0.1)" : "transparent", border: `1px solid ${assignedUserIds.includes(m.id) ? "rgba(99, 102, 241, 0.3)" : "rgba(0,0,0,0.06)"}` }}>
                                            <input
                                                type="checkbox"
                                                checked={assignedUserIds.includes(m.id)}
                                                onChange={() => setAssignedUserIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                                            />
                                            <span style={{ fontWeight: 600, color: "#1e293b" }}>{m.fullName}</span>
                                            <span style={{ fontSize: "13px", color: "#64748b" }}>{m.email}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#64748b" }}>
                                    Add Technical Managers from <strong>Manage Teams</strong>, then assign them to this or any analysed project from your dashboard.
                                </p>
                            )}
                            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                                {myTeam.length > 0 && (
                                    <button
                                        disabled={assignSaving}
                                        onClick={async () => {
                                            setAssignSaving(true);
                                            try {
                                                const token = localStorage.getItem("token");
                                                if (!token) return;
                                                const res = await fetch(`${API_BASE_URL}/api/rfp/project-assignments/${encodeURIComponent(lastAnalyzedProjectName)}`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                                    body: JSON.stringify({ userIds: assignedUserIds })
                                                });
                                                if (!res.ok) throw new Error((await res.json()).detail || "Failed to save");
                                                toast.success("Assignments saved.");
                                            } catch (e: any) {
                                                toast.error(e.message || "Failed to save assignments");
                                            } finally {
                                                setAssignSaving(false);
                                            }
                                        }}
                                        style={{ padding: "12px 20px", borderRadius: "12px", fontWeight: 700, background: "linear-gradient(180deg, #FF8F8F 0%, #E87878 100%)", color: "#fff", border: "none", cursor: assignSaving ? "wait" : "pointer", boxShadow: "0 4px 0 rgba(232,120,120,0.35)" }}
                                    >
                                        {assignSaving ? "Saving…" : "Save assignments"}
                                    </button>
                                )}
                                <button
                                    onClick={() => { setShowAssignTMs(false); setLastAnalyzedProjectName(""); navigate("/insights"); }}
                                    style={{ padding: "12px 20px", borderRadius: "12px", fontWeight: 700, background: "rgba(255,179,179,0.4)", color: "#5a6344", border: "2px solid rgba(255,143,143,0.5)", cursor: "pointer" }}
                                >
                                    View results
                                </button>
                                <button
                                    onClick={() => { setShowAssignTMs(false); setLastAnalyzedProjectName(""); }}
                                    style={{ padding: "12px 20px", borderRadius: "12px", fontWeight: 600, background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer" }}
                                >
                                    Skip for now
                                </button>
                            </div>
                        </div>
                    )}

                    <h1 className="upload-title">Bid Preparation & Analysis</h1>

                    {/* Enhanced Toggle — palette + 3D */}
                    <div style={{
                        display: "flex",
                        background: "linear-gradient(135deg, rgba(234,239,239,0.9) 0%, rgba(250,243,225,0.8) 100%)",
                        backdropFilter: "blur(12px)",
                        padding: "6px",
                        borderRadius: "16px",
                        marginBottom: "24px",
                        boxShadow: "0 4px 0 rgba(255,143,143,0.2), inset 0 1px 0 rgba(255,255,255,0.7), 0 8px 20px rgba(0,0,0,0.06)",
                        border: "1px solid rgba(255,143,143,0.35)"
                    }}>
                        {(userRole || "").toLowerCase() !== "technical_manager" && (
                            <button
                                onClick={() => { setIsExistingMode(false); setProjectExists(null); setProjectName(""); setTenderId(""); setClientName(""); setProjectSearchTerm(""); setIsDropdownOpen(false); }}
                                onMouseEnter={(e) => {
                                    if (!isExistingMode) {
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                        e.currentTarget.style.boxShadow = "0 6px 16px rgba(255,143,143,0.45)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = !isExistingMode ? "0 4px 0 rgba(255,143,143,0.3), 0 4px 12px rgba(255,143,143,0.2)" : "none";
                                }}
                                style={{
                                    flex: 1,
                                    padding: "13px",
                                    borderRadius: "12px",
                                    border: "none",
                                    background: !isExistingMode ? "linear-gradient(180deg, #FF8F8F 0%, #E87878 100%)" : "transparent",
                                    color: !isExistingMode ? "#fff" : "#5a6344",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                    fontSize: "14px",
                                    boxShadow: !isExistingMode ? "0 4px 0 rgba(232,120,120,0.4), 0 4px 12px rgba(255,143,143,0.2)" : "none",
                                    letterSpacing: "0.3px"
                                }}
                            >
                                🆕 New Project
                            </button>
                        )}
                        <button
                            onClick={() => { setIsExistingMode(true); setProjectExists(null); setProjectName(""); setTenderId(""); setClientName(""); setProjectSearchTerm(""); setIsDropdownOpen(false); }}
                            onMouseEnter={(e) => {
                                if (isExistingMode) {
                                    e.currentTarget.style.transform = "translateY(-2px)";
                                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(255,179,179,0.5)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = isExistingMode ? "0 4px 0 rgba(255,143,143,0.35), 0 4px 12px rgba(255,179,179,0.25)" : "none";
                            }}
                            style={{
                                flex: 1,
                                padding: "13px",
                                borderRadius: "12px",
                                border: "none",
                                background: isExistingMode ? "linear-gradient(180deg, #FFB3B3 0%, #FF8F8F 100%)" : "transparent",
                                color: isExistingMode ? "#fff" : "#5a6344",
                                fontWeight: "700",
                                cursor: "pointer",
                                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                fontSize: "14px",
                                boxShadow: isExistingMode ? "0 4px 0 rgba(232,120,120,0.35), 0 4px 12px rgba(255,179,179,0.2)" : "none",
                                letterSpacing: "0.3px"
                            }}
                        >
                            📂 Select Existing
                        </button>
                    </div>

                    {/* Enhanced Form Container — visible border + 3D */}
                    <div style={{
                        width: "100%",
                        background: "linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(250,243,225,0.6) 50%, rgba(234,239,239,0.6) 100%)",
                        backdropFilter: "blur(20px)",
                        padding: "28px",
                        borderRadius: "20px",
                        border: "2px solid rgba(255,143,143,0.65)",
                        marginBottom: "24px",
                        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.04), 0 4px 0 rgba(255,143,143,0.25), 0 12px 28px rgba(0,0,0,0.06)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "22px"
                    }}>
                        <h3 style={{ margin: 0, fontSize: "18px", color: "#3d4a2c", fontWeight: "700" }}>
                            {isExistingMode ? "Existing Project Selection" : "Define New Project"}
                        </h3>

                        {!isExistingMode && teamQuota && teamQuota.appliesToTeam && (
                            <div style={{ padding: "12px 16px", borderRadius: "12px", background: teamQuota.teamProjectsLeft === 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(79, 70, 229, 0.08)", border: `1px solid ${teamQuota.teamProjectsLeft === 0 ? "rgba(239, 68, 68, 0.3)" : "rgba(79, 70, 229, 0.2)"}`, fontSize: "14px", color: "#374151" }}>
                                <strong>Team quota:</strong> {teamQuota.teamProjectsUsed} / {teamQuota.teamProjectsLimit} used — <strong>{teamQuota.teamProjectsLeft} left</strong>
                            </div>
                        )}

                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#5a6344", letterSpacing: "0.3px" }}>
                                        {isExistingMode ? "Search and Select Project *" : "Project Name *"}
                                    </label>
                                    {isExistingMode && projectName && (
                                        <button
                                            onClick={handleResetProject}
                                            title="Reset project selection"
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                color: "#6366f1",
                                                cursor: "pointer",
                                                padding: "4px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "6px",
                                                transition: "all 0.2s ease"
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.background = "rgba(99, 102, 241, 0.1)";
                                                e.currentTarget.style.color = "#4f46e5";
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.background = "transparent";
                                                e.currentTarget.style.color = "#6366f1";
                                            }}
                                        >
                                            <RefreshCw size={16} />
                                        </button>
                                    )}
                                </div>

                                {isExistingMode ? (
                                    <>
                                        {/* Backdrop overlay when dropdown is open */}
                                        {isDropdownOpen && (
                                            <div
                                                onClick={() => setIsDropdownOpen(false)}
                                                style={{
                                                    position: "fixed",
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    background: "transparent",
                                                    zIndex: 99998,
                                                    cursor: "pointer"
                                                }}
                                            />
                                        )}
                                        <div ref={dropdownRef} style={{ position: "relative", width: "100%", zIndex: 1 }}>
                                            <div
                                                onClick={() => {
                                                    if (!isDropdownOpen) {
                                                        // When opening, clear search to allow fresh search
                                                        setProjectSearchTerm("");
                                                    }
                                                    setIsDropdownOpen(!isDropdownOpen);
                                                }}
                                                style={{
                                                    width: "100%",
                                                    padding: "14px 16px",
                                                    paddingRight: "45px",
                                                    borderRadius: "12px",
                                                    border: "2px solid rgba(99, 102, 241, 0.3)",
                                                    background: "#ffffff",
                                                    fontSize: "15px",
                                                    color: projectName ? "#111827" : "#9ca3af",
                                                    transition: "all 0.3s ease",
                                                    boxShadow: "0 2px 8px rgba(99, 102, 241, 0.08)",
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    minHeight: "48px",
                                                    position: "relative",
                                                    zIndex: 1
                                                }}
                                            >
                                                {projectName || "-- Click to choose from your projects --"}
                                            </div>
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    right: "12px",
                                                    top: "50%",
                                                    transform: isDropdownOpen ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                                                    transition: "transform 0.3s ease",
                                                    color: "#6b7280",
                                                    fontSize: "12px",
                                                    pointerEvents: "none",
                                                    zIndex: 2
                                                }}
                                            >
                                                ▼
                                            </div>
                                            {isDropdownOpen && dropdownRect && createPortal(
                                                <div
                                                    ref={(el) => { dropdownPanelRef.current = el; }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onWheel={(e) => {
                                                        const target = e.currentTarget;
                                                        const scrollableArea = target.querySelector('[style*="overflowY"]') as HTMLElement;
                                                        if (scrollableArea && scrollableArea.contains(e.target as Node)) {
                                                            e.stopPropagation();
                                                        }
                                                    }}
                                                    onTouchMove={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                    style={{
                                                        position: "fixed",
                                                        top: dropdownRect.top,
                                                        left: dropdownRect.left,
                                                        width: dropdownRect.width,
                                                        borderRadius: "12px",
                                                        border: "2px solid rgba(99, 102, 241, 0.3)",
                                                        background: "#ffffff",
                                                        backgroundColor: "#ffffff",
                                                        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                                                        zIndex: 99999,
                                                        overflow: "hidden",
                                                        maxHeight: "400px",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        isolation: "isolate",
                                                        touchAction: "pan-y"
                                                    }}
                                                >
                                                    {/* Search Input */}
                                                    <div style={{
                                                        padding: "12px",
                                                        borderBottom: "1px solid rgba(99, 102, 241, 0.1)",
                                                        position: "relative",
                                                        background: "#ffffff",
                                                        backgroundColor: "#ffffff",
                                                        zIndex: 1
                                                    }}>
                                                        <input
                                                            type="text"
                                                            placeholder="🔍 Search projects..."
                                                            value={projectSearchTerm}
                                                            onChange={(e) => {
                                                                setProjectSearchTerm(e.target.value);
                                                                setIsDropdownOpen(true);
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onFocus={(e) => {
                                                                e.stopPropagation();
                                                                setIsDropdownOpen(true);
                                                                e.currentTarget.style.borderColor = "#6366f1";
                                                            }}
                                                            onBlur={(e) => {
                                                                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.2)";
                                                            }}
                                                            style={{
                                                                width: "100%",
                                                                padding: "10px 12px",
                                                                paddingRight: projectSearchTerm ? "35px" : "12px",
                                                                borderRadius: "8px",
                                                                border: "1px solid rgba(99, 102, 241, 0.2)",
                                                                fontSize: "14px",
                                                                outline: "none",
                                                                transition: "all 0.2s ease"
                                                            }}
                                                        />
                                                        {projectSearchTerm && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setProjectSearchTerm("");
                                                                }}
                                                                style={{
                                                                    position: "absolute",
                                                                    right: "20px",
                                                                    top: "50%",
                                                                    transform: "translateY(-50%)",
                                                                    background: "transparent",
                                                                    border: "none",
                                                                    cursor: "pointer",
                                                                    fontSize: "18px",
                                                                    color: "#9ca3af",
                                                                    padding: "4px",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    transition: "color 0.2s ease"
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.color = "#6366f1";
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.color = "#9ca3af";
                                                                }}
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                    {/* Project List */}
                                                    <div
                                                        onWheel={(e) => {
                                                            e.stopPropagation();
                                                            const element = e.currentTarget;
                                                            const { scrollTop, scrollHeight, clientHeight } = element;
                                                            const isAtTop = scrollTop === 0;
                                                            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

                                                            if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
                                                                e.preventDefault();
                                                            }
                                                        }}
                                                        onTouchMove={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                        style={{
                                                            maxHeight: "320px",
                                                            overflowY: "auto",
                                                            overflowX: "hidden",
                                                            background: "#ffffff",
                                                            backgroundColor: "#ffffff",
                                                            position: "relative",
                                                            zIndex: 1,
                                                            WebkitOverflowScrolling: "touch",
                                                            touchAction: "pan-y",
                                                            overscrollBehavior: "contain"
                                                        }}
                                                    >
                                                        {filteredProjects.length > 0 ? (
                                                            filteredProjects.map((p: any) => (
                                                                <div
                                                                    key={p.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        console.log("🟢 Project item clicked:", p.project_name);
                                                                        handleProjectSelect(p.project_name);
                                                                    }}
                                                                    style={{
                                                                        padding: "12px 16px",
                                                                        cursor: "pointer",
                                                                        fontSize: "14px",
                                                                        color: "#111827",
                                                                        transition: "all 0.2s ease",
                                                                        borderBottom: "1px solid rgba(99, 102, 241, 0.05)",
                                                                        backgroundColor: projectName === p.project_name ? "rgba(99, 102, 241, 0.12)" : "#ffffff",
                                                                        display: "flex",
                                                                        justifyContent: "space-between",
                                                                        alignItems: "center",
                                                                        gap: "12px"
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        if (projectName !== p.project_name) {
                                                                            e.currentTarget.style.backgroundColor = "rgba(99, 102, 241, 0.08)";
                                                                        }
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        if (projectName !== p.project_name) {
                                                                            e.currentTarget.style.backgroundColor = "#ffffff";
                                                                        }
                                                                    }}
                                                                >
                                                                    <span style={{ flex: 1, fontWeight: "500" }}>{p.project_name}</span>
                                                                    <span style={{
                                                                        fontSize: "11px",
                                                                        color: "#6b7280",
                                                                        whiteSpace: "nowrap",
                                                                        fontWeight: "400"
                                                                    }}>
                                                                        {p.created_at ? formatDate(p.created_at) : ''}
                                                                    </span>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div
                                                                style={{
                                                                    padding: "20px 16px",
                                                                    textAlign: "center",
                                                                    color: "#9ca3af",
                                                                    fontSize: "14px",
                                                                    background: "#ffffff",
                                                                    position: "relative",
                                                                    zIndex: 1
                                                                }}
                                                            >
                                                                No projects found matching "{projectSearchTerm}"
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Footer with count */}
                                                    {filteredProjects.length > 0 && (
                                                        <div
                                                            style={{
                                                                padding: "8px 16px",
                                                                borderTop: "1px solid rgba(99, 102, 241, 0.1)",
                                                                fontSize: "12px",
                                                                color: "#6b7280",
                                                                background: "#f9fafb",
                                                                backgroundColor: "#f9fafb",
                                                                position: "relative",
                                                                zIndex: 1
                                                            }}
                                                        >
                                                            Showing {filteredProjects.length} of {allProjects.length} projects
                                                        </div>
                                                    )}
                                                </div>,
                                                document.body
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ position: "relative" }}>
                                        <input
                                            type="text"
                                            placeholder="e.g. Smart City Surveillance 2024"
                                            value={projectName}
                                            onChange={(e) => {
                                                setProjectName(e.target.value);
                                                if (projectExists !== null) setProjectExists(null);
                                            }}
                                            onFocus={(e) => e.currentTarget.style.borderColor = "#6366f1"}
                                            onBlur={(e) => e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.3)"}
                                            style={{
                                                width: "100%",
                                                padding: "14px 16px",
                                                borderRadius: "12px",
                                                border: "2px solid rgba(99, 102, 241, 0.3)",
                                                background: "rgba(255,255,255,0.95)",
                                                fontSize: "15px",
                                                outline: projectExists ? "2px solid #10b981" : "none",
                                                color: "#111827",
                                                transition: "all 0.3s ease",
                                                boxShadow: "0 2px 8px rgba(99, 102, 241, 0.08)"
                                            }}
                                        />
                                        {isLoadingStatus && (
                                            <div style={{ position: "absolute", right: "14px", top: "14px" }}>
                                                <div style={{ width: "20px", height: "20px", border: "2px solid #e5e7eb", borderTop: "2px solid #6366f1", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Status Messages */}
                                {projectExists === false && !isExistingMode && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#2563eb", background: "linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(59,130,246,0.1) 100%)", padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(37,99,235,0.25)", boxShadow: "0 2px 8px rgba(37,99,235,0.1)" }}>
                                        <span style={{ fontSize: "18px" }}>🆕</span>
                                        <span style={{ fontSize: "12px", fontWeight: "600" }}>Brand new project detected. Upload a Base RFP to begin analysis.</span>
                                    </div>
                                )}
                                {projectExists === true && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#059669", background: "linear-gradient(135deg, rgba(5,150,105,0.1) 0%, rgba(16,185,129,0.1) 100%)", padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(5,150,105,0.25)", boxShadow: "0 2px 8px rgba(5,150,105,0.1)" }}>
                                        <span style={{ fontSize: "18px" }}>✅</span>
                                        <span style={{ fontSize: "12px", fontWeight: "600" }}>Project Linked! You are in Update Mode (Corrigendum/Reference Updates).</span>
                                    </div>
                                )}

                                {!isExistingMode && projectExists === null && projectName.trim() && (
                                    <button
                                        onClick={() => checkProjectStatus()}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = "translateY(-2px)";
                                            e.currentTarget.style.boxShadow = "0 8px 24px rgba(99, 102, 241, 0.5)";
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = "translateY(0)";
                                            e.currentTarget.style.boxShadow = "0 4px 16px rgba(99, 102, 241, 0.4)";
                                        }}
                                        style={{
                                            marginTop: "8px",
                                            padding: "14px 20px",
                                            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: "12px",
                                            fontSize: "14px",
                                            fontWeight: "700",
                                            cursor: "pointer",
                                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                            boxShadow: "0 4px 16px rgba(99, 102, 241, 0.4)",
                                            letterSpacing: "0.3px"
                                        }}
                                    >
                                        ✨ Confirm Project Name
                                    </button>
                                )}
                            </div>

                            {projectExists !== null && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "18px", animation: "fadeIn 0.5s ease-out" }}>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                            <label style={{ fontSize: "12px", fontWeight: "600", color: "#6366f1" }}>Tender Reference ID</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. T-2024/G-05"
                                                value={tenderId}
                                                onChange={(e) => setTenderId(e.target.value)}
                                                readOnly={projectExists === true}
                                                onFocus={(e) => !projectExists && (e.currentTarget.style.borderColor = "#8b5cf6")}
                                                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.25)")}
                                                style={{
                                                    padding: "12px 14px",
                                                    borderRadius: "10px",
                                                    border: "2px solid rgba(99, 102, 241, 0.25)",
                                                    background: projectExists ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.95)",
                                                    fontSize: "14px",
                                                    color: projectExists ? "#6b7280" : "#111827",
                                                    transition: "all 0.3s ease",
                                                    boxShadow: "0 2px 6px rgba(99, 102, 241, 0.06)"
                                                }}
                                            />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                            <label style={{ fontSize: "12px", fontWeight: "600", color: "#6366f1" }}>Customer / Client</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. State Highway Dept"
                                                value={clientName}
                                                onChange={(e) => setClientName(e.target.value)}
                                                readOnly={projectExists === true}
                                                onFocus={(e) => !projectExists && (e.currentTarget.style.borderColor = "#8b5cf6")}
                                                onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.25)")}
                                                style={{
                                                    padding: "12px 14px",
                                                    borderRadius: "10px",
                                                    border: "2px solid rgba(99, 102, 241, 0.25)",
                                                    background: projectExists ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.95)",
                                                    fontSize: "14px",
                                                    color: projectExists ? "#6b7280" : "#111827",
                                                    transition: "all 0.3s ease",
                                                    boxShadow: "0 2px 6px rgba(99, 102, 241, 0.06)"
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {projectExists === true && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                            <label style={{ fontSize: "12px", fontWeight: "600", color: "#6366f1" }}>Update Classification</label>
                                            <select
                                                value={updateType}
                                                onChange={(e) => setUpdateType(e.target.value)}
                                                onFocus={(e) => e.currentTarget.style.borderColor = "#8b5cf6"}
                                                onBlur={(e) => e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.3)"}
                                                style={{
                                                    padding: "12px 14px",
                                                    borderRadius: "10px",
                                                    border: "2px solid rgba(99, 102, 241, 0.3)",
                                                    background: "rgba(255,255,255,0.95)",
                                                    fontSize: "14px",
                                                    cursor: "pointer",
                                                    color: "#4f46e5",
                                                    fontWeight: "700",
                                                    transition: "all 0.3s ease",
                                                    boxShadow: "0 2px 8px rgba(99, 102, 241, 0.08)"
                                                }}
                                            >
                                                <option value="CORRIGENDUM">📋 Corrigendum / Amendment</option>
                                                <option value="REFERENCE_UPDATE">📚 Reference / Supplementary File</option>
                                                {!hasBaseRfp && (userRole || "").toLowerCase() !== "technical_manager" && <option value="BASE_RFP">🛠️ Baseline RFP</option>}
                                            </select>
                                        </div>
                                    )}

                                    {projectExists && hasBaseRfp && !isAnalyzing && (
                                        <button
                                            onClick={handleViewOldAnalysis}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = "rgba(99, 102, 241, 0.15)";
                                                e.currentTarget.style.transform = "translateY(-1px)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = "rgba(99, 102, 241, 0.08)";
                                                e.currentTarget.style.transform = "translateY(0)";
                                            }}
                                            style={{
                                                marginTop: "4px",
                                                padding: "12px",
                                                background: "rgba(99, 102, 241, 0.08)",
                                                color: "#4f46e5",
                                                border: "2px solid rgba(99, 102, 241, 0.25)",
                                                borderRadius: "12px",
                                                fontSize: "13px",
                                                fontWeight: "700",
                                                cursor: "pointer",
                                                transition: "all 0.3s ease",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: "8px"
                                            }}
                                        >
                                            📑 View Analysis Records (Previous Uploads)
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <label htmlFor="file-upload" className="upload-box" style={{
                        opacity: projectExists === null ? 0.6 : 1,
                        pointerEvents: projectExists === null ? "none" : "auto",
                        transition: "all 0.4s ease",
                        background: projectExists === null ? "rgba(0,0,0,0.02)" : "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(250,243,225,0.5) 100%)",
                        border: projectExists === null ? "2px dashed rgba(0,0,0,0.1)" : "2px dashed rgba(255,143,143,0.6)",
                        padding: "40px 20px",
                        borderRadius: "20px",
                        boxShadow: projectExists ? "0 4px 0 rgba(255,143,143,0.2), inset 0 2px 8px rgba(0,0,0,0.03)" : "none"
                    }}>
                        <p style={{ fontSize: "18px", marginBottom: "16px", color: projectExists === null ? "#9ba3af" : "#1f2937", fontWeight: "600" }}>
                            {uploadedFiles.length > 0
                                ? `✅ ${uploadedFiles.length} file(s) selected`
                                : projectExists === true
                                    ? "📤 Drop Corrigendums or Reference Files here"
                                    : "📤 Drop Base RFP Document here"}
                        </p>
                        <input type="file" multiple onChange={handleFileUpload} className="hidden" id="file-upload" />
                        <span className="btn-primary" style={{ padding: "14px 28px", borderRadius: "14px", fontSize: "15px", boxShadow: "0 8px 16px rgba(59,130,246,0.25)", background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" }}>
                            {uploadedFiles.length > 0 ? "Add More Files" : "Select Documents"}
                        </span>
                    </label>

                    {uploadedFiles.length > 0 && (
                        <div className="file-list" style={{ marginTop: "24px", animation: "slideUp 0.4s ease-out" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                                <span style={{ fontWeight: "700", fontSize: "14px", color: "#374151" }}>Files Ready for Analysis</span>
                            </div>
                            {uploadedFiles.map((file, idx) => (
                                <div key={idx} style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "14px 18px", background: "rgba(255,255,255,0.8)", borderRadius: "12px", marginBottom: "10px",
                                    border: "1px solid rgba(99, 102, 241, 0.15)", boxShadow: "0 2px 8px rgba(99, 102, 241, 0.08)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                        <span style={{ fontSize: "20px" }}>📄</span>
                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                            <span style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>{file.name}</span>
                                            <span style={{ fontSize: "11px", color: "#6b7280" }}>{(file.size / 1024).toFixed(1)} KB</span>
                                        </div>
                                    </div>
                                    <button onClick={() => removeFile(idx)} style={{ background: "#fee2e2", border: "none", cursor: "pointer", color: "#ef4444", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "18px", transition: "all 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#fecaca"} onMouseLeave={(e) => e.currentTarget.style.background = "#fee2e2"}>×</button>
                                </div>
                            ))}

                            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                                {!isAnalyzing ? (
                                    <button onClick={handleAnalyze} className="btn-primary" onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"} style={{ flex: 1, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", padding: "16px", borderRadius: "14px", fontSize: "16px", boxShadow: "0 8px 20px rgba(16,185,129,0.35)", transition: "all 0.3s ease" }}>Start Analysis 🚀</button>
                                ) : (
                                    <>
                                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                                            {/* Progress Bar Container */}
                                            <div style={{
                                                background: "rgba(255, 255, 255, 0.95)",
                                                padding: "20px",
                                                borderRadius: "14px",
                                                border: "2px solid rgba(99, 102, 241, 0.2)",
                                                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.1)"
                                            }}>
                                                {/* Current Stage */}
                                                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                                                    <div style={{
                                                        width: "24px",
                                                        height: "24px",
                                                        border: "3px solid #6366f1",
                                                        borderTop: "3px solid transparent",
                                                        borderRadius: "50%",
                                                        animation: "spin 1s linear infinite"
                                                    }} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: "14px", fontWeight: "700", color: "#4f46e5", marginBottom: "4px" }}>
                                                            {analysisStage || "Processing..."}
                                                        </div>
                                                        <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "500" }}>
                                                            ⏱️ {formatTime(analysisTime)} elapsed
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                <div style={{
                                                    width: "100%",
                                                    height: "12px",
                                                    background: "rgba(99, 102, 241, 0.1)",
                                                    borderRadius: "10px",
                                                    overflow: "hidden",
                                                    position: "relative",
                                                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)"
                                                }}>
                                                    <div style={{
                                                        width: `${progressPercent}%`,
                                                        height: "100%",
                                                        background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)",
                                                        borderRadius: "10px",
                                                        transition: "width 0.5s ease-out",
                                                        boxShadow: "0 2px 8px rgba(99, 102, 241, 0.4)",
                                                        position: "relative",
                                                        overflow: "hidden"
                                                    }}>
                                                        {/* Animated shimmer effect */}
                                                        <div style={{
                                                            position: "absolute",
                                                            top: 0,
                                                            left: "-100%",
                                                            width: "100%",
                                                            height: "100%",
                                                            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                                                            animation: "shimmer 2s infinite"
                                                        }} />
                                                    </div>
                                                </div>

                                                {/* Progress Percentage */}
                                                <div style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    marginTop: "8px"
                                                }}>
                                                    <span style={{ fontSize: "11px", color: "#6b7280", fontWeight: "600" }}>
                                                        Progress
                                                    </span>
                                                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#6366f1" }}>
                                                        {progressPercent}%
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: "flex",
                                                gap: "12px",
                                                alignItems: "center",
                                                width: "100%"
                                            }}>
                                                <button disabled className="btn-primary" style={{
                                                    flex: 1,
                                                    background: "#6b7280",
                                                    padding: "14px",
                                                    borderRadius: "12px",
                                                    cursor: "not-allowed",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    gap: "10px",
                                                    fontSize: "15px",
                                                    fontWeight: "600"
                                                }}>
                                                    <div style={{ width: "16px", height: "16px", border: "2px solid #fff", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                                                    Analysis in Progress
                                                </button>
                                                <button
                                                    onClick={handleCancel}
                                                    style={{
                                                        padding: "14px 20px",
                                                        background: "transparent",
                                                        color: "#6b7280",
                                                        border: "2px solid rgba(107, 114, 128, 0.3)",
                                                        borderRadius: "12px",
                                                        fontWeight: "600",
                                                        cursor: "pointer",
                                                        transition: "all 0.2s ease",
                                                        fontSize: "14px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        gap: "6px",
                                                        whiteSpace: "nowrap",
                                                        minWidth: "fit-content"
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = "#ef4444";
                                                        e.currentTarget.style.color = "#fff";
                                                        e.currentTarget.style.borderColor = "#ef4444";
                                                        e.currentTarget.style.transform = "translateY(-1px)";
                                                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.25)";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = "transparent";
                                                        e.currentTarget.style.color = "#6b7280";
                                                        e.currentTarget.style.borderColor = "rgba(107, 114, 128, 0.3)";
                                                        e.currentTarget.style.transform = "translateY(0)";
                                                        e.currentTarget.style.boxShadow = "none";
                                                    }}
                                                >
                                                    <span style={{ fontSize: "16px" }}>✕</span>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="description-list" style={{ marginTop: "30px", padding: "18px", borderRadius: "14px" }}>
                        <p style={{ margin: "6px 0", fontSize: "13px", color: "#4b5563", fontWeight: "500" }}>🔹 Supports Comprehensive AI Analysis of PDF, Word, and Images</p>
                        <p style={{ margin: "6px 0", fontSize: "13px", color: "#4b5563", fontWeight: "500" }}>🔹 Automated OEM Mapping & Local Content (MII) Identification</p>
                        <p style={{ margin: "6px 0", fontSize: "13px", color: "#4b5563", fontWeight: "500" }}>🔹 Historical Traceability & Corrigendum Merging Included</p>
                    </div>
                </div>
            </div>

            {(userRole === "bid_admin" || userRole === "bid_manager") && (
                <button
                    type="button"
                    onClick={() => navigate("/home")}
                    title={userRole === "bid_admin" ? "Back to Bid Admin Dashboard" : "Back to Dashboard"}
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        left: '20px',
                        zIndex: 1000,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 20px',
                        background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                        border: '1px solid rgba(13,148,136,0.4)',
                        borderRadius: 12,
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: 14,
                        color: '#fff',
                        boxShadow: '0 4px 12px rgba(13,148,136,0.3)',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(13,148,136,0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(13,148,136,0.3)';
                    }}
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>
            )}
        </div>
    );
}
