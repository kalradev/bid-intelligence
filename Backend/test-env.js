const fs = require('fs');
const path = require('path');

console.log('\n🔍 DEBUGGING .env FILE\n');

const envPath = path.resolve(__dirname, '.env');
console.log('📂 Looking at:', envPath);
console.log('📂 File exists?', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const buffer = fs.readFileSync(envPath);
    
    console.log('\n📏 FILE INFO:');
    console.log('   Size:', content.length, 'bytes');
    console.log('   Lines:', content.split('\n').length);
    console.log('   First 200 chars:', content.substring(0, 200));
    console.log('   First 10 bytes (hex):', buffer.slice(0, 10).toString('hex'));
    
    console.log('\n📝 PARSING .ENV:');
    const dotenv = require('dotenv');
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
        console.log('   ❌ Error:', result.error.message);
    } else {
        console.log('   ✅ Parsed successfully');
        console.log('   Variables found:', Object.keys(result.parsed || {}).length);
        console.log('   Keys:', Object.keys(result.parsed || {}).join(', '));
    }
    
    console.log('\n🔑 CHECKING ENVIRONMENT:');
    console.log('   process.env.OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'MISSING');
    console.log('   process.env.GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'MISSING');
    
    console.log('\n🔬 RAW FILE CONTENT (first 300 chars):');
    console.log(JSON.stringify(content.substring(0, 300)));
    
} else {
    console.log('❌ FILE NOT FOUND!');
    console.log('\n📂 Files in Backend directory:');
    const files = fs.readdirSync(__dirname);
    files.forEach(f => console.log('   -', f));
}

console.log('\n');

