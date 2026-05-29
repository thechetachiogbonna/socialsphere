import { useState, useCallback, useEffect, useRef, createContext, ReactNode, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import usePostStore from "@/stores/usePostStore";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AIResponse, Post } from "@/types";
import { Id } from "../../convex/_generated/dataModel";
import useCurrentUserStore from "@/stores/useCurrentUserStore";
import { toast } from "sonner";
import { generateImage } from "@/actions/ai";
import VoiceUI from "@/components/VoiceUI";

type INITIALAIACTIONCONTEXTTYPE = {
  runAI: (textInput: string) => Promise<void | AIResponse>
  lastResponse: AIResponse | null,
  loading: boolean,
  transcript: string,
  listening: boolean,
  aiIsSpeaking: boolean,
  startListening: () => void
  stopListening: () => void,
  resetTranscript: () => void,
  lazyMode: boolean,
  setLazyMode: (mode: boolean) => void,
  stopSpeaking: () => void
}

const INITIALAIACTION: INITIALAIACTIONCONTEXTTYPE = {
  runAI: async () => undefined,
  lastResponse: null,
  loading: false,
  transcript: "",
  listening: false,
  aiIsSpeaking: false,
  startListening: () => { },
  stopListening: () => { },
  resetTranscript: () => { },
  lazyMode: true,
  setLazyMode: () => { },
  stopSpeaking: () => { }
}

let isGloballyProcessing = false;
let lastGlobalTranscript = "";

const AIAction = createContext<INITIALAIACTIONCONTEXTTYPE>(INITIALAIACTION)

function AIActionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<AIResponse | null>(null);
  const aiIsSpeakingRef = useRef(false);

  const [lazyMode, setLazyMode] = useState(true);

  useEffect(() => {
    if (window === undefined) return;

    const mode = JSON.parse(localStorage.getItem("lazy-mode") ?? true.toString())
    setLazyMode(mode)
  }, [setLazyMode])

  const handleScroll = useCallback((action: string, amountPercent?: number) => {
    const scrollArea = document.getElementById("main-scroll-area");
    const amount = (scrollArea?.clientHeight || window.innerHeight) * (amountPercent || 0.8);

    if (scrollArea) {
      switch (action) {
        case "scroll_up":
          scrollArea.scrollTop -= amount;
          break;
        case "scroll_down":
          scrollArea.scrollTop += amount;
          break;
        case "scroll_to_top":
          scrollArea.scrollTop = 0;
          break;
        case "scroll_to_bottom":
          scrollArea.scrollTop = scrollArea.scrollHeight;
          break;
      }
    } else {
      // Global fallback
      window.scrollBy({ top: action.includes("up") ? -amount : amount, behavior: "smooth" });
    }
  }, []);

  const resetTranscriptRef = useRef<() => void>(() => { });

  const speak = useCallback((text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";

      aiIsSpeakingRef.current = true;
      SpeechRecognition.stopListening()

      async function simulateSpeech(text: string, delay = 380) {
        const words = `Speaking this text: ${text}`.split(" ");
        for (let i = 0; i < words.length; i++) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        if (aiIsSpeakingRef.current) {
          aiIsSpeakingRef.current = false;
          if (lazyMode) {
            SpeechRecognition.startListening({ continuous: true, language: "en-US" });
          } else {
            resetTranscriptRef.current();
          }
        }
      }

      // sometimes the web speech doesn't trigger the onend event, so we simulate it
      simulateSpeech(text);

      speechSynthesis.speak(utterance);

      utterance.onend = () => {
        aiIsSpeakingRef.current = false;
        if (lazyMode) {
          SpeechRecognition.startListening({ continuous: true, language: "en-US" });
        } else {
          resetTranscriptRef.current();
        }
      };

    }
  }, [lazyMode]);

  const { transcript, listening, resetTranscript } = useSpeechRecognition();
  resetTranscriptRef.current = resetTranscript;

  const { currentUser } = useCurrentUserStore();
  const {
    post,
    setPost,
    currentViewingPost,
    setIsGeneratingImage,
    setImageFile,
    setImageUrl,
    setImagePrompt,
    setImageGenerationError
  } = usePostStore();

  const toggleLikeMutation = useMutation(api.post.toggleLike);
  const toggleSaveMutation = useMutation(api.post.toggleSave);
  const handleComment = useMutation(api.post.comment);
  const handleDeletePost = useMutation(api.post.deletePost)

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      aiIsSpeakingRef.current = false;

      if (lazyMode) {
        SpeechRecognition.startListening({ continuous: true, language: "en-US" });
      } else {
        resetTranscriptRef.current();
      }
    }
  }, [lazyMode]);

  const runAI = useCallback(
    async (textInput: string) => {
      const getImage = async (prompt: string) => {
        setImageGenerationError(null)

        if (!prompt) {
          return toast.error("Please provide a prompt.")
        }

        setIsGeneratingImage(true)

        try {
          const response = await generateImage(prompt) as unknown as { result: Blob, error: string | null }

          if (response.error) {
            throw new Error(response.error)
          }

          setImageFile(response.result)
          const imageUrl = URL.createObjectURL(response.result)
          setImageUrl(imageUrl)
          toast.success("Image generated successfully.")
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed to generate image.")
          setImageGenerationError(error instanceof Error ? error.message : "Failed to generate image.")
        } finally {
          setIsGeneratingImage(false)
        }
      }

      if (!textInput) {
        speak("Please provide an input!");
        return {
          action: "unsupported",
          message: "Please provide an input!",
          response: "Please provide an input!"
        } as AIResponse;
      }

      if (isGloballyProcessing || textInput === lastGlobalTranscript || loading || aiIsSpeakingRef.current) {
        return;
      }

      isGloballyProcessing = true;
      lastGlobalTranscript = textInput;
      setLoading(true);

      try {
        const res = await fetch("/talk-to-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: textInput, currentPage: pathname, lastResponse }),
        });

        const parsed = (await res.json()) as AIResponse;

        console.log("AI response:", parsed);

        if (!currentViewingPost) return parsed;

        if ((pathname === "/" || pathname.startsWith("/post-details/")) && ["navigate", "like_post", "unlike_post", "save_post", "unsave_post", "comment"].includes(parsed.action)) {

          const likePost = (userId: Id<"users">, type: "like_post" | "unlike_post") => {
            const likes = currentViewingPost.likes;
            const alreadyLiked = likes.includes(userId);

            if (type === "like_post") {
              if (alreadyLiked) {
                parsed.response = "This post is already liked!";
              } else {
                toggleLikeMutation({ postId: currentViewingPost._id, userId });
              }
              return;
            }

            if (type === "unlike_post") {
              if (alreadyLiked) {
                toggleLikeMutation({ postId: currentViewingPost._id, userId });
              } else {
                parsed.response = "The post you are trying to unlike is not liked!";
              }
            }
          }

          const savePost = (userId: Id<"users">, type: "save_post" | "unsave_post") => {
            const saves = currentViewingPost.saves;
            const alreadySaved = saves.includes(userId);

            if (type === "save_post") {
              if (alreadySaved) {
                parsed.response = "This post is already saved!";
              } else {
                toggleSaveMutation({ postId: currentViewingPost._id, userId });
              }
              return;
            }

            if (type === "unsave_post") {
              if (alreadySaved) {
                toggleSaveMutation({ postId: currentViewingPost._id, userId });
              } else {
                parsed.response = "The post you are trying to unsave is not saved!";
              }
            }
          }

          if (!currentUser) {
            return parsed;
          }

          switch (parsed.action) {
            case "like_post":
              likePost(currentUser._id, "like_post")
              break;
            case "unlike_post":
              likePost(currentUser._id, "unlike_post")
              break;
            case "save_post":
              savePost(currentUser._id, "save_post")
              break;
            case "unsave_post":
              savePost(currentUser._id, "unsave_post")
              break;
            case "comment":
              handleComment({
                comment: {
                  userId: currentUser._id,
                  text: parsed.message
                },
                postId: currentViewingPost._id
              })
              break;
            case "delete_post":
              if (currentUser._id !== currentViewingPost.ownerId) {
                return;
              }

              handleDeletePost({
                postId: currentViewingPost._id,
                imageId: currentViewingPost.imageId as Id<"_storage">
              })
              break;
          }
        }

        if (pathname === "/create-post" && parsed.action === "create_post" && ["navigate", "create_post"].includes(parsed.action)) {
          const typingEffect = async (textOrArray: string | string[], field: string, isolatedFromPost = false) => {
            if (isolatedFromPost) {
              const newTextArray = (textOrArray as string).split("")
              let newText = "";

              for (let i = 0; i < newTextArray.length; i++) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                newText += newTextArray[i];

                setImagePrompt(newText)
              }

            } else {
              if (Array.isArray(textOrArray)) {
                let newArray: string[] = []

                for (const item of textOrArray) {
                  await new Promise((resolve) => setTimeout(resolve, 500));
                  newArray = [...newArray, item];

                  setPost({ ...post, [field]: newArray } as Pick<Post, "title" | "location" | "tags">)
                }

                setPost({ ...post, [field]: newArray } as Pick<Post, "title" | "location" | "tags">)
                return;
              }

              const newTextArray = textOrArray.split("")
              let newText = "";

              for (let i = 0; i < newTextArray.length; i++) {
                await new Promise((resolve) => setTimeout(resolve, 100));
                newText += newTextArray[i];

                setPost({ ...post, [field]: newText } as Pick<Post, "title" | "location" | "tags">)
              }

              setPost({ ...post, [field]: newText } as Pick<Post, "title" | "location" | "tags">)
            }
          }

          const scrollTitle = document.getElementById("scroll-title");
          const scrollLocation = document.getElementById("scroll-location");
          const scrollTags = document.getElementById("scroll-tags");

          scrollTitle?.scrollIntoView({ behavior: "smooth", block: "start" })
          await typingEffect(parsed.title, "title")

          try {
            await typingEffect(parsed.image_prompt, "imagePrompt", true)
            await getImage(parsed.image_prompt);
          } catch (error) {
            console.error("Error generating image from AI prompt:", error);
            toast.error("Error generating image from AI prompt.");
          }

          scrollLocation?.scrollIntoView({ behavior: "smooth", block: "center" })
          await typingEffect(parsed.location, "location")

          scrollTags?.scrollIntoView({ behavior: "smooth", block: "center" })
          await typingEffect(parsed.tags, "tags")
          scrollTags?.scrollIntoView({ behavior: "smooth", block: "end" })
        }

        if (parsed.action === "navigate") {
          if (parsed.destination === "post-details") {
            router.push(`/${parsed.destination}/${currentViewingPost._id}`);
          } else {
            router.push(`/${parsed.destination}`);
          }
        }

        if (["scroll_up", "scroll_down", "scroll_to_top", "scroll_to_bottom"].includes(parsed.action)) {
          const scrollAmount = "amount" in parsed ? (parsed as any).amount : undefined;
          handleScroll(parsed.action, scrollAmount);
        }

        if ("response" in parsed) {
          if (parsed.action === "delete_post" && currentUser?._id !== currentViewingPost.ownerId) {
            return speak("This post does not belong to you, you cannot delete it.");
          }

          if (!["scroll_up", "scroll_down", "scroll_to_top", "scroll_to_bottom"].includes(parsed.action)) {
            speak(parsed.response);
          }
        }

        setLastResponse(parsed);
        return parsed;
      } catch (error) {
        console.error("AI action failed", error);
        const fallback: AIResponse = {
          action: "unsupported",
          message: "AI parsing failed",
          response: "Something went wrong, please try again.",
        };
        speak(fallback.response);
        return fallback;
      } finally {
        isGloballyProcessing = false;
        setLoading(false);
        setTimeout(() => {
          lastGlobalTranscript = "";
        }, 1000);
      }
    },
    [pathname, router, toggleLikeMutation, toggleSaveMutation, handleComment, handleDeletePost, currentUser, post, setPost, lastResponse, lazyMode, currentViewingPost, loading, setIsGeneratingImage, setImageFile, setImageUrl, setImagePrompt, resetTranscript, handleScroll, speak]
  );

  const startListening = () =>
    SpeechRecognition.startListening({ continuous: true, language: "en-US" });
  const stopListening = () => SpeechRecognition.stopListening();

  useEffect(() => {
    if (!lazyMode) return;

    if (!transcript && !listening && !loading && !aiIsSpeakingRef.current) {
      startListening()
    } else if (loading || aiIsSpeakingRef.current) {
      stopListening()
    }
  }, [loading, listening, transcript, lazyMode]);

  useEffect(() => {
    if (!lazyMode) return;

    let silenceTimer: NodeJS.Timeout | null = null;

    if (transcript && transcript.trim()) {
      if (silenceTimer) clearTimeout(silenceTimer);

      silenceTimer = setTimeout(() => {
        const text = transcript.trim();
        if (text) {
          runAI(text).finally(resetTranscript)
        }
      }, 2000);
    }

    return () => {
      if (silenceTimer) clearTimeout(silenceTimer);
    };
  }, [transcript, runAI, resetTranscript, lazyMode]);

  return (
    <AIAction.Provider
      value={{
        runAI,
        lastResponse,
        loading,
        transcript,
        listening,
        aiIsSpeaking: aiIsSpeakingRef.current,
        startListening,
        stopListening,
        resetTranscript,
        lazyMode,
        setLazyMode,
        stopSpeaking
      }}
    >
      {children}
      {/* <VoiceUI /> */}
    </AIAction.Provider>
  )
}

export default AIActionProvider;

export const useAIAction = () => useContext(AIAction)