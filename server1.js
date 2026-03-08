const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const acorn = require('acorn');
const walk = require('acorn-walk');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

const generatedDir = path.join(__dirname, 'generated');
if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir);
}

// Global to store last extracted topics for frontend retrieval
let lastExtractedTopics = [];

// Ensure you have GEMINI_API_KEY in your .env or shell environment
const GEMINI_ENABLED = !!process.env.GEMINI_API_KEY;

// Initialize the Gemini client
const ai = GEMINI_ENABLED ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const CACHE_FILE = path.join(generatedDir, 'simulations_cache.json');

function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('  ⚠ Error loading cache:', e.message);
    }
    return {};
}

function saveCache(cache) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
        console.error('  ⚠ Error saving cache:', e.message);
    }
}

async function callGemini(prompt, retries = 5, minDelay = 2000) {
    if (!ai) throw new Error("Gemini API is disabled.");

    for (let i = 0; i <= retries; i++) {
        try {
            const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            const errorMsg = (error.message || "").toLowerCase();
            const isRateLimit = errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("rate limit");

            if (i < retries && isRateLimit) {
                // Try to extract retry delay if provided by the SDK/API
                let waitTime = minDelay * Math.pow(2, i) + Math.random() * 1000;

                // If the error object has a specific delay (sometimes in error.response or error.details)
                if (error.response && error.response.status === 429) {
                    // Standard header is Retry-After, but SDK might wrap it
                    const retryAfter = error.response.headers ? error.response.headers.get('retry-after') : null;
                    if (retryAfter) {
                        waitTime = parseInt(retryAfter) * 1000;
                    }
                }

                console.warn(`  ⚠ Rate limit hit. Retrying in ${Math.round(waitTime)}ms... (Attempt ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw error;
        }
    }
}

/**
 * Validates generated HTML by checking for undeclared identifiers, illegal geometries,
 * and syntax errors using a real JS parser (acorn).
 */
function validateSimulationHTML(html) {
    if (!html) return { valid: true, errors: [] };
    const errors = [];

    // 1. Check for illegal HTML structures
    if (html.includes('type="module"') || html.includes('type=\'module\'')) {
        errors.push('Found forbidden type="module"');
    }
    if (html.includes('<importmap') || html.includes('<script type="importmap"')) {
        errors.push('Found forbidden importmap');
    }

    // 2. Extract the content of the first <script> tag
    const scriptMatch = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
    if (!scriptMatch) return { valid: true, errors: [] };
    const scriptContent = scriptMatch[1];

    try {
        // Parse the script into an AST
        const ast = acorn.parse(scriptContent, { ecmaVersion: 2020 });

        const globalDeclarations = new Set();
        const allUsages = [];
        const animateFunctionNode = { node: null };

        // 3. Traverse the AST to find all declarations and usages
        walk.ancestor(ast, {
            VariableDeclarator(node, state, ancestors) {
                // Check if it's a top-level declaration
                if (ancestors.length <= 3) {
                    if (node.id && node.id.name) globalDeclarations.add(node.id.name);
                }
            },
            FunctionDeclaration(node, state, ancestors) {
                if (ancestors.length <= 2) {
                    if (node.id && node.id.name) globalDeclarations.add(node.id.name);
                }
                if (node.id && node.id.name === 'animate') {
                    animateFunctionNode.node = node;
                }
            },
            MemberExpression(node) {
                // Check for forbidden Three.js classes/methods
                if (node.object && node.object.name === 'THREE' && node.property && node.property.name === 'CapsuleGeometry') {
                    errors.push('Found forbidden THREE.CapsuleGeometry');
                }
                if (node.property && node.property.name === 'merge' && node.object && node.object.property && node.object.property.name === 'BufferGeometry') {
                    errors.push('Found forbidden BufferGeometry.merge()');
                }
            },
            Identifier(node, state, ancestors) {
                const parent = ancestors[ancestors.length - 2];
                if (!parent) return;

                const isDeclaration = (parent.type === 'VariableDeclarator' && parent.id === node) ||
                    (parent.type === 'FunctionDeclaration' && parent.id === node) ||
                    (parent.type === 'ClassDeclaration' && parent.id === node) ||
                    (parent.type === 'AssignmentPattern' && parent.left === node);

                const isMemberProperty = parent.type === 'MemberExpression' && parent.property === node && !parent.computed;
                const isObjectKey = parent.type === 'Property' && parent.key === node && !parent.shorthand;

                if (!isDeclaration && !isMemberProperty && !isObjectKey) {
                    allUsages.push({ name: node.name, ancestors: [...ancestors] });
                }
            }
        });

        // 4. Verify that all identifiers used are declared somewhere
        const internalBuiltins = ['window', 'document', 'console', 'Math', 'THREE', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'performance', 'Date', 'JSON', 'navigator', 'GLBSystem', 'OrbitControls', 'CANNON', 'HTML', 'Set', 'Map', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Promise'];

        allUsages.forEach(usage => {
            if (internalBuiltins.includes(usage.name)) return;
            if (globalDeclarations.has(usage.name)) return;

            let found = false;
            for (let i = usage.ancestors.length - 1; i >= 0; i--) {
                const ancestor = usage.ancestors[i];
                if (ancestor.body && Array.isArray(ancestor.body)) {
                    const blockDecls = ancestor.body
                        .filter(n => n.type === 'VariableDeclaration')
                        .flatMap(n => n.declarations.map(d => d.id && d.id.name));
                    if (blockDecls.includes(usage.name)) {
                        found = true;
                        break;
                    }
                }
                if (ancestor.params && Array.isArray(ancestor.params)) {
                    const paramDecls = ancestor.params.map(p => p.name || (p.left && p.left.name));
                    if (paramDecls.includes(usage.name)) {
                        found = true;
                        break;
                    }
                }
            }

            if (!found) {
                errors.push(`Possibly undeclared identifier: ${usage.name}`);
            }
        });

        // 5. Special check for animate() scope
        if (animateFunctionNode.node) {
            const localToAnimate = new Set();
            walk.simple(animateFunctionNode.node.body, {
                VariableDeclarator(node) {
                    if (node.id && node.id.name) localToAnimate.add(node.id.name);
                }
            });

            const sceneKeywords = ['scene', 'camera', 'renderer', 'mesh', 'group', 'cell', 'geometry', 'material'];
            allUsages.forEach(usage => {
                const isInAnimate = usage.ancestors.includes(animateFunctionNode.node);
                if (isInAnimate && localToAnimate.has(usage.name)) {
                    const isSceneObj = sceneKeywords.some(k => usage.name.toLowerCase().includes(k));
                    if (isSceneObj) {
                        errors.push(`Variable '${usage.name}' is declared inside animate() but looks like a persistent object.`);
                    }
                }
            });
        }

    } catch (e) {
        errors.push(`JS Syntax Error: ${e.message} at line ${e.loc ? e.loc.line : 'unknown'}`);
    }

    return {
        valid: errors.length === 0,
        errors: [...new Set(errors)]
    };
}

app.post('/api/learn', async (req, res) => {
    const { topic } = req.body;
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ error: 'Topic is required' });
    }

    const cleanTopic = topic.trim();
    console.log(`\n🧠 Learning request: "${cleanTopic}"`);

    try {
        if (!GEMINI_ENABLED) {
            console.log("Gemini Disabled. Attempting Fallback.");
            const sampleFiles = fs.readdirSync(generatedDir).filter(f => f.endsWith('.html'));
            const sampleUrl = sampleFiles.length > 0 ? `/generated/${sampleFiles[0]}` : null;
            return res.json({
                needs3d: false,
                reason: 'Running in DEV mode — Gemini API disabled.',
                title: cleanTopic,
                url: sampleUrl
            });
        }

        const force = req.body.force === true;

        // Caching Logic
        const cache = loadCache();
        const cacheKey = cleanTopic.toLowerCase();

        if (!force && cache[cacheKey]) {
            const cachedUrl = cache[cacheKey].url;
            const cachedPath = path.join(__dirname, cachedUrl);
            if (fs.existsSync(cachedPath)) {
                console.log(`  ✨ Cache hit for "${cleanTopic}": ${cachedUrl}`);
                return res.json({
                    needs3d: true,
                    url: cachedUrl,
                    title: cache[cacheKey].title || cleanTopic,
                    reason: 'Loaded from cache.'
                });
            } else {
                console.log(`  ⚠ Cache entry found for "${cleanTopic}" but file is missing. Regenerating...`);
                delete cache[cacheKey];
                saveCache(cache);
            }
        }

        // Combined Prompt: Classification + Generation in ONE call
        const combinedPrompt = `You are an expert educator and Three.js developer. 
Topic: "${cleanTopic}"

TASK 1: Determine if this topic benefits from a 3D interactive visualization.
Topics that benefit: physics, chemistry, biology, geometry, astronomy, engineering, geography, architecture, etc.
Topics that do NOT: history dates, literature analysis, pure math proofs, philosophy, etc.

TASK 2: If (and ONLY if) it benefits from 3D, generate a COMPLETE, STANDALONE HTML page using Three.js.

REQUIREMENTS FOR HTML (YOU MUST FOLLOW THESE RULES EXACTLY):
- Always load Three.js with <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>. Never use import, type="module", or importmap.
- Provide a SPLIT-SCREEN LAYOUT:
    - Left Area (70%): The interactive Three.js 3D simulation.
    - Right Sidebar (30%): Clear Title (font-size: 16px), 2-3 sentence explanation (font-size: 12px), and usage instructions.
    - These MUST be side-by-side using flexbox on the <body>.
- Declare ALL variables (let, const) at the top of the script before any function definitions or calls — never mid-script or after animate() is invoked.
- Call init() and animate() only at the very bottom, after all functions and variables are defined.
- Never use THREE.CapsuleGeometry — it does not exist in r128. Use a THREE.Group containing a CylinderGeometry and two SphereGeometry meshes at the ends instead.
- Never use BufferGeometry.merge() or any manual geometry merging (it is broken in r128 and causes RangeError: offset is out of bounds). To create capsule-like shapes (mitochondria, bacteria, etc.), always use a THREE.Group containing a CylinderGeometry mesh in the center with two SphereGeometry meshes positioned at each end, all using the same material.
- Every constant and variable name must be spelled identically at its declaration and at every usage site throughout the code. Never truncate, abbreviate, or alter the spelling of any name after declaring it.
- Before finishing the code, trace every declared name and verify every usage matches exactly.
- Every Three.js built-in class name must be spelled exactly correctly. Before finishing the code, verify the spelling of every THREE.* class used. Do not invent or alter Three.js class names.
- Never call array methods like .forEach(), .map(), .filter(), .find(), .push() on any variable without first ensuring that variable is actually initialized as an array.
- If a function is supposed to return an array or object, make sure it explicitly returns it — a missing return statement causes the caller to receive undefined, and any method call on undefined crashes the simulation immediately.
- Before finishing the code, trace every variable that has an array method called on it and verify it is guaranteed to be initialized before that call is reached.
- After writing the complete code, do a self-review pass: check every variable name,Every constant name, every THREE.* class name, and every array/function return for consistency and correctness before outputting the final result.
- Create ACCURATE and detailed 3D objects with realistic textures/colors and parts. Do not use geometry merging.
- Implement animations (rotation, pulsing) and text labels (HTML overlays, font-size: 10px).
- Handle camera controls (rotation/zoom) natively (no external OrbitControls).
- The canvas MUST fill the 70% container and be clearly visible.
- Dark background (#0a0a1a), neon theme (cyan, purple, pink) for both simulation and sidebar.
- Ensure the 3D part is high-fidelity and scientifically accurate.
- DO NOT return needs3d: false unless it is impossible to visualize in 3D. Default to true.

RESPONSE FORMAT:
You must respond with ONLY VALID JSON. No markdown fences.
{
  "needs3d": boolean,
  "reason": "short explanation",
  "title": "short title",
  "html": "The full <!DOCTYPE html>...</html> code, OR null if needs3d is false"
}`;

        let parsed = null;
        let attempts = 0;
        const maxAttempts = 3;

        // Combined Prompt: Classification + Generation in ONE call (with Retry Loop)
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`  Step: Processing with Gemini (Attempt ${attempts}/${maxAttempts})...`);

            try {
                const resultStr = await callGemini(combinedPrompt);
                let jsonStr = resultStr.trim();
                if (jsonStr.startsWith('```')) {
                    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
                }
                parsed = JSON.parse(jsonStr);

                // If no 3D needed, we can stop retrying (unless forced, but we'll check that after)
                if (!parsed.needs3d && !force) break;

                // If HTML provided, validate it
                if (parsed.html) {
                    const validation = validateSimulationHTML(parsed.html);
                    if (validation.valid) {
                        break; // Success!
                    } else {
                        console.warn(`  ⚠ Validation failed (Attempt ${attempts}/${maxAttempts}): ${validation.errors.join(', ')}`);
                        parsed = null; // Clear to trigger retry
                    }
                }
            } catch (e) {
                console.error(`  Attempt ${attempts} failed:`, e.message);
                if (attempts === maxAttempts) {
                    return res.status(500).json({ error: 'Failed to process topic after multiple attempts.' });
                }
            }
        }

        if (!parsed) {
            return res.status(500).json({ error: 'AI failed to generate a valid simulation.' });
        }

        if (!parsed.needs3d && !force) {
            console.log('  ❌ Topic does not need 3D visualization');
            return res.json({
                needs3d: false,
                reason: parsed.reason || 'Better learned through text.',
                title: parsed.title || cleanTopic
            });
        }

        // Handle forced mode if AI said no but user wants it (though prompt usually respects topic)
        let html = parsed.html;
        if (!html && force) {
            // If forced but AI didn't provide HTML in combined response, we might need a fallback or a second call, 
            // but we'll try to stick to one call.
            console.warn('  ⚠ Forced mode but no HTML provided. This shouldn\'t happen with the new prompt.');
        }

        if (html) {
            // Clean HTML just in case
            if (html.includes('```')) {
                html = html.replace(/```html?\n?/g, '').replace(/```/g, '').trim();
            }
            const doctypeIdx = html.toLowerCase().indexOf('<!doctype');
            if (doctypeIdx !== -1) html = html.substring(doctypeIdx);

            const fileId = `learn_${Date.now()}`;
            const filePath = path.join(generatedDir, `${fileId}.html`);
            const fileUrl = `/generated/${fileId}.html`;
            fs.writeFileSync(filePath, html, 'utf8');
            console.log(`  ✅ Saved to ${fileUrl}`);

            // Update Cache
            const cache = loadCache();
            cache[cleanTopic.toLowerCase()] = {
                url: fileUrl,
                title: parsed.title || cleanTopic,
                timestamp: new Date().toISOString()
            };
            saveCache(cache);

            return res.json({
                needs3d: true,
                url: fileUrl,
                title: parsed.title || cleanTopic,
                reason: parsed.reason || ''
            });
        } else {
            return res.status(500).json({ error: 'AI failed to generate simulation' });
        }

    } catch (error) {
        console.error('  ❗ Error in learning pipeline:', error.message);
        const errorMsg = (error.message || '').toLowerCase();
        if (errorMsg.includes('quota') || errorMsg.includes('429')) {
            return res.status(429).json({ error: 'API quota exceeded. Please try again later.' });
        }
        return res.status(500).json({ error: 'An error occurred during generation.' });
    }
});

// ── PDF Upload Endpoint ─────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log(`\n📄 PDF Upload: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

    try {
        // Step 1: Extract text from PDF
        console.log('  Step 1: Extracting text from PDF...');
        const pdfData = await pdfParse(req.file.buffer);
        const rawText = pdfData.text;

        if (!rawText || rawText.trim().length < 20) {
            return res.status(400).json({ error: 'Could not extract meaningful text from PDF. It may be image-based or empty.' });
        }

        console.log(`  Extracted ${rawText.length} characters of text`);

        // Step 2: Use Gemini to identify top biology/science topics
        if (!GEMINI_ENABLED) {
            console.log('  Gemini API disabled — returning sample topics');
            return res.json({
                topics: ['cell division', 'DNA replication', 'protein synthesis', 'photosynthesis', 'mitochondria', 'cell membrane'],
                source: req.file.originalname
            });
        }

        console.log('  Step 2: Identifying topics with Gemini...');
        const topicPrompt = `You are an expert biology and science educator. Analyze the following text extracted from a PDF document and identify EXACTLY 3 (three) important biology or science topics that would benefit from a 3D interactive visualization.

Focus on topics like: cell structures, DNA/RNA, protein synthesis, organ systems, molecular biology, biochemistry, microbiology, anatomy, physiology, ecology concepts, evolution mechanisms, etc.

PDF TEXT (may be truncated):
"""${rawText.substring(0, 8000)}"""

Respond with ONLY valid JSON, no markdown fences:
{"topics": ["topic1", "topic2", "topic3"], "summary": "one line summary of the PDF content"}`;

        const topicResult = await callGemini(topicPrompt);
        console.log('  Topic extraction result:', topicResult.substring(0, 300));

        let parsed;
        try {
            let jsonStr = topicResult.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            parsed = JSON.parse(jsonStr);
        } catch (e) {
            console.error('  Failed to parse topic response:', e.message);
            return res.status(500).json({ error: 'Failed to analyze PDF content. Please try again.' });
        }

        const topics = (parsed.topics || []).slice(0, 3);
        lastExtractedTopics = topics; // Store for /api/topics endpoint
        console.log(`  ✅ Extracted ${topics.length} topics:`, topics);

        return res.json({
            topics,
            summary: parsed.summary || '',
            source: req.file.originalname
        });

    } catch (error) {
        console.error('  ❗ PDF processing error:', error.message);
        const errorMsg = (error.message || '').toLowerCase();
        const status = (errorMsg.includes('quota') || errorMsg.includes('exceeded') || errorMsg.includes('rate limit') || errorMsg.includes('429')) ? 429 : 500;
        return res.status(status).json({ error: error.message });
    }
});

// Endpoint for frontend to retrieve topics identified from the last PDF upload
app.get('/api/topics', (req, res) => {
    res.json({ topics: lastExtractedTopics });
});

app.listen(port, () => {
    console.log(`\n🔵 Google Gemini Server`);
    console.log(`🌐 http://localhost:${port}`);
    console.log(`---------------------------------------\n`);
});
