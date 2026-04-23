"use client";

import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAIAction } from "@/context/AIAction";

export default function RobotIcon() {
  const pathname = usePathname()
  const { runAI, startListening, stopListening, transcript, listening, loading, aiIsSpeaking, resetTranscript, lazyMode, stopSpeaking } = useAIAction();

  const handleClick = () => {
    if (aiIsSpeaking) {
      stopSpeaking();
      return;
    }

    if (transcript || listening) {
      stopListening();
      runAI(transcript);
      resetTranscript()
    } else {
      startListening();
    }
  }

  let glow = "shadow-[0_0_18px_rgba(160,160,255,0.7)] text-indigo-400"; // idle
  if (listening) glow = "shadow-[0_0_20px_rgba(59,130,246,0.9)] text-blue-500"; // listening
  if (loading) glow = "shadow-[0_0_20px_rgba(234,179,8,0.9)] text-yellow-500"; // thinking
  if (!loading && aiIsSpeaking) glow = "shadow-[0_0_20px_rgba(34,197,94,0.9)] text-green-500"; // responded

  return (
    <div className={cn("absolute flex flex-col items-center gap-2", pathname === "/" ? "-left-12 -top-2" : "bottom-14 md:bottom-6 right-6")}>
      <motion.button
        onClick={handleClick}
        whileTap={{ scale: 0.9 }}
        animate={listening || aiIsSpeaking ? { y: [0, -3, 0] } : { y: 0 }}
        transition={{ repeat: listening || aiIsSpeaking ? Infinity : 0, duration: 1 }}
        className={`${pathname === "/" ? "p-1" : "p-5"} rounded-full bg-[#1A1A1A] cursor-pointer ${glow} transition-all relative ${((pathname === "/" && (listening || transcript)) || (!lazyMode && transcript)) ? "z-1000" : "z-20"}`}
        disabled={loading}
      >
        <Bot className={cn("", pathname === "/" ? "w-6 h-6" : "w-8 h-8")} />

        <motion.span
          className="absolute z-[1500] inset-0 rounded-full border-2 border-indigo-400"
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />

        {/* Listening ripple */}
        {listening && (
          <motion.span
            className="absolute z-[1500] inset-0 rounded-full border-2 border-blue-400"
            animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}

        {/* Thinking spinner */}
        {loading && (
          <motion.div
            className="absolute inset-0 border-4 border-yellow-400 border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </motion.button>

      {/* Talking dots */}
      {(!loading && aiIsSpeaking) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-1 text-green-400"
        >
          <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" />
          <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-150" />
          <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-300" />
        </motion.div>
      )}
    </div>
  );
}