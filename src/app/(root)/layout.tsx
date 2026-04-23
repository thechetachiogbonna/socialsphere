"use client";

import Bottombar from "@/components/Bottombar";
import Header from "@/components/Header";
import LeftSidebar from "@/components/LeftSidebar";
import useCurrentUserStore from "@/stores/useCurrentUserStore";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import OnboardingModal from "@/components/OnboardingModal";
import RobotIcon from "@/components/RobotIcon";
import { usePathname } from "next/navigation";
import AIActionProvider from "@/context/AIAction";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { setCurrentUser } = useCurrentUserStore()
  const currentUser = useQuery(api.user.getForCurrentUser);
  const pathname = usePathname();

  useEffect(() => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        profile_pic_id: currentUser.profile_pic_id || undefined,
        cover_photo: currentUser.cover_photo || undefined,
        cover_photo_id: currentUser.cover_photo_id || undefined,
        bio: currentUser.bio || undefined,
        followers: currentUser.followers || [],
        following: currentUser.following || []
      });
    }
  }, [currentUser, setCurrentUser]);

  if (currentUser && !currentUser.bio) {
    return (
      <OnboardingModal
        isOpen={true}
        user={{
          ...currentUser,
          profile_pic_id: currentUser.profile_pic_id || undefined,
          cover_photo: currentUser.cover_photo || undefined,
          cover_photo_id: currentUser.cover_photo_id || undefined,
          bio: currentUser.bio || undefined,
          followers: currentUser.followers || [],
          following: currentUser.following || []
        }}
      />
    )
  }

  return (
    <AIActionProvider>
      <main className="max-w-screen-2xl mx-auto h-screen overflow-hidden flex">
        <Header />
        <LeftSidebar />
        <section id="main-scroll-area" className="flex-1 overflow-y-auto pt-[70px] max-md:pb-[100px] scroll-smooth">
          {children}
        </section>
        <Bottombar />
        {pathname !== "/" && <RobotIcon />}
      </main>
    </AIActionProvider>
  );
}