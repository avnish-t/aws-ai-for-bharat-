import React, { useState } from "react";
import { motion } from "motion/react";
import { LogIn, UserPlus, ArrowRight } from "lucide-react";

interface AuthProps {
  onLogin: (user: any, token: string) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        onLogin(data.user, data.token);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tighter text-white italic mb-2">LearnVerse</h1>
          <p className="text-white/40 uppercase tracking-[0.3em] text-[10px]">The Future of Education</p>
        </div>

        <div className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-8 shadow-2xl">
          <div className="flex gap-4 mb-8 p-1 bg-white/5 rounded-2xl">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${isLogin ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${!isLogin ? 'bg-white/10 text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2 ml-1">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs text-center bg-red-400/10 py-2 rounded-xl border border-red-400/20">{error}</p>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Processing..." : (isLogin ? "Sign In" : "Create Account")}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        </div>

        <p className="text-center mt-8 text-white/20 text-xs">
          By continuing, you agree to our Terms of Service.
        </p>
      </motion.div>
    </div>
  );
}
