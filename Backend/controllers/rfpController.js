const { extractText } = require('../services/documentExtractor');
const { generateDepartmentalSummaries } = require('../services/openaiService');

/**
 * Analyze RFP document
 * POST /api/rfp/analyze
 */
const analyzeRFP = async (req, res, next) => {
    const startTime = Date.now();

    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded',
                message: 'Please upload a PDF, DOC, or DOCX file'
            });
        }

        const { buffer, mimetype, originalname } = req.file;

        console.log(`Processing file: ${originalname} (${mimetype})`);

        // Step 1: Extract text from document
        console.log('Extracting text from document...');
        const extractionResult = await extractText(buffer, mimetype, originalname);

        console.log(`Extracted ${extractionResult.wordCount} words from ${extractionResult.metadata.pages || 'unknown'} pages`);

        // Step 2: Generate departmental summaries using OpenAI
        console.log('Generating departmental summaries with OpenAI...');
        const aiResult = await generateDepartmentalSummaries(
            extractionResult.text,
            originalname
        );

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

        // Step 3: Return response
        res.json({
            success: true,
            data: {
                fileName: originalname,
                extractedText: extractionResult.text,
                departmentalSummaries: aiResult.summaries,
                metadata: {
                    processingTime: `${processingTime}s`,
                    pageCount: extractionResult.metadata.pages || 'N/A',
                    wordCount: extractionResult.wordCount,
                    model: aiResult.model,
                    chunked: aiResult.chunked || false,
                    usage: aiResult.usage
                }
            }
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    analyzeRFP
};
