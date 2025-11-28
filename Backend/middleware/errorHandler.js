const multer = require('multer');

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size too large',
                message: `File size must be less than ${process.env.MAX_FILE_SIZE_MB || 50}MB`
            });
        }
        return res.status(400).json({
            success: false,
            error: 'File upload error',
            message: err.message
        });
    }

    // Custom validation errors
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid file type',
            message: err.message
        });
    }

    // OpenAI API errors
    if (err.response && err.response.status) {
        return res.status(err.response.status).json({
            success: false,
            error: 'OpenAI API error',
            message: err.response.data?.error?.message || 'Error processing with OpenAI'
        });
    }

    // Generic server error
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
};

module.exports = errorHandler;
