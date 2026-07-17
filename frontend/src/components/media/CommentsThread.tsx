'use client'

// B5 — Comments thread: list, post (optimistic), delete own

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Send, User } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AppImage } from '@/components/shared/AppImage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommentUser {
  id: string
  name: string
  avatar?: string | null
}

interface MediaComment {
  id: string
  user_id: string
  user: CommentUser
  body: string
  created_at: string
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const commentApi = {
  list: (mediaId: string) =>
    api.get(`/media/${mediaId}/comments`).then((r) => r.data.data.comments as MediaComment[]),
  create: (mediaId: string, body: string) =>
    api
      .post(`/media/${mediaId}/comments`, { body })
      .then((r) => r.data.data.comment as MediaComment),
  delete: (mediaId: string, commentId: string) =>
    api.delete(`/media/${mediaId}/comments/${commentId}`),
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ user }: { user: CommentUser }) {
  if (user.avatar) {
    return (
      <AppImage
        size="avatar"
        src={user.avatar}
        alt={user.name}
        className="rounded-full flex-shrink-0 border"
      />
    )
  }
  return (
    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border">
      <User className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
  )
}

// ─── Single comment ───────────────────────────────────────────────────────────

function CommentItem({
  comment,
  isOwn,
  onDelete,
}: {
  comment: MediaComment
  isOwn: boolean
  onDelete: (id: string) => void
}) {
  return (
    <div className={cn('flex gap-2 group', isOwn && 'flex-row-reverse')}>
      <Avatar user={comment.user} />
      <div className={cn('flex-1 min-w-0 space-y-0.5', isOwn && 'items-end flex flex-col')}>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium">{comment.user.name}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(comment.created_at).toLocaleString()}
          </span>
          {isOwn && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
              title="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <div
          className={cn(
            'text-sm bg-muted/50 rounded-lg px-3 py-2 inline-block max-w-[85%] text-left',
            isOwn && 'bg-primary/10'
          )}
        >
          {comment.body}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CommentsThreadProps {
  mediaId: string
  currentUserId?: string
}

export function CommentsThread({ mediaId, currentUserId }: CommentsThreadProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: comments, isLoading } = useQuery({
    queryKey: ['media-comments', mediaId],
    queryFn: () => commentApi.list(mediaId),
  })

  // Scroll to bottom on new comments
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments?.length])

  const postMut = useMutation({
    mutationFn: (body: string) => commentApi.create(mediaId, body),
    // Optimistic update
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ['media-comments', mediaId] })
      const previous = queryClient.getQueryData<MediaComment[]>(['media-comments', mediaId])

      const optimistic: MediaComment = {
        id: `optimistic-${Date.now()}`,
        user_id: currentUserId ?? 'me',
        user: { id: currentUserId ?? 'me', name: 'You' },
        body,
        created_at: new Date().toISOString(),
      }

      queryClient.setQueryData<MediaComment[]>(['media-comments', mediaId], (old = []) => [
        ...old,
        optimistic,
      ])

      return { previous }
    },
    onError: (_err, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['media-comments', mediaId], context.previous)
      }
      toast({ title: 'Failed to post comment', variant: 'destructive' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-comments', mediaId] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (commentId: string) => commentApi.delete(mediaId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-comments', mediaId] })
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  })

  const handlePost = () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    postMut.mutate(body)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handlePost()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Comment list */}
      <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">Loading comments…</p>
        )}
        {!isLoading && (!comments || comments.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
        )}
        {(comments ?? []).map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            isOwn={!!(currentUserId && c.user_id === currentUserId)}
            onDelete={(id) => deleteMut.mutate(id)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="border rounded-md overflow-hidden">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment… (⌘+Enter to post)"
          rows={3}
          className="w-full px-3 py-2 text-sm resize-none focus:outline-none bg-background"
        />
        <div className="flex justify-end px-2 py-1.5 border-t bg-muted/20">
          <Button
            size="sm"
            className="gap-1"
            onClick={handlePost}
            disabled={!draft.trim() || postMut.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            Post
          </Button>
        </div>
      </div>
    </div>
  )
}
