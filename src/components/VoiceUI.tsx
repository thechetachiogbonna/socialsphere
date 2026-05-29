import { useVoiceAgent } from "@cloudflare/voice/react";

export default function VoiceUI() {
  const voiceAgentHost = process.env.NEXT_PUBLIC_VOICE_AGENT_HOST ?? "127.0.0.1:8787";

  const {
    status,
    transcript,
    interimTranscript,
    isMuted,
    error,
    connected,
    startCall,
    endCall,
    toggleMute,
  } = useVoiceAgent({
    agent: "VoiceAgent",
    host: voiceAgentHost,
  });

  return (
    <div>
      <p>Status: {status}</p>
      <p>Connected: {connected ? "yes" : "no"}</p>
      {error ? <p className="text-red-500">Error: {error}</p> : null}

      <button onClick={status === "idle" ? startCall : endCall}>
        {status === "idle" ? "Start Call" : "End Call"}
      </button>

      <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>

      {interimTranscript && (
        <p>
          <em>{interimTranscript}</em>
        </p>
      )}

      {transcript.map((msg, i) => (
        <p key={i}>
          <strong>{msg.role}:</strong> {msg.text}
        </p>
      ))}
    </div>
  );
}