import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

// Initialize the Amazon Bedrock client
const AWS_ENABLED = !!process.env.AWS_REGION || !!process.env.AWS_ACCESS_KEY_ID;
const bedrock = AWS_ENABLED ? new BedrockRuntimeClient({
    region: (process.env.AWS_REGION || 'us-east-1').trim(),
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: (process.env.AWS_ACCESS_KEY_ID || '').trim(),
        secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || '').trim()
    } : undefined
}) : null;

async function callBedrock(prompt: string, config: any = {}) {
    if (!bedrock) throw new Error("AWS Bedrock API is disabled.");

    const maxTokens = config.maxOutputTokens || 2048;
    const temperature = config.temperature !== undefined ? config.temperature : 0.7;

    const command = new ConverseCommand({
        modelId: 'us.amazon.nova-lite-v1:0',
        messages: [
            { role: 'user', content: [{ text: prompt }] }
        ],
        system: [{ text: 'You are an expert AI assistant.' }],
        inferenceConfig: {
            maxTokens: maxTokens,
            temperature: temperature
        }
    });

    const response = await bedrock.send(command);
    // @ts-ignore
    return response.output.message.content[0].text;
}

export async function generateMissionsFromDocument(fileBuffer: Buffer, fileName: string) {
    console.log(`Processing document: ${fileName} via AWS Pipeline`);

    let rawText = "";
    try {
        const pdfData = await pdfParse(fileBuffer);
        rawText = pdfData.text;
    } catch (e) {
        console.error("PDF extraction error:", e);
    }

    if (!AWS_ENABLED || !rawText || rawText.trim().length < 20) {
        console.log(`Fallback triggered. AWS_ENABLED: ${AWS_ENABLED}, rawText length: ${rawText ? rawText.trim().length : 0}`);
        console.log('AWS Bedrock disabled or short text — returning sample topics');
        return [
            { id: 1, title: "Cell Division", topic: "Biology", difficulty: "Intermediate" },
            { id: 2, title: "DNA Replication", topic: "Genetics", difficulty: "Advanced" },
            { id: 3, title: "Protein Synthesis", topic: "Biochemistry", difficulty: "Beginner" },
            { id: 4, title: "Photosynthesis", topic: "Botany", difficulty: "Intermediate" },
            { id: 5, title: "Mitochondria", topic: "Cell Biology", difficulty: "Advanced" },
            { id: 6, title: "Cell Membrane", topic: "Cell Biology", difficulty: "Beginner" }
        ];
    }

    console.log('Identifying topics with Amazon Nova...');
    const topicPrompt = `You are an expert biology and science educator. Analyze the following text extracted from a PDF document and identify the TOP 6 most important biology or science topics that would benefit from a 3D interactive visualization.

PDF TEXT (may be truncated):
"""${rawText.substring(0, 8000)}"""

Respond with ONLY valid JSON, no markdown fences. It must strictly follow this structure:
{"topics": [{"title": "Specfic sub-topic", "topic": "Broad category", "difficulty": "Intermediate"}]}
Each topic must be an object with title, topic, and difficulty properties.`;

    try {
        const topicResult = await callBedrock(topicPrompt, { maxOutputTokens: 250, temperature: 0.2 });
        let jsonStr = topicResult.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }
        const parsed = JSON.parse(jsonStr);
        return (parsed.topics || []).map((t: any, i: number) => ({
            id: i + 1,
            title: t.title,
            topic: t.topic || "Science",
            difficulty: t.difficulty || "Intermediate"
        }));
    } catch (e: any) {
        console.error('Failed to parse topic response:', e.message);
        return [
            { id: 1, title: "Cell Division", topic: "Biology", difficulty: "Intermediate" },
            { id: 2, title: "DNA Replication", topic: "Genetics", difficulty: "Advanced" },
            { id: 3, title: "Protein Synthesis", topic: "Biochemistry", difficulty: "Beginner" },
            { id: 4, title: "Photosynthesis", topic: "Botany", difficulty: "Intermediate" },
            { id: 5, title: "Mitochondria", topic: "Cell Biology", difficulty: "Advanced" },
            { id: 6, title: "Cell Membrane", topic: "Cell Biology", difficulty: "Beginner" }
        ];
    }
}

export async function generate3DWorld(topic: string, generatedDir: string) {
    const cleanTopic = topic.trim();
    if (!AWS_ENABLED) {
        // Fallback simulation
        const sampleFiles = fs.readdirSync(generatedDir).filter(f => f.endsWith('.html'));
        const sampleUrl = sampleFiles.length > 0 ? `/generated/${sampleFiles[0]}` : "/bioworld_glb_2x_no_learn_v2.html";
        return {
            needs3d: true,
            reason: 'Running in DEV mode — simulation.',
            title: cleanTopic,
            url: sampleUrl
        };
    }

    try {
        const classifyPrompt = `You are an expert educator. Given the topic: "${cleanTopic}", determine if it would benefit from a 3D interactive visualization for learning.
Respond with ONLY valid JSON, no markdown fences:
{"needs3d": true or false, "reason": "one line explanation", "title": "short title for the visualization"}`;

        const classifyResult = await callBedrock(classifyPrompt, { maxOutputTokens: 150, temperature: 0.1 });
        let classification;
        let jsonStr = classifyResult.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }
        classification = JSON.parse(jsonStr);

        if (!classification.needs3d) {
            return {
                needs3d: false,
                reason: classification.reason || 'This topic is better learned through text and diagrams.',
                title: classification.title || cleanTopic
            };
        }

        const generatePrompt = `You are an expert Three.js developer and educator. Generate a COMPLETE, STANDALONE HTML page that creates an interactive 3D visualization to teach: "${cleanTopic}"

CRITICAL REQUIREMENTS:
1. Use Three.js via CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
2. Include OrbitControls inline (copy the essential OrbitControls code or implement basic orbit camera with mouse events)
3. Create relevant 3D objects with proper geometry, materials, and colors
4. Add TEXT LABELS using HTML overlay divs (not 3D text) to label important parts
5. Add SMOOTH ANIMATIONS that demonstrate the concept
6. Create an INFO PANEL (HTML overlay, top-left) hidden by default via hover toggle
7. Make objects CLICKABLE — tooltip with info
8. Dark background (#0a0a1a) with neon theme
12. The page must work completely standalone

RESPOND WITH ONLY THE COMPLETE HTML CODE. No markdown fences. Start with <!DOCTYPE html> and end with </html>.`;

        const htmlResult = await callBedrock(generatePrompt, { maxOutputTokens: 1800, temperature: 0.1 });
        let html = htmlResult.trim();
        if (html.startsWith('```')) {
            html = html.replace(/```html?\n?/g, '').replace(/```$/g, '').trim();
        }

        if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
            throw new Error('Generated content does not look like HTML');
        }

        const fileId = `learn_${Date.now()}`;
        const filePath = path.join(generatedDir, `${fileId}.html`);
        fs.writeFileSync(filePath, html, 'utf8');

        return {
            needs3d: true,
            url: `/generated/${fileId}.html`,
            title: classification.title || cleanTopic,
            reason: classification.reason || ''
        };
    } catch (e: any) {
        console.error('Error generating 3D world:', e.message);
        // simulation fallback
        return {
            needs3d: true,
            url: "/bioworld_glb_2x_no_learn_v2.html",
            title: cleanTopic,
            reason: 'Fallback to base world due to error.'
        };
    }
}

export async function generateQuizForTopic(topic: string, userId: string) {
    if (!AWS_ENABLED) {
        return getDefaultQuiz(topic);
    }

    const prompt = `Generate a 3-question multiple choice quiz testing the user's knowledge about: "${topic}".
Output MUST be ONLY valid JSON in this format, with no markdown fences or extra wrapper:
[{"question": "Q1 text?", "options": ["Option 1 text", "Option 2 text", "Option 3 text", "Option 4 text"], "correctAnswer": "Option 1 text"}, ...]
CRITICAL: The 'correctAnswer' MUST be the exact full text of the correct option, not just the letter A/B/C/D.`;

    try {
        const result = await callBedrock(prompt, { maxOutputTokens: 500, temperature: 0.3 });
        let jsonStr = result.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Quiz generation failed, using defaults", e);
        return getDefaultQuiz(topic);
    }
}

function getDefaultQuiz(topic: string) {
    return [
        {
            question: `What is a key fundamental concept to understand about ${topic}?`,
            options: ["The structural integrity", "The main mechanism of action", "Its interaction with biological systems", "All of the above"],
            correctAnswer: "All of the above"
        },
        {
            question: `In the context of ${topic}, what primarily drives the system?`,
            options: ["Cellular energy", "Chemical gradients", "External forces", "Genetic coding"],
            correctAnswer: "Cellular energy"
        },
        {
            question: `Why is ${topic} important in modern science?`,
            options: ["It helps us understand basic biology", "It is purely theoretical", "It has no real-world application", "It is only relevant for physics"],
            correctAnswer: "It helps us understand basic biology"
        }
    ];
}
