import React, { useState } from "react";
import { motion } from "motion/react";
import { Upload, FileText, Play, CheckCircle2, AlertCircle } from "lucide-react";

interface MissionMapProps {
  onStartMission: (mission: any) => void;
}

export function MissionMap({ onStartMission }: MissionMapProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [missions, setMissions] = useState<any[]>([]);

  const handleUpload = () => {
    if (!file) return;
    setIsProcessing(true);
    
    // Simulate RAG pipeline processing
    setTimeout(() => {
      setMissions([
        { id: 1, title: "Quantum Mechanics Basics", topic: "Quantum Physics", difficulty: "Beginner" },
        { id: 2, title: "Wave-Particle Duality", topic: "Quantum Physics", difficulty: "Intermediate" },
        { id: 3, title: "Schrödinger's Equation", topic: "Quantum Physics", difficulty: "Advanced" },
      ]);
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-4xl font-bold tracking-tight mb-2">Mission Map</h2>
        <p className="text-white/40">Upload your study material to generate interactive missions.</p>
      </header>

      {/* Upload Section */}
      {!missions.length && (
        <div className="max-w-2xl mx-auto">
          <div 
            className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-white/20 bg-white/5'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
            }}
          >
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
              <Upload size={32} className={file ? 'text-emerald-500' : 'text-white/20'} />
            </div>
            
            {file ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-emerald-400">
                  <FileText size={18} />
                  <span className="font-medium">{file.name}</span>
                </div>
                <button 
                  onClick={handleUpload}
                  disabled={isProcessing}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-8 py-3 rounded-2xl transition-all disabled:opacity-50"
                >
                  {isProcessing ? "Processing PDF..." : "Generate Missions"}
                </button>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">Drag & drop your PDF here</p>
                <p className="text-white/40 text-sm mb-6">or click to browse from your computer</p>
                <input 
                  type="file" 
                  accept=".pdf" 
                  className="hidden" 
                  id="pdf-upload" 
                  onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                />
                <label 
                  htmlFor="pdf-upload"
                  className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-3 rounded-2xl transition-all cursor-pointer"
                >
                  Select File
                </label>
              </div>
            )}
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { label: "Textract", value: "30s", icon: CheckCircle2 },
              { label: "Bedrock", value: "RAG", icon: CheckCircle2 },
              { label: "Three.js", value: "3D", icon: CheckCircle2 },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 font-bold justify-center">
                <item.icon size={12} className="text-emerald-500/50" />
                <span>{item.label}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missions Grid */}
      {missions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {missions.map((mission, i) => (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#0f0f0f] border border-white/5 rounded-3xl p-6 hover:border-emerald-500/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <FileText size={80} />
              </div>
              
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-bold mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {mission.topic}
              </div>
              
              <h3 className="text-xl font-bold tracking-tight mb-2">{mission.title}</h3>
              <p className="text-white/40 text-sm mb-6">Difficulty: {mission.difficulty}</p>
              
              <button 
                onClick={() => onStartMission(mission)}
                className="w-full bg-white/5 hover:bg-emerald-500 hover:text-black border border-white/10 hover:border-emerald-500 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all"
              >
                <Play size={16} fill="currentColor" />
                Start Mission
              </button>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
