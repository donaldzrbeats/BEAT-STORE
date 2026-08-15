/**
 * Interactive Gemini Website Build Agent
 * Includes automated Git Add, Commit, and Push workflow.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

// Automatically load variables from .env if present
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  const envContent = fs.readFileSync(ENV_FILE, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      value = value.replace(/(^['"]|['"]$)/g, '').trim();
      process.env[key] = value;
    }
  });
}

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

function checkGitStatus() {
  console.log('\n📄 Current Git Status:');
  try {
    const status = execSync('git status --short', { encoding: 'utf8' });
    if (status.trim()) {
      console.log(status);
    } else {
      console.log('✨ Working tree clean. No unsaved changes.\n');
    }
  } catch (err) {
    console.error('❌ Could not check git status:', err.message);
  }
}

async function gitPushWorkflow() {
  console.log('\n==============================================');
  console.log('     🚀 Automated Git Add, Commit & Push     ');
  console.log('==============================================');

  const customMessage = await prompt('Enter a commit message (or press Enter for default): ');
  const commitMessage = customMessage.trim() || 'Update beat store website via Gemini Agent';

  try {
    console.log('\n📦 [1/4] Staging changes (git add .)...');
    execSync('git add .', { stdio: 'inherit' });

    console.log(`📝 [2/4] Committing changes ("${commitMessage}")...`);
    try {
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
    } catch (commitErr) {
      console.log('ℹ️ Note: No new changes detected to commit.');
    }

    console.log('🔄 [3/4] Synchronizing with remote (git pull --rebase origin main)...');
    execSync('git pull --rebase origin main', { stdio: 'inherit' });

    console.log('🚀 [4/4] Pushing to GitHub (git push origin main)...');
    execSync('git push origin main', { stdio: 'inherit' });

    console.log('\n🎉 SUCCESS! All changes have been pushed to GitHub.');
    console.log('🌐 GitHub Pages is now deploying your updated live website!\n');
  } catch (error) {
    console.error('\n❌ Git push process failed:', error.message, '\n');
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('\n❌ ERROR: GEMINI_API_KEY is not set in your .env file.');
    console.log('👉 Make sure you have a .env file containing: GEMINI_API_KEY="your_key"\n');
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
    console.log(' [3] 📄 View Git status');
    console.log(' [4] 🚀 Save & Push to GitHub (git add, commit, push)');
    console.log(' [5] 🚪 Exit Agent');

    const choice = await prompt('\nEnter choice (1-5): ');

    switch (choice.trim()) {
      case '1':
        await modifyWebsite(apiKey);
        break;
      case '2':
        revertBackup();
        break;
      case '3':
        checkGitStatus();
        break;
      case '4':
        await gitPushWorkflow();
        break;
      case '5':
        console.log('\nExiting agent. Happy coding!\n');
        running = false;
        rl.close();
        break;
      default:
        console.log('\n⚠️ Invalid option. Please enter a number between 1 and 5.\n');
    }
  }
}

main();