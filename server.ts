import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import fs from "fs";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import * as ragService from "./server/ragService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);
const JWT_SECRET = process.env.JWT_SECRET || "learnverse-secret-key";

// Configure Multer for PDF uploads
const upload = multer({ storage: multer.memoryStorage() });

// --- DynamoDB Initialization ---
const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  // endpoint: process.env.DYNAMODB_ENDPOINT // Uncomment for local DynamoDB
});
const db = DynamoDBDocumentClient.from(ddbClient);

const USERS_TABLE = "LearnverseUsers";
const ACTIVITIES_TABLE = "LearnverseActivities";

// Utility to create tables if they don't exist (useful for quick setup)
async function initDynamoDB() {
  try {
    await ddbClient.send(new CreateTableCommand({
      TableName: USERS_TABLE,
      KeySchema: [{ AttributeName: "username", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "username", AttributeType: "S" }],
      BillingMode: "PAY_PER_REQUEST"
    }));
    console.log(`Created DynamoDB table: ${USERS_TABLE}`);
  } catch (err: any) {
    if (err.name !== "ResourceInUseException") console.error("Error creating users table:", err);
  }

  try {
    await ddbClient.send(new CreateTableCommand({
      TableName: ACTIVITIES_TABLE,
      KeySchema: [
        { AttributeName: "username", KeyType: "HASH" },
        { AttributeName: "timestamp", KeyType: "RANGE" }
      ],
      AttributeDefinitions: [
        { AttributeName: "username", AttributeType: "S" },
        { AttributeName: "timestamp", AttributeType: "S" }
      ],
      BillingMode: "PAY_PER_REQUEST"
    }));
    console.log(`Created DynamoDB table: ${ACTIVITIES_TABLE}`);
  } catch (err: any) {
    if (err.name !== "ResourceInUseException") console.error("Error creating activities table:", err);
  }
}

// Call init on startup (Fire and forget, tables will be ready shortly after if new)
initDynamoDB();

app.use(express.json());

const generatedDir = path.join(__dirname, '..', 'AWS', 'generated');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}
app.use('/generated', express.static(generatedDir));

// Serve the 3D base world HTML directly from the AWS directory
const bioworldPath = path.join(__dirname, '..', 'AWS', 'bioworld_glb_2x.html');
app.get('/bioworld_glb_2x.html', (req, res) => {
  res.sendFile(bioworldPath);
});

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- API Routes ---

// Registration
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const existing = await db.send(new GetCommand({ TableName: USERS_TABLE, Key: { username } }));
    if (existing.Item) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const userId = uuidv4();
    await db.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        username,
        id: userId,
        password: hashedPassword,
        xp: 0,
        sessions_completed: 0,
        avg_score: 0
      }
    }));

    const token = jwt.sign({ id: userId, username }, JWT_SECRET);
    res.json({ token, user: { id: userId, username, xp: 0 } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.send(new GetCommand({ TableName: USERS_TABLE, Key: { username } }));
    const user = result.Item;

    if (user && await bcrypt.compare(password, user.password)) {
      const token = jwt.sign({ id: user.id, username }, JWT_SECRET);
      res.json({ token, user: { id: user.id, username, xp: user.xp || 0, sessions_completed: user.sessions_completed || 0, avg_score: user.avg_score || 0 } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

// Stats
app.get("/api/user/stats", authenticateToken, async (req: any, res) => {
  try {
    const result = await db.send(new GetCommand({ TableName: USERS_TABLE, Key: { username: req.user.username } }));
    const user = result.Item;

    const actResult = await db.send(new QueryCommand({
      TableName: ACTIVITIES_TABLE,
      KeyConditionExpression: "username = :u",
      ExpressionAttributeValues: { ":u": req.user.username },
      ScanIndexForward: false, // Descending order
      Limit: 5
    }));
    const activities = actResult.Items || [];

    res.json({ user, activities });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// Delete Profile
app.delete("/api/user/profile", authenticateToken, async (req: any, res) => {
  try {
    const actResult = await db.send(new QueryCommand({
      TableName: ACTIVITIES_TABLE,
      KeyConditionExpression: "username = :u",
      ExpressionAttributeValues: { ":u": req.user.username }
    }));
    const activities = actResult.Items || [];

    // Delete all user activities
    for (const act of activities) {
      await db.send(new DeleteCommand({ TableName: ACTIVITIES_TABLE, Key: { username: act.username, timestamp: act.timestamp } }));
    }

    // Delete user
    await db.send(new DeleteCommand({ TableName: USERS_TABLE, Key: { username: req.user.username } }));

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to delete profile" });
  }
});

// Document Processing Endpoint
app.post("/api/mission/process", authenticateToken, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const missions = await ragService.generateMissionsFromDocument(
      req.file.buffer,
      req.file.originalname
    );

    res.json({ missions });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to process document" });
  }
});

// Proxy 3D Simulation Generation to Backend Server on port 3000
app.post("/api/learn", authenticateToken, async (req: any, res) => {
  try {
    const backendRes = await fetch("http://localhost:3000/api/learn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await backendRes.json();
    res.status(backendRes.status).json(data);
  } catch (error) {
    console.error("Failed to proxy to 3D backend:", error);
    res.status(500).json({ error: "Failed to connect to simulation engine" });
  }
});


// Proxy PDF Upload to Backend Server on port 3000
app.post("/api/upload-pdf", authenticateToken, upload.single('pdf'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

    // Construct FormData for the backend
    const formData = new FormData();
    formData.append('pdf', new Blob([req.file.buffer]), req.file.originalname);

    const backendRes = await fetch("http://localhost:3000/api/upload-pdf", {
      method: "POST",
      body: formData
    });
    const data = await backendRes.json();
    res.status(backendRes.status).json(data);
  } catch (error) {
    console.error("Failed to proxy to 3D backend:", error);
    res.status(500).json({ error: "Failed to connect to simulation engine" });
  }
});

// Quiz Generation
app.post("/api/mission/quiz", authenticateToken, async (req: any, res) => {
  const { topic } = req.body;
  try {
    const quizData = await ragService.generateQuizForTopic(topic, req.user.id);
    res.json(quizData);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to generate quiz" });
  }
});

// Submit Quiz Score
app.post("/api/mission/submit", authenticateToken, async (req: any, res) => {
  const { score, title, reviewData } = req.body;
  const username = req.user.username;

  try {
    await db.send(new PutCommand({
      TableName: ACTIVITIES_TABLE,
      Item: {
        username,
        timestamp: new Date().toISOString(),
        activityId: uuidv4(),
        title,
        score,
        reviewData: reviewData || []
      }
    }));

    const actResult = await db.send(new QueryCommand({
      TableName: ACTIVITIES_TABLE,
      KeyConditionExpression: "username = :u",
      ExpressionAttributeValues: { ":u": username },
      ConsistentRead: true
    }));
    const allScores = (actResult.Items || []).map(a => a.score);
    const avg_score = allScores.reduce((a, b) => a + b, 0) / (allScores.length || 1);

    await db.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { username },
      UpdateExpression: "SET xp = if_not_exists(xp, :z) + :xInc, sessions_completed = if_not_exists(sessions_completed, :z) + :sInc, avg_score = :avg",
      ExpressionAttributeValues: {
        ":z": 0,
        ":xInc": score * 10,
        ":sInc": 1,
        ":avg": avg_score
      }
    }));

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to submit score" });
  }
});

// 3D World Generation
app.post("/api/learn", authenticateToken, async (req: any, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: "Topic is required" });

  try {
    const worldData = await ragService.generate3DWorld(topic, generatedDir);
    res.json(worldData);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: "Failed to generate 3D world" });
  }
});

// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LearnVerse server running on http://localhost:${PORT}`);
  });
}

startServer();
