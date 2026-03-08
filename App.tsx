import React, { useState, useEffect } from "react";
import { Auth } from "./components/Auth";
import { Dashboard } from "./components/Dashboard";
import { BaseWorld } from "./components/BaseWorld";
import { Quiz } from "./components/Quiz";
import { TeachMode } from "./components/TeachMode";
import { Layout } from "./components/Layout";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, ArrowRight } from "lucide-react";

export type View = "dashboard" | "world" | "quiz";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [activeMission, setActiveMission] = useState<any>(null);
  const [isTeachMode, setIsTeachMode] = useState(false);
  const [worldUrl, setWorldUrl] = useState<string>("/bioworld_glb_2x.html");
  const [activeQuizTopic, setActiveQuizTopic] = useState<string>("");

  // Mission State
  const [missions, setMissions] = useState<any[]>([]);
  const [completedTeachMissions, setCompletedTeachMissions] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuizPrompt, setShowQuizPrompt] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (token) {
      fetch("/api/user/stats", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setUser(data.user);
          else logout();
        })
        .catch(() => logout());
    }
  }, [token]);

  const login = (userData: any, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("token", userToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    setMissions([]);
    setCompletedTeachMissions(new Set());
  };

  const handleTopicsExtracted = (topics: string[]) => {
    setIsProcessing(true);
    setShowQuizPrompt(false);

    // Map the string topics from the 3D world into mission objects 
    const newMissions = topics.map((topic, index) => ({
      id: Date.now() + index,
      title: topic.charAt(0).toUpperCase() + topic.slice(1),
      topic: topic
    }));

    setMissions(newMissions);
    setCompletedTeachMissions(new Set());
    setIsProcessing(false);
  };

  const handleSelectMission = async (mission: any) => {
    setActiveMission(mission);
    setIsTeachMode(true);

    try {
      const res = await fetch("/api/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ topic: mission.topic || mission.title })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.needs3d && data.url) {
          setWorldUrl(data.url);
        }
      }
    } catch (err) {
      console.error("Failed to auto-generate world:", err);
    }
  };

  const handleFinishTeach = () => {
    const newCompleted = new Set(completedTeachMissions);
    newCompleted.add(activeMission.id);
    setCompletedTeachMissions(newCompleted);
    setIsTeachMode(false);

    // Check if all missions are completed
    if (newCompleted.size === missions.length && missions.length > 0) {
      setShowQuizPrompt(true);
    }
  };

  const handleReturnToBaseWorld = () => {
    setWorldUrl("/bioworld_glb_2x.html");
    setIsTeachMode(false);
  };

  const handleRestartBaseWorld = () => {
    setWorldUrl("/bioworld_glb_2x.html");
    setIsTeachMode(false);
    setMissions([]);
    setCompletedTeachMissions(new Set());
    setShowQuizPrompt(false);
    setResetKey(prev => prev + 1);
  };

  if (!token) {
    return <Auth onLogin={login} />;
  }

  return (
    <Layout user={user} currentView={currentView} setView={setCurrentView} onLogout={logout}>
      <AnimatePresence>
        {isTeachMode && activeMission && (
          <TeachMode
            mission={activeMission}
            onExit={handleFinishTeach}
          />
        )}
      </AnimatePresence>

      {currentView === "dashboard" && (
        <Dashboard
          user={user}
          setView={setCurrentView}
          onLogout={logout}
          onRetakeQuiz={(title) => {
            setActiveQuizTopic(title);
            setCurrentView("quiz");
          }}
        />
      )}

      {currentView === "world" && (
        <div className="relative">
          <BaseWorld
            worldUrl={worldUrl}
            missions={missions}
            completedMissions={completedTeachMissions}
            onSelectMission={handleSelectMission}
            onTopicsExtracted={handleTopicsExtracted}
            resetKey={resetKey}
          />

          {/* Return to Base World Button (only shows when inside a simulation) */}
          <AnimatePresence>
            {worldUrl !== "/bioworld_glb_2x.html" && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={handleReturnToBaseWorld}
                className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-black/80 backdrop-blur-md border border-emerald-500/50 text-emerald-400 px-6 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-emerald-500/10 transition-all flex items-center gap-2"
              >
                ← Return to Base World
              </motion.button>
            )}
          </AnimatePresence>

          {/* Restart Base World Button (shows when missions exist) */}
          <AnimatePresence>
            {missions.length > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onClick={handleRestartBaseWorld}
                className="absolute bottom-6 left-6 z-50 bg-red-500/10 backdrop-blur-md text-red-400 border border-red-500/30 px-5 py-2.5 rounded-2xl font-bold shadow-lg hover:bg-red-500/20 hover:text-white transition-all text-sm"
              >
                Restart / Clear Missions
              </motion.button>
            )}
          </AnimatePresence>

          {/* Quiz Readiness Prompt */}
          <AnimatePresence>
            {showQuizPrompt && (
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg"
              >
                <div className="bg-emerald-500 text-black p-6 rounded-3xl shadow-2xl flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <p className="font-bold text-lg leading-none">Ready for Evaluation?</p>
                      <p className="text-black/70 text-sm mt-1">You've completed all teach modules.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowQuizPrompt(false);
                      const allTopics = missions.map(m => m.topic).filter((v, i, a) => a.indexOf(v) === i).join(", ");
                      setActiveQuizTopic(allTopics || "Comprehensive Assessment");
                      setCurrentView("quiz");
                    }}
                    className="bg-black text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-white/10 transition-all"
                  >
                    Start Quiz
                    <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {currentView === "quiz" && (
        <Quiz
          mission={{ title: activeQuizTopic || (missions[0] ? missions[0].title : "General Knowledge") }}
          token={token}
          onComplete={() => {
            setCurrentView("dashboard");
            setMissions([]);
            setCompletedTeachMissions(new Set());
          }}
        />
      )}
    </Layout>
  );
}
