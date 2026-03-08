import React from "react";
import { motion } from "motion/react";
import { BookOpen, ArrowRight, CheckCircle2 } from "lucide-react";

interface TeachModeProps {
  mission: any;
  onExit: () => void;
}

export function TeachMode({ mission, onExit }: TeachModeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="fixed top-8 bottom-8 left-[18rem] w-[28rem] z-[100] bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[40px] flex flex-col overflow-hidden shadow-2xl"
    >
      <div className="p-6 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30 shrink-0">
            <BookOpen size={24} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight leading-tight">{mission.title}</h2>
            <p className="text-[10px] text-blue-400 uppercase tracking-[0.2em] font-bold mt-1">Teach Mode • Exploration Phase</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        <section className="space-y-4">
          <h3 className="text-lg font-bold tracking-tighter text-white/90">Core Concepts</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
              <h4 className="text-blue-400 font-bold uppercase tracking-widest text-[10px] mb-2">Concept 01</h4>
              <p className="text-white/80 leading-relaxed text-sm">
                This mission covers the fundamental principles of {mission.topic}.
                Understanding these basics is crucial for mastering the advanced simulations.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl">
              <h4 className="text-blue-400 font-bold uppercase tracking-widest text-[10px] mb-2">Concept 02</h4>
              <p className="text-white/80 leading-relaxed text-sm">
                Key takeaway: {mission.title} allows us to observe how complex systems interact in a controlled 3D environment.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-blue-500/5 border border-blue-500/20 rounded-[30px] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <BookOpen size={80} />
          </div>
          <h3 className="text-lg font-bold tracking-tight mb-2 relative z-10">Detailed Breakdown</h3>
          <div className="prose prose-invert max-w-none text-white/60 text-sm space-y-2 relative z-10">
            <p>
              In this phase, we analyze the structural components of the topic.
              The 3D environment you just navigated represents the spatial relationships between these concepts.
            </p>
          </div>
        </section>

        <div className="flex justify-center pt-2">
          <button
            onClick={onExit}
            className="w-full bg-blue-500 hover:bg-blue-400 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            Finish Learning
            <CheckCircle2 size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
