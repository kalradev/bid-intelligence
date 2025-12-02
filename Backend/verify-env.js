/**
 * .env File Verification Script
 * Run this to check if your API keys are loading correctly
 */

require('dotenv').config();

console.log('\n🔍 Verifying .env file...\n');

// Check each variable
const checks = [
    { name: 'OPENAI_API_KEY', required: false },
    { name: 'GEMINI_API_KEY', required: true },
    { name: 'PORT', required: false },
    { name: 'NODE_ENV', required: false },
    { name: 'MAX_FILE_SIZE_MB', required: false }
];

let allGood = true;

checks.forEach(check => {
    const value = process.env[check.name];
    const exists = value && value.trim() !== '';
    
    if (exists) {
        console.log(`✅ ${check.name}: Found (length: ${value.length})`);
    } else {
        if (check.required) {
            console.log(`❌ ${check.name}: MISSING (REQUIRED)`);
            allGood = false;
        } else {
            console.log(`⚠️  ${check.name}: Not found (optional)`);
        }
    }
});

console.log('\n📊 Summary:');
console.log(`   Total variables in process.env: ${Object.keys(process.env).length}`);
console.log(`   Expected from .env: ${checks.length}`);
console.log(`   Status: ${allGood ? '✅ All required keys present' : '❌ Some required keys missing'}`);

// Show OpenAI status
if (process.env.OPENAI_API_KEY) {
    console.log('\n🤖 AI Provider Configuration:');
    console.log('   Primary: OpenAI (gpt-4o-mini)');
    console.log('   Fallback: Gemini');
} else {
    console.log('\n🤖 AI Provider Configuration:');
    console.log('   Primary: Gemini only (OpenAI not configured)');
}

console.log('\n💡 Tips:');
if (!process.env.OPENAI_API_KEY) {
    console.log('   - OpenAI key not found. System will use Gemini.');
    console.log('   - To add OpenAI: Edit Backend/.env and add:');
    console.log('     OPENAI_API_KEY=your_key_here');
}
if (!process.env.GEMINI_API_KEY) {
    console.log('   - Gemini key REQUIRED! Add to Backend/.env:');
    console.log('     GEMINI_API_KEY=your_key_here');
}

console.log('\n');
process.exit(allGood ? 0 : 1);

