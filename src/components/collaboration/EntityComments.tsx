import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Send, Paperclip, Reply, Trash2, AtSign, X, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface EntityCommentsProps {
  entityType: string; // 'invoice' | 'contract' | 'expense' | etc.
  entityId: string;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  mentions: string[];
  attachment_url: string | null;
  attachment_name: string | null;
  parent_id: string | null;
  is_edited: boolean;
  created_at: string;
  user_name?: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

const EntityComments = ({ entityType, entityId }: EntityCommentsProps) => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch comments + team members
  useEffect(() => {
    if (!tenantId || !entityId) return;

    const fetchData = async () => {
      const [commentsRes, membersRes] = await Promise.all([
        supabase
          .from("entity_comments")
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("entity_type", entityType)
          .eq("entity_id", entityId)
          .order("created_at", { ascending: true }),
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("tenant_id", tenantId),
      ]);

      const memberMap = new Map(
        (membersRes.data ?? []).map((m) => [m.id, m.full_name])
      );
      const enriched = (commentsRes.data ?? []).map((c: any) => ({
        ...c,
        mentions: c.mentions ?? [],
        user_name: memberMap.get(c.user_id) ?? "Unknown",
      }));
      setComments(enriched);
      setMembers(membersRes.data ?? []);
    };
    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel(`comments-${entityType}-${entityId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "entity_comments",
          filter: `entity_id=eq.${entityId}`,
        },
        () => fetchData()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenantId, entityType, entityId]);

  // Auto-scroll on new comments
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const filteredMentions = useMemo(
    () =>
      members.filter(
        (m) =>
          m.id !== user?.id &&
          (m.full_name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
            m.email.toLowerCase().includes(mentionFilter.toLowerCase()))
      ),
    [members, mentionFilter, user]
  );

  const handleMention = (member: TeamMember) => {
    setSelectedMentions((prev) => [...new Set([...prev, member.id])]);
    setContent((prev) => prev.replace(/@\w*$/, `@${member.full_name} `));
    setShowMentions(false);
    setMentionFilter("");
    textareaRef.current?.focus();
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    const match = value.match(/@(\w*)$/);
    if (match) {
      setShowMentions(true);
      setMentionFilter(match[1]);
    } else {
      setShowMentions(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(isRTL ? "الحد الأقصى 10 ميجابايت" : "Max 10MB file size");
        return;
      }
      setAttachmentFile(file);
    }
  };

  const sendComment = async () => {
    if (!content.trim() && !attachmentFile) return;
    if (!user || !tenantId) return;
    setSending(true);

    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      if (attachmentFile) {
        setUploading(true);
        const path = `${user.id}/${entityType}/${entityId}/${Date.now()}_${attachmentFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("collaboration-attachments")
          .upload(path, attachmentFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("collaboration-attachments")
          .getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
        attachmentName = attachmentFile.name;
        setUploading(false);
      }

      const { error } = await supabase.from("entity_comments").insert({
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
        user_id: user.id,
        content: content.trim(),
        mentions: selectedMentions,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        parent_id: replyTo?.id ?? null,
      });
      if (error) throw error;

      setContent("");
      setReplyTo(null);
      setSelectedMentions([]);
      setAttachmentFile(null);
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
    setSending(false);
  };

  const deleteComment = async (id: string) => {
    await supabase.from("entity_comments").delete().eq("id", id);
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  // Group comments by parent
  const rootComments = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parent_id === parentId);

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`flex gap-3 ${isReply ? "ms-8 mt-2" : ""}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
          {getInitials(comment.user_name ?? "")}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{comment.user_name}</span>
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(comment.created_at), "MMM d, HH:mm")}
          </span>
          {comment.is_edited && (
            <Badge variant="outline" className="text-[9px] px-1">{isRTL ? "معدل" : "edited"}</Badge>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
        {comment.attachment_name && (
          <a
            href={comment.attachment_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
          >
            <Paperclip className="h-3 w-3" />
            {comment.attachment_name}
          </a>
        )}
        <div className="flex items-center gap-2 mt-1">
          {!isReply && (
            <button
              onClick={() => setReplyTo(comment)}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Reply className="h-3 w-3" />
              {isRTL ? "رد" : "Reply"}
            </button>
          )}
          {comment.user_id === user?.id && (
            <button
              onClick={() => deleteComment(comment.id)}
              className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        {/* Replies */}
        {!isReply &&
          getReplies(comment.id).map((reply) => (
            <CommentItem key={reply.id} comment={reply} isReply />
          ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">
          {isRTL ? "التعليقات" : "Comments"}
        </span>
        <Badge variant="secondary" className="text-[10px]">{comments.length}</Badge>
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1 p-4 max-h-[400px]">
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {isRTL ? "لا توجد تعليقات بعد" : "No comments yet"}
            </p>
          ) : (
            rootComments.map((c) => <CommentItem key={c.id} comment={c} />)
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Reply indicator */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t text-xs">
          <Reply className="h-3 w-3" />
          <span>{isRTL ? "رد على" : "Replying to"} <strong>{replyTo.user_name}</strong></span>
          <button onClick={() => setReplyTo(null)} className="ms-auto">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Attachment indicator */}
      {attachmentFile && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-t text-xs">
          <Paperclip className="h-3 w-3" />
          <span className="truncate">{attachmentFile.name}</span>
          <button onClick={() => setAttachmentFile(null)} className="ms-auto">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t relative">
        {showMentions && filteredMentions.length > 0 && (
          <div className="absolute bottom-full mb-1 start-3 z-10 w-64 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredMentions.map((m) => (
              <button
                key={m.id}
                onClick={() => handleMention(m)}
                className="w-full text-start px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <span className="font-medium">{m.full_name}</span>
                <span className="text-muted-foreground ms-2 text-xs">{m.email}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={isRTL ? "اكتب تعليق... استخدم @ للإشارة" : "Write a comment... use @ to mention"}
              className="min-h-[44px] max-h-[120px] resize-none text-sm pe-16"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendComment();
                }
              }}
            />
          </div>
          <div className="flex gap-1">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                setShowMentions(true);
                setMentionFilter("");
                setContent((prev) => prev + "@");
                textareaRef.current?.focus();
              }}
            >
              <AtSign className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9"
              onClick={sendComment}
              disabled={sending || (!content.trim() && !attachmentFile)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityComments;
