import React from "react";
import { LayoutDashboard, Globe, LogOut, User } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  currentView: string;
  setView: (view: any) => void;
  onLogout: () => void;
}

export function Layout({ children, user, currentView, setView, onLogout }: LayoutProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "world", label: "Base World", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-emerald-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-white/5 bg-[#0f0f0f] z-50">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tighter text-emerald-500 italic">LearnVerse</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">AI-Powered 3D Learning</p>
        </div>

        <nav className="mt-8 px-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                currentView === item.id
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={20} className={cn(currentView === item.id ? "text-emerald-500" : "text-white/40 group-hover:text-white/60")} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <User size={16} className="text-emerald-500" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">{user?.xp} XP</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-400/5 transition-all"
          >
            <LogOut size={18} />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-64 min-h-screen">
        <div className={cn(
          "mx-auto transition-all duration-300",
          currentView === "world" ? "p-4 max-w-[1600px] h-[100vh]" : "p-8 max-w-7xl min-h-screen"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
}
