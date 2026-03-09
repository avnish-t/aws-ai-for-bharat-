# 🌍 BioWorld — AWS AI-Powered 3D  Learning Game

An interactive 3D  learning game powered by **Amazon Bedrock (Nova Lite)**, **AWS DynamoDB**, and a React + Three.js frontend. Students upload  PDFs, which are analyzed by AI to generate interactive 3D simulations and adaptive quizzes.

---

## 🏗️ Architecture

```
Student uploads PDF
       ↓
server.ts (port 3001) — Express + Auth (JWT) + DynamoDB
       ↓
ragService.ts — Amazon Bedrock (Nova Lite) extracts topics
       ↓
server1.js (port 3000) — Generates 3D HTML simulations
       ↓
bioworld_glb_2x.html — Three.js 3D world rendered in browser
       ↓
Quiz.tsx — Bedrock-generated MCQ quiz with score tracking
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js v18+
- An AWS account with Bedrock and DynamoDB access
- A Google Gemini API key (for 3D simulation generation via `server1.js`)

### 1. Clone the repo
```bash
git clone https://github.com/your-username/aws-ai-for-bharat.git
cd aws-ai-for-bharat
```


### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Then open `.env` and fill in your values:
```env
# AWS (Bedrock + DynamoDB)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here

# Google Gemini (3D simulation generation)
GEMINI_API_KEY=your_gemini_api_key_here

# Auth
JWT_SECRET=any-random-secret-string
PORT=3001
```

### 4. Start the 3D simulation engine (Terminal 1)
```bash
node server1.js
# Runs on http://localhost:3000
```

### 5. Start the main server (Terminal 2)
```bash
npm run dev
# Runs on http://localhost:3001
```

### 6. Open the app
Visit **http://localhost:3001** in your browser.

---

## 📁 Project Structure

```
├── server.ts              # Main Express server (auth, DynamoDB, API routes)
├── ragService.ts          # AWS Bedrock integration (AI logic)
├── server1.js             # 3D simulation generation server
├── bioworld_glb_2x.html   # Main 3D  game (Three.js) (default -biology )
├── components/            # React UI components
│   ├── Auth.tsx           # Login / Register
│   ├── Dashboard.tsx      # User stats & mission map
│   ├── Quiz.tsx           # AI-generated quiz
│   └── MissionMap.tsx     # Mission selection
├── generated/             # AI-generated 3D HTML worlds (auto-created)
├── .env.example           # Environment variable template
└── package.json           # Dependencies
```

---

## 🎮 How It Works

1. **Register/Login** — JWT-based auth, user data stored in DynamoDB
2. **Upload a  PDF** — Bedrock extracts the top 6 topics
3. **Select a Mission** — Each topic becomes a playable mission
4. **Explore the 3D World** — Bedrock generates a custom Three.js simulation
5. **Take the Quiz** — Bedrock generates 3 MCQ questions on the topic
6. **Earn XP** — Scores are saved to DynamoDB, XP updates on the dashboard
