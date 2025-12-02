import jsPDF from 'jspdf';

/**
 * Generate a comprehensive summary PDF from analysis data
 * @param {Object} analysisData - The complete analysis data from localStorage
 */
export const generateSummaryPDF = (analysisData) => {
  try {
    if (!analysisData || !analysisData.data) {
      alert('No analysis data available to download');
      return;
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    const data = analysisData.data;
    const summaries = data.departmentalSummaries || {};
    const projectOverview = summaries.projectOverview || {};

    // Helper function to add text with word wrap
    const addText = (text, fontSize = 10, isBold = false) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = pdf.splitTextToSize(text, maxWidth);
      
      lines.forEach((line) => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text(line, margin, yPosition);
        yPosition += fontSize * 0.5;
      });
      yPosition += 3;
    };

    const addSection = (title) => {
      yPosition += 5;
      pdf.setFillColor(59, 130, 246); // Blue background
      pdf.rect(margin, yPosition - 5, maxWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin + 2, yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 8;
    };

    // Title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 47, 94);
    pdf.text('RFP Analysis Summary', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    yPosition += 10;

    // PROJECT OVERVIEW
    addSection('PROJECT OVERVIEW');
    if (projectOverview.projectName) addText(`Project: ${projectOverview.projectName}`, 11, true);
    if (projectOverview.client) addText(`Client: ${projectOverview.client}`);
    if (projectOverview.tenderId) addText(`Tender ID: ${projectOverview.tenderId}`);
    if (projectOverview.bidValue) addText(`Bid Value: ${projectOverview.bidValue}`, 11, true);
    if (projectOverview.emd) addText(`EMD: ${projectOverview.emd}`);
    if (projectOverview.completionPeriod) addText(`Completion Period: ${projectOverview.completionPeriod}`);
    if (projectOverview.lastSubmissionDate) addText(`Submission Deadline: ${projectOverview.lastSubmissionDate}`, 10, true);

    // BID MANAGEMENT
    if (summaries.bidManagement) {
      addSection('BID MANAGEMENT');
      const bid = summaries.bidManagement;
      if (bid.projectOverview) addText(bid.projectOverview);
      if (bid.keyDeadlines) addText(`Key Deadlines: ${bid.keyDeadlines}`, 10, true);
      if (bid.strategy) addText(`Strategy: ${bid.strategy}`);
      
      if (bid.successFactors && bid.successFactors.length > 0) {
        addText('Success Factors:', 10, true);
        bid.successFactors.forEach(factor => addText(`• ${factor}`, 9));
      }
      
      if (bid.keyPoints && bid.keyPoints.length > 0) {
        addText('Key Points:', 10, true);
        bid.keyPoints.forEach(point => addText(`• ${point}`, 9));
      }
      
      if (bid.riskAreas && bid.riskAreas.length > 0) {
        addText('Risk Areas:', 10, true);
        bid.riskAreas.forEach(risk => addText(`• ${risk}`, 9));
      }
    }

    // TECHNICAL
    if (summaries.technical) {
      addSection('TECHNICAL');
      const tech = summaries.technical;
      if (tech.totalItems) addText(`Total Items: ${tech.totalItems}`, 10, true);
      if (tech.compliancePercent) addText(`Compliance: ${tech.compliancePercent}`, 10, true);
      
      if (tech.keySpecifications && tech.keySpecifications.length > 0) {
        addText('Key Specifications:', 10, true);
        tech.keySpecifications.forEach(spec => {
          if (typeof spec === 'object' && spec.productName && spec.specification) {
            addText(`• ${spec.productName}: ${spec.specification}`, 9);
          } else if (typeof spec === 'string') {
            addText(`• ${spec}`, 9);
          }
        });
      }
      
      if (tech.gapsIdentified && tech.gapsIdentified.length > 0) {
        addText('Gaps Identified:', 10, true);
        tech.gapsIdentified.forEach(gap => addText(`• ${gap}`, 9));
      }
      
      if (tech.keyPoints && tech.keyPoints.length > 0) {
        addText('Key Points:', 10, true);
        tech.keyPoints.forEach(point => addText(`• ${point}`, 9));
      }
      
      if (tech.riskAreas && tech.riskAreas.length > 0) {
        addText('Risk Areas:', 10, true);
        tech.riskAreas.forEach(risk => addText(`• ${risk}`, 9));
      }
    }

    // COMMERCIAL
    if (summaries.commercial) {
      addSection('COMMERCIAL');
      const comm = summaries.commercial;
      if (comm.estimatedValue) addText(`Estimated Value: ${comm.estimatedValue}`, 10, true);
      if (comm.paymentTerms) addText(`Payment Terms: ${comm.paymentTerms}`);
      if (comm.warranties) addText(`Warranties: ${comm.warranties}`);
      if (comm.penalties) addText(`Penalties: ${comm.penalties}`);
      
      if (comm.keyPoints && comm.keyPoints.length > 0) {
        addText('Key Points:', 10, true);
        comm.keyPoints.forEach(point => addText(`• ${point}`, 9));
      }
      
      if (comm.riskAreas && comm.riskAreas.length > 0) {
        addText('Risk Areas:', 10, true);
        comm.riskAreas.forEach(risk => addText(`• ${risk}`, 9));
      }
    }

    // FINANCE
    if (summaries.finance) {
      addSection('FINANCE');
      const fin = summaries.finance;
      if (fin.turnoverRequired) addText(`Turnover Required: ${fin.turnoverRequired}`, 10, true);
      if (fin.bankGuarantee) addText(`Bank Guarantee: ${fin.bankGuarantee}`);
      if (fin.eligibilityStatus) addText(`Eligibility Status: ${fin.eligibilityStatus}`, 10, true);
      if (fin.profitabilityNotes) addText(`Profitability Notes: ${fin.profitabilityNotes}`);
      
      if (fin.keyPoints && fin.keyPoints.length > 0) {
        addText('Key Points:', 10, true);
        fin.keyPoints.forEach(point => addText(`• ${point}`, 9));
      }
    }

    // LEGAL
    if (summaries.legal) {
      addSection('LEGAL');
      const legal = summaries.legal;
      if (legal.contractType) addText(`Contract Type: ${legal.contractType}`, 10, true);
      if (legal.liabilityCap) addText(`Liability Cap: ${legal.liabilityCap}`);
      if (legal.disputeResolution) addText(`Dispute Resolution: ${legal.disputeResolution}`);
      
      if (legal.requiredComplianceDocuments && legal.requiredComplianceDocuments.length > 0) {
        addText('Required Compliance Documents:', 10, true);
        legal.requiredComplianceDocuments.forEach(doc => addText(`• ${doc}`, 9));
      }
      
      if (legal.keyPoints && legal.keyPoints.length > 0) {
        addText('Key Points:', 10, true);
        legal.keyPoints.forEach(point => addText(`• ${point}`, 9));
      }
    }

    // SCM
    if (summaries.scm) {
      addSection('SUPPLY CHAIN MANAGEMENT');
      const scm = summaries.scm;
      if (scm.leadTime) addText(`Lead Time: ${scm.leadTime}`, 10, true);
      if (scm.criticalItemsCount) addText(`Critical Items Count: ${scm.criticalItemsCount}`, 10, true);
      if (scm.riskLevel) addText(`Risk Level: ${scm.riskLevel}`, 10, true);
      if (scm.sourcingStrategy) addText(`Sourcing Strategy: ${scm.sourcingStrategy}`);
      
      if (scm.keyPoints && scm.keyPoints.length > 0) {
        addText('Key Points:', 10, true);
        scm.keyPoints.forEach(point => addText(`• ${point}`, 9));
      }
      
      if (scm.riskAreas && scm.riskAreas.length > 0) {
        addText('Risk Areas:', 10, true);
        scm.riskAreas.forEach(risk => addText(`• ${risk}`, 9));
      }
    }

    // PRODUCT MAPPING
    if (summaries.productMapping) {
      addSection('PRODUCT MAPPING');
      const pm = summaries.productMapping;
      if (pm.totalItems) addText(`Total Items: ${pm.totalItems}`, 10, true);
      if (pm.totalOEMs) {
        addText(`Total OEMs: ${pm.totalOEMs.count || 'N/A'} (Indian: ${pm.totalOEMs.indian || 0}, Global: ${pm.totalOEMs.global || 0})`);
      }
      if (pm.makeInIndiaMapping) {
        addText(`Make in India Status: ${pm.makeInIndiaMapping.status}`, 10, true);
        addText(`MII Mapped: ${pm.makeInIndiaMapping.mapped || 0}, Unmapped: ${pm.makeInIndiaMapping.unmapped || 0}`);
      }
    }

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      pdf.text('Generated by Bid Intelligence.AI', pageWidth / 2, pageHeight - 5, { align: 'center' });
    }

    // Download
    const fileName = projectOverview.projectName 
      ? `${projectOverview.projectName.replace(/[^a-z0-9]/gi, '_')}_Summary.pdf`
      : 'RFP_Analysis_Summary.pdf';
    
    pdf.save(fileName);
    console.log('Summary PDF generated successfully!');
  } catch (error) {
    console.error('Error generating summary PDF:', error);
    alert('Failed to generate summary PDF. Please try again.');
  }
};
