import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface AnalysisData {
  success: boolean;
  data: {
    fileName: string;
    extractedText: string;
    departmentalSummaries: {
      projectOverview: any;
      bidManagement: any;
      technical: any;
      commercial: any;
      finance: any;
      legal: any;
      scm: any;
      productMapping: any;
    };
    metadata: {
      processingTime: string;
      pageCount: string | number;
      wordCount: number;
      model: string;
      chunked: boolean;
    };
  };
}

interface AnalysisContextType {
  analysisData: AnalysisData | null;
  setAnalysisData: (data: AnalysisData | null) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  return (
    <AnalysisContext.Provider value={{ analysisData, setAnalysisData }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}

