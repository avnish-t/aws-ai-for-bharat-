import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, CheckCircle2, XCircle, Trophy, ArrowRight, Bot } from "lucide-react";

interface QuizProps {
  mission: any;
  token: string;
  onComplete: () => void;
}

export function Quiz({ mission, token, onComplete }: QuizProps) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [reviewData, setReviewData] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const fetchRef = useRef(false);

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;

    fetch("/api/mission/quiz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ topic: mission.title }),
    })
      .then((res) => res.json())
      .then((data) => {
        setQuestions(data);
        setLoading(false);
        setMessages([{
          type: "bot",
          text: `Welcome to the mission: **${mission.title}**. I've prepared a quiz to test your knowledge. You have 30 seconds for each question. Ready? Here's the first question:`
        }, {
          type: "bot",
          text: data[0]?.question || "No question found",
          options: data[0]?.options || [],
          isQuestion: true
        }]);
      });
  }, [mission, token]);

  // Timer Logic
  useEffect(() => {
    if (!loading && !isFinished && questions.length > 0) {
      const isQuestionActive = messages[messages.length - 1]?.isQuestion;

      if (isQuestionActive) {
        setTimeLeft(30);
        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current);
              handleAnswer("TIMEOUT"); // Auto-submit on timeout
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [messages.length, loading, isFinished]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleAnswer = (answer: string) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const currentQuestion = questions[currentIndex];
    const isTimeout = answer === "TIMEOUT";

    // Clean string comparison to combat hallucinated options text matching
    const cleanUser = String(answer).trim().toLowerCase().replace(/^([a-d][\.\)]\s*)/g, '');
    const cleanCorrect = String(currentQuestion.correctAnswer).trim().toLowerCase().replace(/^([a-d][\.\)]\s*)/g, '');
    const isCorrect = !isTimeout && (cleanUser === cleanCorrect || cleanUser.includes(cleanCorrect) || cleanCorrect.includes(cleanUser));

    if (isCorrect) setScore(s => s + 1);

    setReviewData(prev => [...prev, {
      question: currentQuestion.question,
      userAnswer: answer,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect
    }]);

    setMessages(prev => {
      // Remove buttons from older questions to prevent click exploits
      const cleanPrev = prev.map(m => m.isQuestion ? { ...m, isQuestion: false } : m);
      return [
        ...cleanPrev,
        { type: "user", text: isTimeout ? "[Time Expired]" : answer },
        {
          type: "bot",
          text: isTimeout
            ? `Time's up! That counts as incorrect. The correct answer was: **${currentQuestion.correctAnswer}**.`
            : isCorrect ? "Correct! Well done." : `Not quite. The correct answer was: **${currentQuestion.correctAnswer}**.`,
          isFeedback: true,
          isCorrect
        }
      ];
    });

    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setMessages(prev => [...prev, {
          type: "bot",
          text: questions[nextIndex].question,
          options: questions[nextIndex].options,
          isQuestion: true
        }]);
      }, 2000);
    } else {
      setTimeout(() => {
        setIsFinished(true);
      }, 2000);
    }
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
    setReviewData([]);
    setMessages([{
      type: "bot",
      text: `Let's try again! You have 30 seconds for each question. Ready? Here's the first question:`
    }, {
      type: "bot",
      text: questions[0]?.question,
      options: questions[0]?.options || [],
      isQuestion: true
    }]);
  };

  const finishMission = async () => {
    await fetch("/api/mission/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ score, title: mission.title, reviewData }),
    });
    onComplete();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
        <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-white/40 uppercase tracking-[0.3em] text-xs animate-pulse">Loading mission evaluation...</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto bg-[#0f0f0f] border border-white/5 rounded-3xl p-10 text-center shadow-2xl my-10"
      >
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30">
          <Trophy size={48} className="text-emerald-500" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Quiz Results</h2>
        <p className="text-white/40 mb-8">You've finished the evaluation for {mission.title}.</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">Score</p>
            <p className="text-2xl font-bold">{score} / {questions.length}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">XP Earned</p>
            <p className="text-2xl font-bold text-emerald-400">+{score * 10}</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={finishMission}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            Finish & Save Progress
            <ArrowRight size={18} />
          </button>
          <button
            onClick={resetQuiz}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all"
          >
            Retake Quiz
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-6rem)] flex flex-col bg-[#0f0f0f] border border-white/5 rounded-[40px] overflow-hidden shadow-2xl my-2">
      {/* Header */}
      <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
            <Bot size={20} className="text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight">LearnVerse AI</h3>
            <p className="text-[10px] text-emerald-500 uppercase tracking-widest font-bold">Online • Mission Evaluation</p>
          </div>
        </div>
        <div className="text-right flex items-center gap-6">
          <div className="flex flex-col items-end">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Time Left</p>
            <p className={`text-xs font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-emerald-500'}`}>{timeLeft}s</p>
          </div>
          <div className="flex flex-col items-end">
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Progress</p>
            <p className="text-xs font-bold">{currentIndex + 1} / {questions.length}</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[90%] p-5 rounded-3xl ${msg.type === 'user'
                ? 'bg-emerald-500 text-black font-medium rounded-tr-none'
                : 'bg-white/5 border border-white/10 text-white rounded-tl-none'
                }`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>

                {msg.isQuestion && (
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    {msg.options.map((opt: string, j: number) => (
                      <button
                        key={j}
                        onClick={() => handleAnswer(opt)}
                        className="text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all text-xs"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/5 bg-white/5">
        <div className="flex gap-4">
          <input
            type="text"
            disabled
            placeholder="Select an option above..."
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm text-white/40 cursor-not-allowed"
          />
          <button disabled className="bg-white/10 text-white/20 p-3 rounded-2xl cursor-not-allowed">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
