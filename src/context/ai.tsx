import { Agent, routeAgentRequest } from "agents";
import {
  withVoice,
  WorkersAIFluxSTT,
  WorkersAITTS,
  type VoiceTurnContext
} from "@cloudflare/voice";
import { streamText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";

interface Env {
  AI: Ai,
  VoiceAgent: DurableObjectNamespace
}

const VoiceAgent = withVoice(Agent);

export class MyAgent extends VoiceAgent<Env> {
  transcriber = new WorkersAIFluxSTT(this.env.AI);
  tts = new WorkersAITTS(this.env.AI);

  async onCallStart() {
    for (const connection of this.getConnections()) {
      await this.speak(
      connection,
        "Hello! I am your voice assistant. You can ask me to set reminders or have a chat!"
      );
    }
  }

  async speakReminder(payload: { message: string }) {
    await this.speakAll(`Reminder: ${payload.message}`);
  }

  async onTurn(transcript: string, context: VoiceTurnContext) {
    const ai = createWorkersAI({ binding: this.env.AI });

    const result = streamText({
      model: ai("@cf/cloudflare/gpt-oss-20b"),
      messages: [
        ...context.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content
        })),
        { role: "user" as const, content: transcript }
      ],
      tools: {
        set_reminder: tool({
          description: "Set a spoken reminder after a delay",
          inputSchema: z.object({
            message: z.string(),
            delay_seconds: z.number()
          }),
          execute: async ({ message, delay_seconds }) => {
            await this.schedule(delay_seconds, "speakReminder", { message });
            return { confirmed: true };
          }
        })
      },
      abortSignal: context.signal
    });

    return result.textStream;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (
      (await routeAgentRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;