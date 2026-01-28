import jsPDF from 'jspdf';

/**
 * Generate a comprehensive summary PDF from analysis data
 * Enhanced version with ALL bullet points and detailed information
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
        if (yPosition > pageHeight - margin - 10) {
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
      if (yPosition > pageHeight - margin - 10) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.setFillColor(59, 130, 246); // Blue background
      pdf.rect(margin, yPosition - 5, maxWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin + 2, yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 8;
    };

    // Helper function to add bullet points (handles both object and array structures)
    const addBulletPoints = (data, title, fontSize = 9) => {
      if (!data) return;
      
      if (typeof data === 'object' && !Array.isArray(data)) {
        // Object structure with categories
        addText(title, 10, true);
        Object.entries(data).forEach(([category, items]) => {
          if (Array.isArray(items) && items.length > 0) {
            addText(`${category}:`, 9, true);
            items.forEach(item => {
              if (item && item !== 'N/A' && item !== '') {
                addText(`• ${item}`, fontSize);
              }
            });
          }
        });
      } else if (Array.isArray(data) && data.length > 0) {
        // Array structure
        addText(title, 10, true);
        data.forEach(item => {
          if (item && item !== 'N/A' && item !== '') {
            if (typeof item === 'object' && item.date && item.description) {
              // Critical dates format
              addText(`• ${item.date}: ${item.description}`, fontSize);
            } else if (typeof item === 'string') {
              addText(`• ${item}`, fontSize);
            }
          }
        });
      }
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

    // BID MANAGEMENT - Enhanced with all criteria
    if (summaries.bidManagement) {
      addSection('BID MANAGEMENT');
      const bid = summaries.bidManagement;
      if (bid.projectOverview) addText(bid.projectOverview);
      if (bid.keyDeadlines) addText(`Key Deadlines: ${bid.keyDeadlines}`, 10, true);
      if (bid.strategy) addText(`Strategy: ${bid.strategy}`);
      
      // Technical Evaluation Criteria
      if (bid.successFactors && bid.successFactors.technicalEvaluationCriteria && bid.successFactors.technicalEvaluationCriteria.length > 0) {
        addText('Technical Evaluation Criteria:', 10, true);
        bid.successFactors.technicalEvaluationCriteria.forEach(criteria => addText(`• ${criteria}`, 9));
      }
      
      // Pre-Qualification/Eligibility Criteria
      if (bid.successFactors && bid.successFactors.preQualificationCriteria && bid.successFactors.preQualificationCriteria.length > 0) {
        addText('Pre-Qualification Criteria:', 10, true);
        bid.successFactors.preQualificationCriteria.forEach(criteria => addText(`• ${criteria}`, 9));
      }
      
      // Financial Criteria
      if (bid.successFactors && bid.successFactors.financial && bid.successFactors.financial.length > 0) {
        addText('Financial Criteria:', 10, true);
        bid.successFactors.financial.forEach(item => addText(`• ${item}`, 9));
      }
      
      // Technical Criteria
      if (bid.successFactors && bid.successFactors.technical && bid.successFactors.technical.length > 0) {
        addText('Technical Criteria:', 10, true);
        bid.successFactors.technical.forEach(item => addText(`• ${item}`, 9));
      }
      
      // Operational Criteria
      if (bid.successFactors && bid.successFactors.operational && bid.successFactors.operational.length > 0) {
        addText('Operational Criteria:', 10, true);
        bid.successFactors.operational.forEach(item => addText(`• ${item}`, 9));
      }
      
      // Compliance Requirements
      if (bid.successFactors && bid.successFactors.compliance && bid.successFactors.compliance.length > 0) {
        addText('Compliance Requirements:', 10, true);
        bid.successFactors.compliance.forEach(item => addText(`• ${item}`, 9));
      }
      
      // Timeline
      if (bid.successFactors && bid.successFactors.timeline && bid.successFactors.timeline.length > 0) {
        addText('Timeline Requirements:', 10, true);
        bid.successFactors.timeline.forEach(item => addText(`• ${item}`, 9));
      }
      
      // EMD Exemption
      if (bid.successFactors && bid.successFactors.emdExemption && bid.successFactors.emdExemption.length > 0) {
        addText('EMD Exemption Conditions:', 10, true);
        bid.successFactors.emdExemption.forEach(item => addText(`• ${item}`, 9));
      }
      
      // Success Factors (general array)
      if (bid.successFactors && Array.isArray(bid.successFactors) && bid.successFactors.length > 0) {
        addText('Success Factors:', 10, true);
        bid.successFactors.forEach(factor => {
          if (factor && factor !== 'N/A' && factor !== '') {
            addText(`• ${factor}`, 9);
          }
        });
      }
      
      // Key Points - ALL (no limit)
      addBulletPoints(bid.keyPoints, 'Key Points:');
      
      // Compliance Requirements
      addBulletPoints(bid.complianceRequirements, 'Compliance Requirements:');
      
      // Risk Areas - ALL
      addBulletPoints(bid.riskAreas, 'Risk Areas:');
      
      // Action Items - ALL
      if (bid.actionItems && Array.isArray(bid.actionItems) && bid.actionItems.length > 0) {
        addText('Action Items:', 10, true);
        bid.actionItems.forEach(item => {
          if (item && item !== 'N/A' && item !== '') {
            addText(`• ${item}`, 9);
          }
        });
      }
    }

    // TECHNICAL - Enhanced with ALL fields
    if (summaries.technical) {
      addSection('TECHNICAL');
      const tech = summaries.technical;
      if (tech.totalItems) addText(`Total Items: ${tech.totalItems}`, 10, true);
      if (tech.compliancePercent) addText(`Compliance: ${tech.compliancePercent}`, 10, true);
      
      // Key Specifications - Show ALL
      if (tech.keySpecifications && tech.keySpecifications.length > 0) {
        addText('Key Specifications:', 10, true);
        tech.keySpecifications.forEach(spec => {
          if (typeof spec === 'object' && spec.productName && spec.specification) {
            addText(`• ${spec.productName}: ${spec.specification}`, 9);
          } else if (typeof spec === 'string' && spec !== 'N/A' && spec !== '') {
            addText(`• ${spec}`, 9);
          }
        });
      }
      
      // Standards and Certifications
      if (tech.standards && tech.standards.length > 0) {
        addText('Standards & Certifications:', 10, true);
        tech.standards.forEach(std => {
          if (std && std !== 'N/A' && std !== '') {
            addText(`• ${std}`, 9);
          }
        });
      }
      
      // Technical Requirements
      if (tech.technicalRequirements && tech.technicalRequirements.length > 0) {
        addText('Technical Requirements:', 10, true);
        tech.technicalRequirements.forEach(req => {
          if (req && req !== 'N/A' && req !== '') {
            addText(`• ${req}`, 9);
          }
        });
      }
      
      // Critical Requirements
      addBulletPoints(tech.criticalRequirements, 'Critical Requirements:');
      
      // Gaps Identified
      if (tech.gapsIdentified && tech.gapsIdentified.length > 0) {
        addText('Gaps Identified:', 10, true);
        tech.gapsIdentified.forEach(gap => {
          if (gap && gap !== 'N/A' && gap !== '') {
            addText(`• ${gap}`, 9);
          }
        });
      }
      
      // Key Points - ALL (no limit, handles object/array)
      addBulletPoints(tech.keyPoints, 'Key Points:');
      
      // Critical Dates
      if (tech.criticalDates && tech.criticalDates.length > 0) {
        addText('Critical Dates:', 10, true);
        tech.criticalDates.forEach(item => {
          if (item && item.date && item.description) {
            addText(`• ${item.date}: ${item.description}`, 9);
          }
        });
      }
      
      // Risk Areas - ALL
      addBulletPoints(tech.riskAreas, 'Risk Areas:');
      
      // Compliance Requirements
      addBulletPoints(tech.complianceRequirements, 'Compliance Requirements:');
      
      // Action Items
      if (tech.actionItems && Array.isArray(tech.actionItems) && tech.actionItems.length > 0) {
        addText('Action Items:', 10, true);
        tech.actionItems.forEach(item => {
          if (item && item !== 'N/A' && item !== '') {
            addText(`• ${item}`, 9);
          }
        });
      }
    }

    // COMMERCIAL - Enhanced with ALL fields
    if (summaries.commercial) {
      addSection('COMMERCIAL');
      const comm = summaries.commercial;
      if (comm.estimatedValue) addText(`Estimated Value: ${comm.estimatedValue}`, 10, true);
      if (comm.paymentTerms) addText(`Payment Terms: ${comm.paymentTerms}`);
      if (comm.warranties) addText(`Warranties: ${comm.warranties}`);
      if (comm.penalties) addText(`Penalties: ${comm.penalties}`);
      
      // Payment Milestones
      if (comm.paymentMilestones && comm.paymentMilestones.length > 0) {
        addText('Payment Milestones:', 10, true);
        comm.paymentMilestones.forEach(milestone => {
          if (milestone && milestone !== 'N/A' && milestone !== '') {
            addText(`• ${milestone}`, 9);
          }
        });
      }
      
      // Pricing Appointment
      if (comm.pricingAppointment && Array.isArray(comm.pricingAppointment) && comm.pricingAppointment.length > 0) {
        addText('Pricing Appointment:', 10, true);
        comm.pricingAppointment.forEach(appointment => {
          if (appointment && typeof appointment === 'object') {
            const parts = [];
            if (appointment.event) parts.push(`Event: ${appointment.event}`);
            if (appointment.date) parts.push(`Date: ${appointment.date}`);
            if (appointment.time) parts.push(`Time: ${appointment.time}`);
            if (appointment.location) parts.push(`Location: ${appointment.location}`);
            if (parts.length > 0) {
              addText(`• ${parts.join(' | ')}`, 9);
            }
          }
        });
      }
      
      // Pricing Bid
      if (comm.pricingBid && typeof comm.pricingBid === 'object') {
        if (comm.pricingBid.requirements && Array.isArray(comm.pricingBid.requirements) && comm.pricingBid.requirements.length > 0) {
          addText('Pricing Bid Requirements:', 10, true);
          comm.pricingBid.requirements.forEach(req => {
            if (req && req !== 'N/A' && req !== '') {
              addText(`• ${req}`, 9);
            }
          });
        }
        if (comm.pricingBid.submissionInstructions && Array.isArray(comm.pricingBid.submissionInstructions) && comm.pricingBid.submissionInstructions.length > 0) {
          addText('Submission Instructions:', 10, true);
          comm.pricingBid.submissionInstructions.forEach(inst => {
            if (inst && inst !== 'N/A' && inst !== '') {
              addText(`• ${inst}`, 9);
            }
          });
        }
        if (comm.pricingBid.evaluationCriteria && Array.isArray(comm.pricingBid.evaluationCriteria) && comm.pricingBid.evaluationCriteria.length > 0) {
          addText('Evaluation Criteria:', 10, true);
          comm.pricingBid.evaluationCriteria.forEach(criteria => {
            if (criteria && criteria !== 'N/A' && criteria !== '') {
              addText(`• ${criteria}`, 9);
            }
          });
        }
        if (comm.pricingBid.documentsNeeded && Array.isArray(comm.pricingBid.documentsNeeded) && comm.pricingBid.documentsNeeded.length > 0) {
          addText('Mandatory Documents:', 10, true);
          comm.pricingBid.documentsNeeded.forEach(doc => {
            if (doc && doc !== 'N/A' && doc !== '') {
              addText(`• ${doc}`, 9);
            }
          });
        }
        if (comm.pricingBid.paymentTerms && Array.isArray(comm.pricingBid.paymentTerms) && comm.pricingBid.paymentTerms.length > 0) {
          addText('Payment Terms (Pricing Bid):', 10, true);
          comm.pricingBid.paymentTerms.forEach(term => {
            if (term && term !== 'N/A' && term !== '') {
              addText(`• ${term}`, 9);
            }
          });
        }
        if (comm.pricingBid.taxesAndCharges && Array.isArray(comm.pricingBid.taxesAndCharges) && comm.pricingBid.taxesAndCharges.length > 0) {
          addText('Taxes & Charges:', 10, true);
          comm.pricingBid.taxesAndCharges.forEach(tax => {
            if (tax && tax !== 'N/A' && tax !== '') {
              addText(`• ${tax}`, 9);
            }
          });
        }
      }
      
      // Key Points - ALL (no limit, handles object/array)
      addBulletPoints(comm.keyPoints, 'Key Points:');
      
      // Critical Dates
      if (comm.criticalDates && comm.criticalDates.length > 0) {
        addText('Critical Dates:', 10, true);
        comm.criticalDates.forEach(item => {
          if (item && item.date && item.description) {
            addText(`• ${item.date}: ${item.description}`, 9);
          }
        });
      }
      
      // Compliance Requirements
      addBulletPoints(comm.complianceRequirements, 'Compliance Requirements:');
      
      // Risk Areas - ALL
      addBulletPoints(comm.riskAreas, 'Risk Areas:');
      
      // Action Items
      if (comm.actionItems && Array.isArray(comm.actionItems) && comm.actionItems.length > 0) {
        addText('Action Items:', 10, true);
        comm.actionItems.forEach(item => {
          if (item && item !== 'N/A' && item !== '') {
            addText(`• ${item}`, 9);
          }
        });
      }
    }

    // FINANCE - Enhanced with ALL fields
    if (summaries.finance) {
      addSection('FINANCE');
      const fin = summaries.finance;
      if (fin.turnoverRequired) addText(`Turnover Required: ${fin.turnoverRequired}`, 10, true);
      if (fin.bankGuarantee) addText(`Bank Guarantee: ${fin.bankGuarantee}`);
      if (fin.eligibilityStatus) addText(`Eligibility Status: ${fin.eligibilityStatus}`, 10, true);
      if (fin.profitabilityNotes) addText(`Profitability Notes: ${fin.profitabilityNotes}`);
      if (fin.netWorth) addText(`Net Worth Required: ${fin.netWorth}`);
      
      // Financial Requirements
      if (fin.financialRequirements && fin.financialRequirements.length > 0) {
        addText('Financial Requirements:', 10, true);
        fin.financialRequirements.forEach(req => {
          if (req && req !== 'N/A' && req !== '') {
            addText(`• ${req}`, 9);
          }
        });
      }
      
      // Key Points - ALL (no limit, handles object/array)
      addBulletPoints(fin.keyPoints, 'Key Points:');
      
      // Critical Dates
      if (fin.criticalDates && fin.criticalDates.length > 0) {
        addText('Critical Dates:', 10, true);
        fin.criticalDates.forEach(item => {
          if (item && item.date && item.description) {
            addText(`• ${item.date}: ${item.description}`, 9);
          }
        });
      }
      
      // Compliance Requirements
      addBulletPoints(fin.complianceRequirements, 'Compliance Requirements:');
      
      // Risk Areas - ALL
      addBulletPoints(fin.riskAreas, 'Risk Areas:');
      
      // Action Items
      if (fin.actionItems && Array.isArray(fin.actionItems) && fin.actionItems.length > 0) {
        addText('Action Items:', 10, true);
        fin.actionItems.forEach(item => {
          if (item && item !== 'N/A' && item !== '') {
            addText(`• ${item}`, 9);
          }
        });
      }
    }

    // LEGAL - Enhanced with ALL fields
    if (summaries.legal) {
      addSection('LEGAL');
      const legal = summaries.legal;
      if (legal.contractType) addText(`Contract Type: ${legal.contractType}`, 10, true);
      if (legal.liabilityCap) addText(`Liability Cap: ${legal.liabilityCap}`);
      if (legal.disputeResolution) addText(`Dispute Resolution: ${legal.disputeResolution}`);
      
      // Required Compliance Documents
      if (legal.requiredComplianceDocuments && legal.requiredComplianceDocuments.length > 0) {
        addText('Required Compliance Documents:', 10, true);
        legal.requiredComplianceDocuments.forEach(doc => {
          if (doc && doc !== 'N/A' && doc !== '') {
            addText(`• ${doc}`, 9);
          }
        });
      } else if (legal.requiredDocuments && legal.requiredDocuments.length > 0) {
        addText('Required Documents:', 10, true);
        legal.requiredDocuments.forEach(doc => {
          if (doc && doc !== 'N/A' && doc !== '') {
            addText(`• ${doc}`, 9);
          }
        });
      }
      
      // Key Points - ALL (no limit, handles object/array)
      addBulletPoints(legal.keyPoints, 'Key Points:');
      
      // Critical Dates
      if (legal.criticalDates && legal.criticalDates.length > 0) {
        addText('Critical Dates:', 10, true);
        legal.criticalDates.forEach(item => {
          if (item && item.date && item.description) {
            addText(`• ${item.date}: ${item.description}`, 9);
          }
        });
      }
      
      // Risk Areas - ALL
      addBulletPoints(legal.riskAreas, 'Risk Areas:');
      
      // Action Items
      if (legal.actionItems && Array.isArray(legal.actionItems) && legal.actionItems.length > 0) {
        addText('Action Items:', 10, true);
        legal.actionItems.forEach(item => {
          if (item && item !== 'N/A' && item !== '') {
            addText(`• ${item}`, 9);
          }
        });
      }
    }

    // SCM - Enhanced with ALL fields
    if (summaries.scm) {
      addSection('SUPPLY CHAIN MANAGEMENT');
      const scm = summaries.scm;
      if (scm.leadTime) addText(`Lead Time: ${scm.leadTime}`, 10, true);
      if (scm.criticalItemsCount || scm.criticalItems) {
        addText(`Critical Items Count: ${scm.criticalItemsCount || scm.criticalItems}`, 10, true);
      }
      if (scm.riskLevel) addText(`Risk Level: ${scm.riskLevel}`, 10, true);
      if (scm.sourcingStrategy) addText(`Sourcing Strategy: ${scm.sourcingStrategy}`);
      if (scm.miiRequirement) addText(`MII Requirement: ${scm.miiRequirement}`);
      
      // Key Points - ALL (no limit, handles object/array)
      addBulletPoints(scm.keyPoints, 'Key Points:');
      
      // Critical Dates
      if (scm.criticalDates && scm.criticalDates.length > 0) {
        addText('Critical Dates:', 10, true);
        scm.criticalDates.forEach(item => {
          if (item && item.date && item.description) {
            addText(`• ${item.date}: ${item.description}`, 9);
          }
        });
      }
      
      // Compliance Requirements
      addBulletPoints(scm.complianceRequirements, 'Compliance Requirements:');
      
      // Risk Areas - ALL
      addBulletPoints(scm.riskAreas, 'Risk Areas:');
      
      // Action Items
      if (scm.actionItems && Array.isArray(scm.actionItems) && scm.actionItems.length > 0) {
        addText('Action Items:', 10, true);
        scm.actionItems.forEach(item => {
          if (item && item !== 'N/A' && item !== '') {
            addText(`• ${item}`, 9);
          }
        });
      }
    }

    // PRODUCT MAPPING - ENHANCED with full product list
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
      
      // FULL PRODUCT LIST with OEMs and Models
      if (pm.miiProductStatus && pm.miiProductStatus.length > 0) {
        addText('Product Details:', 10, true);
        pm.miiProductStatus.forEach((product, index) => {
          const productName = product.productName || 'N/A';
          const category = product.category || 'Other';
          const oem = product.oem || 'Unspecified';
          const model = product.model || 'N/A';
          const quantity = product.quantity || 'N/A';
          const unit = product.unit || 'N/A';
          const specifications = product.specifications || '';
          const miiStatus = product.miiStatus || 'Pending';
          
          // Product header
          addText(`${index + 1}. ${productName}`, 10, true);
          addText(`   Category: ${category} | OEM: ${oem} | Model: ${model}`, 9);
          if (quantity !== 'N/A') addText(`   Quantity: ${quantity} ${unit}`, 9);
          if (specifications) {
            const specLines = pdf.splitTextToSize(`   Specifications: ${specifications}`, maxWidth - 10);
            specLines.forEach(line => {
              if (yPosition > pageHeight - margin - 10) {
                pdf.addPage();
                yPosition = margin;
              }
              pdf.setFontSize(9);
              pdf.text(line, margin + 5, yPosition);
              yPosition += 4.5;
            });
          }
          addText(`   MII Status: ${miiStatus}`, 9);
          
          // OEM Recommendations if available
          if (product.oemRecommendations && product.oemRecommendations.length > 0) {
            addText(`   Recommended OEMs:`, 9, true);
            product.oemRecommendations.slice(0, 3).forEach((rec, recIndex) => {
              const recOem = rec.oem || 'N/A';
              const recModel = rec.model || 'N/A';
              const matchScore = rec.matchScore || 0;
              addText(`     ${recIndex + 1}. ${recOem} - ${recModel} (Match: ${matchScore}%)`, 8);
            });
          }
          
          yPosition += 2; // Space between products
        });
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
