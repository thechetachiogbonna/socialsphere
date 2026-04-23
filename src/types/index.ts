import { Id } from "../../convex/_generated/dataModel"

export interface User {
  _id: Id<"users">;
  _creationTime: number;
  clerk_userId: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  profile_pic: string;
  profile_pic_id: string | undefined;
  cover_photo: string | undefined;
  cover_photo_id: string | undefined;
  bio: string | undefined;
  followers: Id<"users">[];
  following: Id<"users">[];
}

export interface Post {
  _id: Id<"posts">
  _creationTime: number
  ownerId: Id<"users">
  title: string
  imageUrl: string
  imageId: string
  location: string
  tags: string[]
  likes: Id<"users">[]
  comments: {
    userId: Id<"users">
    text: string
  }[]
  saves: Id<"users">[]
  user: {
    username: string
    profileImage: string
    clerkId: string
    firstName: string
    lastName: string
  }
}

export type AIResponse =
  | { action: "greet"; response: string }
  | { action: "like_post"; response: string }
  | { action: "unlike_post"; response: string }
  | { action: "save_post"; response: string }
  | { action: "unsave_post"; response: string }
  | { action: "comment"; message: string; response: string }
  | { action: "delete_post"; response: string }
  | { action: "confirm_delete"; response: string }
  | { action: "cancel_delete"; response: string }
  | {
    action: "create_post";
    title: string;
    image_prompt: string;
    location: string;
    tags: string[];
    response: string;
  }
  | {
    action: "edit_post";
    title: string | null;
    image_prompt: string | null;
    location: string | null;
    tags: string[] | null;
    response: string;
  }
  | { action: "search"; query: string; response: string }
  | { action: "navigate"; destination: string; response: string }
  | { action: "scroll_up"; amount?: number; response: string }
  | { action: "scroll_down"; amount?: number; response: string }
  | { action: "scroll_to_top"; response: string }
  | { action: "scroll_to_bottom"; response: string }
  | { action: "unsupported"; message: string; response: string };