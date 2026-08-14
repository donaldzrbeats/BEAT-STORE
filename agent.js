/**
 * Interactive Gemini Website Build Agent
 * Updated to use the active gemini-3.7-flash model endpoint.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const HTML_FILE = path.join(__dirname, 'index.html');
const BACKUP_FILE = path.join(__dirname, 'index.html.bak');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Function to call the Gemini API using gemini-3.7-flash
async function callGemini(apiKey, instruction, currentCode) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `
You are an expert web developer and UI designer. 
Your task is to modify the provided single-page website code (index.html) according to the user's instructions.

STRICT OUTPUT RULES:
1. Output ONLY the complete, raw, updated HTML code.
2. Do NOT wrap code in markdown formatting like \`\`\`html or \`\`\`.
3. Do NOT include conversational explanations or commentary.
4. Always preserve the working 3D Three.js canvas background, styles, and BeatStars embed structure unless explicitly asked to modify them.
  `;

  const userPrompt = `
Instruction: ${instruction}

Current index.html Source:
${currentCode}
  `;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: systemInstruction + '\n\n' + userPrompt }]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API Error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  let generatedHtml = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!generatedHtml) {
    throw new Error('No code was returned by the Gemini API.');
  }

  return generatedHtml
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

async function modifyWebsite(apiKey) {
  const instruction = await prompt('\n🤖 Describe the changes you want to make:\n> ');

  if (!instruction.trim()) {
    console.log('⚠️ No instruction entered. Returning to menu.\n');
    return;
  }

  if (!fs.existsSync(HTML_FILE)) {
    console.error(`❌ Error: "${HTML_FILE}" not found in current directory.`);
    return;
  }

  try {
    console.log('\n⏳ Reading index.html and creating backup...');
    const currentHtml = fs.readFileSync(HTML_FILE, 'utf8');
    fs.writeFileSync(BACKUP_FILE, currentHtml, 'utf8');
    console.log('💾 Backup saved to index.html.bak');

    console.log('🚀 Sending request to Gemini Agent...');
    const updatedHtml = await callGemini(apiKey, instruction, currentHtml);

    fs.writeFileSync(HTML_FILE, updatedHtml, 'utf8');
    console.log('✅ Success! index.html has been updated.\n');
  } catch (error) {
    console.error(`\n❌ Update failed: ${error.message}\n`);
  }
}

function revertBackup() {
  if (!fs.existsSync(BACKUP_FILE)) {
    console.log('\n⚠️ No backup file (index.html.bak) found to restore.\n');
    return;
  }

  const backupContent = fs.readFileSync(BACKUP_FILE, 'utf8');
  fs.writeFileSync(HTML_FILE, backupContent, 'utf8');
  console.log('\n🔄 Reverted index.html to the previous backup state successfully.\n');
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('\n❌ ERROR: GEMINI_API_KEY environment variable is not set.');
    console.log('👉 Run this command in your terminal first:');
    console.log('   export GEMINI_API_KEY="your_api_key_here"\n');
    rl.close();
    process.exit(1);
  }

  console.log('==============================================');
  console.log('   🔥 DonaldZR Beats - Gemini Build Agent 🔥   ');
  console.log('==============================================');

  let running = true;

  while (running) {
    console.log('Choose an action:');
    console.log(' [1] 🛠️  Modify website with Gemini');
    console.log(' [2] 🔄 Revert last change (restore backup)');
    console.log(' [3] 🚪 Exit Agent');

    const choice = await prompt('\nEnter choice (1-3): ');

    switch (choice.trim()) {
      case '1':
        await modifyWebsite(apiKey);
        break;
      case '2':
        revertBackup();
        break;
      case '3':
        console.log('\nExiting agent. Happy coding!\n');
        running = false;
        rl.close();
        break;
      default:
        console.log('\n⚠️ Invalid option. Please enter 1, 2, or 3.\n');
    }
  }
}

main();