import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Trash2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TiptapEditorWithMentions, processMentionsForDisplay } from '@/components/shared/TiptapEditorWithMentions';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  sourceItemId: string; // retro_items.id
}

export const TeamActionItemsComments: React.FC<Props> = ({ sourceItemId }) => {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [show, setShow] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from('retro_comments')
      .select('*, profiles(avatar_url, full_name)')
      .eq('item_id', sourceItemId)
      .order('created_at');
    setComments(data || []);
  };

  useEffect(() => {
    load();
    const channel = supabase.channel(`tai-comments-${sourceItemId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retro_comments', filter: `item_id=eq.${sourceItemId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sourceItemId]);

  const uploadImage = async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const addComment = async () => {
    if (!content.trim()) return;
    const author = profile?.full_name || user?.email || 'Anonymous';
    const { error } = await supabase
      .from('retro_comments')
      .insert([{ item_id: sourceItemId, text: content, author, author_id: user?.id || null }]);
    if (!error) setContent('');
  };

  const deleteComment = async (id: string) => {
    await supabase.from('retro_comments').delete().eq('id', id);
  };

  const canDelete = (c: any) => (user?.id && c.author_id === user.id);

  const makeImagesClickable = (htmlContent: string) => {
    return htmlContent.replace(
      /<img([^>]*?)src="([^\"]*?)"([^>]*?)>/g,
      '<img$1src="$2"$3 style="cursor: pointer;" data-clickable-image="$2">'
    );
  };

  const handleImageClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'IMG' && target.hasAttribute('data-clickable-image')) {
      const imageSrc = target.getAttribute('data-clickable-image');
      if (imageSrc) setSelectedImage(imageSrc);
    }
  };

  return (
    <div className="mt-2">
      <Button variant="ghost" size="sm" onClick={() => setShow(!show)} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
        <MessageSquare className="h-4 w-4" />
        {comments.length > 0 ? `${comments.length} comments` : 'Add comment'}
      </Button>
      {show && (
        <div className="mt-2 space-y-2">
          {comments.map((c) => (
            <Card key={c.id} className="bg-gray-50 dark:bg-gray-800">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <UserAvatar
                    name={c.profiles?.full_name ?? c.author}
                    avatarUrl={c.profiles?.avatar_url}
                    className="h-6 w-6"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-end">
                      {canDelete(c) && (
                        <Button variant="ghost" size="sm" onClick={() => deleteComment(c.id)} className="h-6 w-6 p-0 text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: processMentionsForDisplay(makeImagesClickable(c.text)) }} onClick={handleImageClick} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="space-y-2">
            <TiptapEditorWithMentions content={content} onChange={setContent} onSubmit={addComment} placeholder="Add a comment... (you can paste images)" uploadImage={uploadImage} />
            <div className="flex justify-end">
              <Button size="sm" onClick={addComment} disabled={!content.trim()}>
                <Send className="h-4 w-4 mr-2" />
                Add Comment
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          {selectedImage && (
            <img src={selectedImage} alt="Full size view" className="w-full h-full object-contain rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};


