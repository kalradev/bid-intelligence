/**
 * Utility functions for fetching and managing document analysis
 */

import { API_BASE_URL } from '../config';

export interface DocumentAnalysisResult {
  success: boolean;
  project_centric: boolean;
  data: {
    projectName: string;
    fileHash: string;
    departmentalSummaries: any;
    metadata: {
      lastUpdated: string;
      updateType: string;
      documentId: number;
      fileName: string;
    };
  };
}

/**
 * Fetch project analysis for a specific document or merged view
 */
export async function fetchProjectAnalysis(
  projectName: string,
  documentId: number | null = null,
  documentType: string | null = null
): Promise<DocumentAnalysisResult> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error("Please login to view project analysis");
  }

  let url = `${API_BASE_URL}/api/rfp/get-project-analysis/${encodeURIComponent(projectName)}`;
  
  if (documentId) {
    url += `?document_id=${documentId}`;
  } else if (documentType) {
    url += `?document_type=${encodeURIComponent(documentType)}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to fetch project analysis");
  }

  return await response.json();
}

/**
 * Update localStorage with analysis data and document info
 */
export function updateAnalysisData(result: DocumentAnalysisResult, projectName: string) {
  localStorage.setItem("analysisData", JSON.stringify(result));

  if (result.data && result.data.fileHash) {
    const documentInfo = {
      fileHash: result.data.fileHash,
      fileName: result.data.metadata.fileName || "Analysis",
      projectName: projectName,
      documentId: result.data.metadata.documentId,
      updateType: result.data.metadata.updateType,
      displayName: getDocumentDisplayName(result.data.metadata.updateType, result.data.metadata.documentId)
    };
    localStorage.setItem("recentRfpAnalysis", JSON.stringify(documentInfo));
    localStorage.setItem("currentDocument", JSON.stringify(documentInfo));
    localStorage.setItem("selectedDocumentId", result.data.metadata.documentId?.toString() || "");
  }
}

/**
 * Get display name for document type
 */
function getDocumentDisplayName(updateType: string, documentId?: number): string {
  if (!updateType) return "Merged View (Latest)";
  
  switch (updateType) {
    case "BASE_RFP":
      return "Base RFP";
    case "CORRIGENDUM":
      return "Corrigendum";
    case "REFERENCE_UPDATE":
      return "Reference Update";
    default:
      return updateType;
  }
}

