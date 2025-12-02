const crypto = require('crypto');

/**
 * Compute SHA-256 hash from file buffer
 * @param {Buffer} buffer - File buffer
 * @returns {string} - Hex string of hash
 */
function computeFileHash(buffer) {
    return crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex');
}

module.exports = {
    computeFileHash
};
