import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, Hash, Send, Plus, Paperclip, AtSign, X, Settings, Users } from "lucide-react";
import { format } from "date-fns";

interface Channel {
  id: string;
  name: string;
  name_ar: string | null;
  description: string;
  is_default: boolean;
}

interface Message {
  id: string;
  channel_id: string;
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

const ChatPage = () => {
  const { user, tenantId } = useAuth();
  const { isRTL } = useLanguage();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [content, setContent] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelNameAr, setNewChannelNameAr] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  const lang = isRTL ? "ar" : "en";

  // Fetch channels + members
  useEffect(() => {
    if (!tenantId) return;
    const fetch = async () => {
      const [channelsRes, membersRes] = await Promise.all([
        supabase
          .from("chat_channels")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("is_default", { ascending: false })
          .order("name"),
        supabase.from("profiles").select("id, full_name, email").eq("tenant_id", tenantId),
      ]);
      const ch = (channelsRes.data ?? []) as Channel[];
      setChannels(ch);
      setMembers(membersRes.data ?? []);
      if (ch.length > 0 && !activeChannelId) {
        setActiveChannelId(ch[0].id);
      }
    };
    fetch();
  }, [tenantId]);

  // Fetch messages for active channel
  useEffect(() => {
    if (!activeChannelId || !tenantId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("channel_id", activeChannelId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true })
        .limit(200);

      const memberMap = new Map(members.map((m) => [m.id, m.full_name]));
      setMessages(
        (data ?? []).map((m: any) => ({
          ...m,
          mentions: m.mentions ?? [],
          user_name: memberMap.get(m.user_id) ?? "Unknown",
        }))
      );
    };
    fetchMessages();

    // Realtime
    const channel = supabase
      .channel(`chat-${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        () => fetchMessages()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeChannelId, tenantId, members]);

  // Auto-scroll
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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

  const sendMessage = async () => {
    if (!content.trim() && !attachmentFile) return;
    if (!user || !tenantId || !activeChannelId) return;
    setSending(true);

    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      if (attachmentFile) {
        const path = `${user.id}/chat/${activeChannelId}/${Date.now()}_${attachmentFile.name}`;
        const { error } = await supabase.storage
          .from("collaboration-attachments")
          .upload(path, attachmentFile);
        if (error) throw error;
        const { data } = supabase.storage.from("collaboration-attachments").getPublicUrl(path);
        attachmentUrl = data.publicUrl;
        attachmentName = attachmentFile.name;
      }

      const { error } = await supabase.from("chat_messages").insert({
        tenant_id: tenantId,
        channel_id: activeChannelId,
        user_id: user.id,
        content: content.trim(),
        mentions: selectedMentions,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      });
      if (error) throw error;

      setContent("");
      setSelectedMentions([]);
      setAttachmentFile(null);
    } catch (err: any) {
      toast.error(err.message);
    }
    setSending(false);
  };

  const createChannel = async () => {
    if (!tenantId || !user || !newChannelName) return;
    try {
      const { data, error } = await supabase
        .from("chat_channels")
        .insert({
          tenant_id: tenantId,
          name: newChannelName.toLowerCase().replace(/\s+/g, "-"),
          name_ar: newChannelNameAr || null,
          description: newChannelDesc,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      setChannels((prev) => [...prev, data as Channel]);
      setActiveChannelId(data.id);
      setShowCreateChannel(false);
      setNewChannelName("");
      setNewChannelNameAr("");
      setNewChannelDesc("");
      toast.success(isRTL ? "تم إنشاء القناة" : "Channel created");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";
    messages.forEach((m) => {
      const d = format(new Date(m.created_at), "yyyy-MM-dd");
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, messages: [m] });
      } else {
        groups[groups.length - 1].messages.push(m);
      }
    });
    return groups;
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-120px)]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Channel sidebar */}
      <div className="w-64 border-e flex flex-col bg-muted/30">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">{isRTL ? "المحادثات" : "Chat"}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowCreateChannel(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveChannelId(ch.id)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/70 hover:bg-muted"
                }`}
              >
                <Hash className="h-4 w-4 shrink-0" />
                <span className="truncate">{lang === "ar" ? (ch.name_ar || ch.name) : ch.name}</span>
                {ch.is_default && (
                  <Badge variant="outline" className="text-[9px] ms-auto px-1">{isRTL ? "افتراضي" : "Default"}</Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
        {/* Members count */}
        <div className="border-t p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{members.length} {isRTL ? "عضو" : "members"}</span>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Channel header */}
        {activeChannel && (
          <div className="flex items-center gap-3 px-5 py-3 border-b">
            <Hash className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">
                {lang === "ar" ? (activeChannel.name_ar || activeChannel.name) : activeChannel.name}
              </h3>
              {activeChannel.description && (
                <p className="text-[11px] text-muted-foreground">{activeChannel.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-muted-foreground">
                <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">{isRTL ? "لا توجد رسائل بعد" : "No messages yet"}</p>
                <p className="text-xs mt-1">
                  {isRTL ? "ابدأ المحادثة!" : "Start the conversation!"}
                </p>
              </div>
            ) : (
              groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 my-4">
                    <Separator className="flex-1" />
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(group.date), "EEEE, MMM d")}
                    </span>
                    <Separator className="flex-1" />
                  </div>
                  {group.messages.map((msg) => (
                    <div key={msg.id} className="flex gap-3 py-1.5 hover:bg-muted/30 rounded-lg px-2 -mx-2 group">
                      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {getInitials(msg.user_name ?? "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold">{msg.user_name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        {msg.attachment_name && (
                          <a
                            href={msg.attachment_url ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
                          >
                            <Paperclip className="h-3 w-3" />
                            {msg.attachment_name}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>

        {/* Attachment indicator */}
        {attachmentFile && (
          <div className="flex items-center gap-2 px-5 py-2 bg-muted/30 border-t text-xs">
            <Paperclip className="h-3 w-3" />
            <span className="truncate">{attachmentFile.name}</span>
            <button onClick={() => setAttachmentFile(null)} className="ms-auto">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="p-4 border-t relative">
          {showMentions && filteredMentions.length > 0 && (
            <div className="absolute bottom-full mb-1 start-4 z-10 w-64 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto">
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
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size <= 10 * 1024 * 1024) setAttachmentFile(f);
                else if (f) toast.error("Max 10MB");
              }}
            />
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={
                isRTL
                  ? `رسالة في #${activeChannel?.name_ar || activeChannel?.name || ""}...`
                  : `Message #${activeChannel?.name || ""}...`
              }
              className="min-h-[44px] max-h-[120px] resize-none text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
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
              className="h-9 w-9 shrink-0"
              onClick={sendMessage}
              disabled={sending || (!content.trim() && !attachmentFile)}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Create Channel Dialog */}
      <Dialog open={showCreateChannel} onOpenChange={setShowCreateChannel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "إنشاء قناة جديدة" : "Create New Channel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{isRTL ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                <Input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} placeholder="e.g. marketing" />
              </div>
              <div>
                <Label>{isRTL ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                <Input value={newChannelNameAr} onChange={(e) => setNewChannelNameAr(e.target.value)} placeholder="مثال: التسويق" />
              </div>
            </div>
            <div>
              <Label>{isRTL ? "الوصف" : "Description"}</Label>
              <Input value={newChannelDesc} onChange={(e) => setNewChannelDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateChannel(false)}>
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={createChannel} disabled={!newChannelName}>
              <Plus className="h-4 w-4 me-1" />
              {isRTL ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;
