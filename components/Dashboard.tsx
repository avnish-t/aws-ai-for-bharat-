import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Zap, Target, BarChart3, Clock, ChevronRight, Trophy, Globe, Trash2, X, CheckCircle2, XCircle } from "lucide-react";

interface DashboardProps {
  user: any;
  setView: (view: any) => void;
  onLogout: () => void;
  onRetakeQuiz: (title: string) => void;
}

export function Dashboard({ user, setView, onLogout, onRetakeQuiz }: DashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [selectedReview, setSelectedReview] = useState<any>(null);

  const handleDeleteProfile = async () => {
    if (!confirm("Are you sure you want to delete your profile? This action cannot be undone.")) return;

    const token = localStorage.getItem("token");
    try {
      const res = await fetch("/api/user/profile", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        onLogout();
      }
    } catch (err) {
      console.error("Failed to delete profile:", err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/user/stats", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setStats(data));
  }, []);

  const cards = [
    { label: "Total XP", value: stats?.user?.xp || 0, icon: Zap, color: "text-amber-400", bg: "bg-amber-400/10" },
    { label: "Sessions", value: stats?.user?.sessions_completed || 0, icon: Target, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Avg Score", value: `${Math.round(((stats?.user?.avg_score || 0) / 3) * 100)}%`, icon: BarChart3, color: "text-blue-400", bg: "bg-blue-400/10" },
  ];

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-4xl font-bold tracking-tight mb-2">Welcome back, {user?.username}</h2>
        <p className="text-white/40">Your learning journey continues. Ready for your next mission?</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#0f0f0f] border border-white/5 p-6 rounded-3xl relative overflow-hidden group"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 ${card.bg} blur-3xl rounded-full -mr-12 -mt-12 transition-all group-hover:scale-150`} />
            <div className={`${card.bg} ${card.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border border-white/5`}>
              <card.icon size={24} />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">{card.label}</p>
            <p className="text-3xl font-bold tracking-tighter">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <section className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Clock size={20} className="text-white/40" />
              <h3 className="text-lg font-bold tracking-tight">Recent Activity</h3>
            </div>
            <Trophy size={20} className="text-emerald-500/50" />
          </div>

          <div className="space-y-4">
            {stats?.activities?.length > 0 ? (
              stats.activities.map((activity: any) => (
                <div key={activity.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div>
                    <p className="font-medium text-sm">{activity.title}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="text-emerald-400 font-bold text-sm">{activity.score * 10} XP</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Score: {activity.score}/3</p>
                    </div>
                    {activity.reviewData && activity.reviewData.length > 0 && (
                      <button
                        onClick={() => setSelectedReview(activity)}
                        className="bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-black py-2 px-4 rounded-xl text-xs font-bold transition-all"
                      >
                        Review
                      </button>
                    )}
                    <button
                      onClick={() => onRetakeQuiz(activity.title)}
                      className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black py-2 px-4 rounded-xl text-xs font-bold transition-all"
                    >
                      Retake
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-white/20">
                <p className="text-sm italic">No missions completed yet.</p>
              </div>
            )}
          </div>
        </section>

        {/* Quick Actions / Achievements */}
        <section className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 text-black relative overflow-hidden group cursor-pointer" onClick={() => setView("world")}>
            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
              <Globe size={120} />
            </div>
            <h3 className="text-2xl font-bold tracking-tighter mb-2">Start New Mission</h3>
            <p className="text-black/70 text-sm mb-6 max-w-[200px]">Explore new topics in interactive 3D environments.</p>
            <div className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-2xl font-bold text-sm">
              Launch World
              <ChevronRight size={18} />
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8">
            <h3 className="text-lg font-bold tracking-tight mb-6">Account Actions</h3>
            <button
              onClick={handleDeleteProfile}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <Trash2 size={18} />
                <span className="font-bold text-sm">Delete Profile</span>
              </div>
              <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>

          <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8">
            <h3 className="text-lg font-bold tracking-tight mb-6">Achievements</h3>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`aspect-square rounded-2xl flex items-center justify-center border border-white/5 ${i === 1 ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' : 'bg-white/5 text-white/10'}`}>
                  <Trophy size={24} />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-center text-white/20 uppercase tracking-widest mt-4 font-bold">1 / 12 Unlocked</p>
          </div>
        </section>
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {selectedReview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#0f0f0f] border border-white/10 w-full max-w-3xl max-h-[80vh] rounded-[40px] flex flex-col overflow-hidden shadow-2xl relative"
            >
              <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Quiz Review</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest mt-1">{selectedReview.title}</p>
                </div>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-all"
                >
                  <X size={20} className="text-white/60" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {selectedReview.reviewData?.map((item: any, idx: number) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-3xl p-6">
                    <p className="font-bold text-sm mb-4">Q{idx + 1}: {item.question}</p>
                    <div className="space-y-3">
                      <div className={`p-4 rounded-2xl border text-sm flex items-center justify-between ${item.isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-1">Your Answer</span>
                          <span className={item.isCorrect ? "text-emerald-400" : "text-red-400"}>{item.userAnswer === "TIMEOUT" ? "Out of Time" : item.userAnswer}</span>
                        </div>
                        {item.isCorrect ? <CheckCircle2 size={20} className="text-emerald-500" /> : <XCircle size={20} className="text-red-500" />}
                      </div>
                      {!item.isCorrect && (
                        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-sm flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-white/40 mb-1">Correct Answer</span>
                            <span className="text-white/80">{item.correctAnswer}</span>
                          </div>
                          <CheckCircle2 size={20} className="text-emerald-500/50" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
