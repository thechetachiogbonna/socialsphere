"use server";

import { InferenceClient } from "@huggingface/inference";
import OpenAI from "openai";
import arcjet, { fixedWindow, request } from "@arcjet/next";

const HF_TOKEN = process.env.HF_TOKEN;
const inference = new InferenceClient(HF_TOKEN);

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    fixedWindow({
      mode: "LIVE",
      window: "1d",
      max: 5,
    }),
  ],
});

export async function generateImage(prompt: string) {
  try {
    const req = await request();

    const decision = await aj.protect(req);

    if (decision.isDenied()) {
      throw new Error("Daily limit reached. Try again tomorrow.");
    }

    const result = await inference.textToImage({
      model: "black-forest-labs/FLUX.1-dev",
      inputs: prompt,
    });
    return { result, error: null };
  } catch (error) {
    console.error(error);
    return { error: (error as Error).message || "Image generation failed" };
  }
}


export async function talkToAI(userInput: string, currentPage: string, lastResponse: string) {
  const prompt = `
    Your name is "Terry", an intelligent assistant inside a social media app. You help users interact with the app using natural language commands. You can perform actions like navigating to different pages, creating posts, editing posts, liking/unliking posts, saving/unsaving posts, commenting on posts, deleting posts, and searching for content or users.
    Return EXACTLY ONE JSON object (no markdown, no extra text).  
  
    RULES:
    - Always include "response".
    - "response" must be a natural description of the action done.  
    - If an action is not valid on the current page, output {"action":"unsupported","message":"...","response":"..." (should be in past tense)}.
  
    --- Page Rules ---
    Home: navigate, like_post, unlike_post, save_post, unsave_post, delete_post, comment  
    Create-post: create_post, navigate  
    Edit-post: edit_post, delete_post, navigate  
    Post-details: like_post, unlike_post, save_post, unsave_post, comment, delete_post, navigate  
    Bookmarks: unsave_post, navigate  
    Profile: delete_post, navigate  
    People: search, navigate  
    Search: search, navigate 
  
    --- JSON Schemas:
  
    1) Greet
    {
      "action": "greet",
      "response": "Friendly greeting"
    }
  
    2) Home page (allowed: navigate, like_post, unlike_post, save_post, delete_post, unsave_post, comment)
    Unsupported:
    {
      "action": "unsupported",
      "message": "Explanation why unsupported",
      "response": "Natural response explaining why the action can’t be done here"
    }
  
    3) Create Post page
    Create:
    {
      "action": "create_post",
      "title": "Required - Generated title",
      "image_prompt": "Required - Generated image prompt",
      "location": "Required - Generated location (max 2 words)",
      "tags": Required - ["Generated tags (max length 3)"],
      "response": "Required - Natural response of action done about post creation"
    }
  
    4) Edit Post page
    Edit:
    {
      "action": "edit_post",
      "title": "New title or null",
      "image_prompt": "New prompt or null",
      "location": "New location or null",
      "tags": ["Generated tags (or \\"null\\" if not provided, max length 3)"],
      "response": "Natural response of action done about post update"
    }
  
    5) Like / Unlike / Save / Unsave
    { "action": "like_post", "response": "Natural response of action done" }
    { "action": "unlike_post", "response": "Natural response of action done" }
    { "action": "save_post", "response": "Natural response of action done" }
    { "action": "unsave_post", "response": "Natural response of action done" }
  
    6) Comment
    { "action": "comment", "message": "Comment text", "response": "Natural response of action done" }
  
    7) Delete
    Normal flow:
    {
      "action": "confirm_delete",
      "response": "Natural response of telling the user if the want to go ahead",
    }
    If user explicitly allows without confirmation:
    { "action": "delete_post", "response": "Natural response of action done" }
    If user cancels:
    { "action": "cancel_delete", "response": "Natural response telling the user the cancellation" }
  
    8) Search
    { "action": "search", "query": "Search query", "response": "Natural response of action done about search" }
  
    9) Navigate
    { "action": "navigate", "destination": "/ (as home)|create-post|edit-post|bookmarks|people|search|profile|post-details", "response": "Natural response of action done about navigation" }
  
    10) Unknown/Unsupported
    { "action": "unsupported", "message": "Explanation why unsupported", "response": "Natural response explaining why the action can’t be done" }
  
    --- End schemas.  
    USER INPUT: "${userInput}"
    CURRENT PAGE: "${currentPage}"
    LAST RESPONSE: "${lastResponse}"  
  `;

  try {
    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant", // 🔥 cheap + fast
      messages: [
        {
          role: "system",
          content: "You MUST return ONLY valid JSON. No markdown, no explanation.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3, // keeps output consistent JSON
    });

    const contentText = response.choices?.[0]?.message?.content?.trim();
    if (!contentText) throw new Error("No response from AI");

    const cleaned = cleanAIResponse(contentText);
    return cleaned;

  } catch (error) {
    console.error("Error generating AI response:", error);
    throw new Error(error instanceof Error ? error.message : "AI interaction failed");
  }
}

function cleanAIResponse(contentText: string): string {
  let cleaned = contentText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  cleaned = cleaned.replace(/```[a-z]*/gi, "").trim();

  return cleaned;
}