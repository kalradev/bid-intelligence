import jsPDF from 'jspdf';

/**
 * Generate a comprehensive summary PDF from analysis data
 * @param {Object} analysisData - The complete analysis data from localStorage
 * @param {Object} eligibilityChecklist - Optional eligibility checklist with Yes/No status
 */
export const generateSummaryPDF = (analysisData, eligibilityChecklist = {}) => {
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
      
      // Eligibility Criteria with Yes/No status
      if (bid.successFactors && typeof bid.successFactors === 'object' && bid.successFactors.preQualificationCriteria) {
        const criteria = bid.successFactors.preQualificationCriteria;
        if (Array.isArray(criteria) && criteria.length > 0) {
          yPosition += 3;
          addText('Eligibility Criteria:', 10, true);
          
          criteria.forEach((criterion, idx) => {
            const status = eligibilityChecklist[criterion];
            const statusText = status === true || status === "true" ? "✓ Yes" : status === false || status === "false" ? "✗ No" : "";
            const displayText = statusText ? `${criterion} [${statusText}]` : criterion;
            addText(`${idx + 1}. ${displayText}`, 9);
          });
          yPosition += 2;
        }
      }
      
      if (bid.successFactors && bid.successFactors.length > 0 && !bid.successFactors.preQualificationCriteria) {
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
      // Product table: Model = model name only. Never OEM list (e.g. "Blustar/Voltas/Carrier"), specs, or N/A. Fallback: [Category] Series.
      const looksLikeSpecs = (s) => {
        if (!s || typeof s !== 'string') return true;
        const t = String(s).trim();
        if (t.length > 65) return true;
        return /(Width|Thickness|Length|Size):\s*\d|\d+\s*mm\s*[x,×]\s*\d|\d+\s*mm\s*,\s*\d|dimension\s*\d/i.test(t);
      };
      const looksLikeOemList = (s) => !!(s && typeof s === 'string' && s.split('/').length >= 2);
      const getModelDisplay = (p) => {
        const m = (p.model || '').trim();
        if (m && m !== 'N/A' && m !== 'Unspecified' && !looksLikeSpecs(m) && !looksLikeOemList(m)) return m;
        const pn = (p.productName || '').trim();
        if (pn && !looksLikeOemList(pn)) return pn.length > 42 ? pn.substring(0, 42) + '…' : pn;
        const cat = (p.category || '').trim();
        return (looksLikeOemList(cat) ? 'General' : (cat || 'General')) + ' Series';
      };
      const products = pm.miiProductStatus || [];
      if (products.length > 0) {
        yPosition += 4;
        addText('Product list (Name, Category, OEM, Model, MII Status):', 10, true);
        const colWidths = [45, 28, 35, 42, 25];
        const headers = ['Product', 'Category', 'OEM', 'Model', 'MII'];
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text(headers[0], margin, yPosition);
        pdf.text(headers[1], margin + colWidths[0], yPosition);
        pdf.text(headers[2], margin + colWidths[0] + colWidths[1], yPosition);
        pdf.text(headers[3], margin + colWidths[0] + colWidths[1] + colWidths[2], yPosition);
        pdf.text(headers[4], margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPosition);
        yPosition += 5;
        pdf.setFont('helvetica', 'normal');
        for (let i = 0; i < Math.min(products.length, 50); i++) {
          const p = products[i];
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = margin;
          }
          const name = (p.productName || 'N/A').substring(0, 22);
          const cat = (p.category || 'Other').substring(0, 10);
          const oem = (p.oem || 'N/A').substring(0, 14);
          const model = getModelDisplay(p).substring(0, 18);
          const mii = (p.miiStatus || 'Unmapped').substring(0, 8);
          pdf.text(name, margin, yPosition);
          pdf.text(cat, margin + colWidths[0], yPosition);
          pdf.text(oem, margin + colWidths[0] + colWidths[1], yPosition);
          pdf.text(model, margin + colWidths[0] + colWidths[1] + colWidths[2], yPosition);
          pdf.text(mii, margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], yPosition);
          yPosition += 4.5;
        }
        if (products.length > 50) {
          addText(`... and ${products.length - 50} more products.`, 8);
        }
        pdf.setFontSize(10);
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
