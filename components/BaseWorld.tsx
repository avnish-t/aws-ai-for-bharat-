import React, { useRef, useState, useEffect } from 'react';
import { Upload, BookOpen, CheckCircle } from 'lucide-react';

interface BaseWorldProps {
  worldUrl: string;
  missions: any[];
  completedMissions: Set<number>;
  onSelectMission: (mission: any) => void;
  onTopicsExtracted: (topics: string[]) => void;
  resetKey: number;
}

export function BaseWorld({ worldUrl, missions, completedMissions, onSelectMission, onTopicsExtracted, resetKey }: BaseWorldProps) {

  const isIndividualSim = worldUrl !== "/bioworld_glb_2x.html";
  const backendUrl = worldUrl || "/bioworld_glb_2x.html";

  // Listen for messages from the iframe (PDF upload completed in bioworld_glb_2x.html)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Ensure the message has the expected structure
      if (event.data && event.data.type === 'PDF_PROCESSED' && Array.isArray(event.data.topics)) {
        onTopicsExtracted(event.data.topics);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onTopicsExtracted]);

  return (
    <div className="h-[calc(100vh-6rem)] w-full rounded-[30px] overflow-hidden border border-white/10 relative bg-[#030c14] shadow-[0_0_50px_rgba(16,185,129,0.05)]">

      {/* ALWAYS render the 3D Base World iframe so it doesn't lose its state */}
      <iframe
        key={`baseworld-${resetKey}`}
        src="/bioworld_glb_2x.html"
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', zIndex: 0,
          opacity: isIndividualSim ? 0 : 1,
          visibility: isIndividualSim ? 'hidden' : 'visible',
          pointerEvents: isIndividualSim ? 'none' : 'auto'
        }}
        title="Base World"
      />

      {/* Render the Individual Simulation OVER the Base World without unmounting */}
      <iframe
        src={isIndividualSim ? worldUrl : "about:blank"}
        style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', zIndex: 5, backgroundColor: '#000',
          opacity: isIndividualSim ? 1 : 0,
          visibility: isIndividualSim ? 'visible' : 'hidden',
          pointerEvents: isIndividualSim ? 'auto' : 'none'
        }}
        title="Individual Simulation"
      />

      {/* Mission UI Overlay */}
      <div className={`absolute top-4 right-4 w-96 flex flex-col gap-4 pointer-events-none ${isIndividualSim ? 'z-[60]' : 'z-10'}`}>

        {/* Minimal Spacer if needed, Upload logic moved back to 3D Base World */}

        {/* Missions List */}
        {missions && missions.length > 0 && (
          <div className="bg-black/80 border border-white/10 p-5 rounded-3xl backdrop-blur-md pointer-events-auto h-auto max-h-[calc(100vh-14rem)] flex flex-col">
            <h3 className="text-white/60 font-bold mb-4 text-xs uppercase tracking-widest flex-shrink-0">Identified Missions</h3>
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 custom-scrollbar">
              {missions.map((m: any) => {
                const isCompleted = completedMissions.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => onSelectMission(m)}
                    className={`text-left p-4 rounded-2xl border transition-all shrink-0 ${isCompleted
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100 opacity-60'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-emerald-500/50 text-white'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-sm leading-tight">{m.title}</span>
                      {isCompleted && <CheckCircle size={16} className="text-emerald-500" />}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-emerald-500/70">{m.topic}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div >
  );
}

export default BaseWorld;