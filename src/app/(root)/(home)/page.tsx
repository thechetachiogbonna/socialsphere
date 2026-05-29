"use client";

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import PostCard from '@/components/PostCard';
import { useEffect, useRef } from 'react';
import { Post } from '@/types';
import usePostStore from '@/stores/usePostStore';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import HomeSkeleton from '@/components/skeletons/HomeSkeleton';
import VoiceUI from '@/components/VoiceUI';

function Home() {
  const posts = useQuery(api.post.getAllPosts)

  const { currentViewingPost, setCurrentViewingPost } = usePostStore()
  const postRefs = useRef<HTMLElement[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(et => {
        if (et.isIntersecting) {
          const post = et.target.getAttribute("data-post");
          if (post) {
            const p = JSON.parse(post) as Post
            setCurrentViewingPost(p)
          }
        }
      })
    }, {
      threshold: 0.5
    })

    postRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      postRefs.current.forEach(ref => {
        if (ref) observer.unobserve(ref)
      })
    }
  }, [posts, setCurrentViewingPost])

  if (!posts) {
    return <HomeSkeleton />
  }

  if (posts.length === 0) {
    return (
      <section className="flex justify-center items-center pb-36 md:pb-20 pt-10">
        <div className="flex flex-col items-center justify-center py-20 max-w-md">
          <FileText className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No posts yet</h3>
          <p className="text-gray-500 text-center mb-6">
            Be the first to share something with the community. Create your first post!
          </p>
          <Button asChild className="bg-blue-500 hover:bg-blue-600 text-white">
            <Link href="/create-post">
              Create Post
            </Link>
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="flex justify-center items-center pb-36 md:pb-20">
      <div className="flex flex-col gap-10 w-[500px]">

        <VoiceUI />

        {posts?.map((post, i) => {
          return (
            <PostCard
              ref={(el) => {
                postRefs.current[i] = el!;
              }}
              key={post._id}
              post={post}
              currentViewingPost={currentViewingPost!}
            />
          )
        })}
      </div>
    </section>
  );
}

export default Home;