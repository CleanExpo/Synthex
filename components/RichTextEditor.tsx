'use client';

import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Code, 
  List, 
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCallback, useEffect } from 'react';
import { toast } from '@/hooks/useToast';

interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  showToolbar?: boolean;
  autoFocus?: boolean;
  minHeight?: string;
  maxHeight?: string;
}

export function RichTextEditor({
  content = '',
  onChange,
  placeholder = 'Start writing...',
  className = '',
  editable = true,
  showToolbar = true,
  autoFocus = false,
  minHeight = '200px',
  maxHeight = '500px'
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit
    ],
    content,
    editable,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-invert max-w-none focus:outline-none',
          'prose-headings:text-white prose-p:text-gray-300',
          'prose-strong:text-white prose-em:text-gray-300',
          'prose-ul:text-gray-300 prose-ol:text-gray-300',
          'prose-blockquote:text-gray-400 prose-code:text-purple-400',
          'min-h-[200px] p-4',
          className
        )
      }
    }
  });
  
  // Update content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);
  
  // Toolbar button component
  const ToolbarButton = ({ 
    onClick, 
    active = false, 
    disabled = false, 
    children, 
    tooltip 
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    tooltip?: string;
  }) => (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 w-8 p-0',
        active && 'bg-white/10 text-purple-400'
      )}
      title={tooltip}
    >
      {children}
    </Button>
  );
  
  // Insert link
  const setLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    
    if (url === null) return;
    
    if (url === '') {
      // Link extension not installed
      toast.error('Link feature not available');
      return;
    }
    
    // Link extension not installed
    toast.error('Link feature not available');
  }, [editor]);
  
  // Insert image
  const addImage = useCallback(() => {
    if (!editor) return;
    
    const url = window.prompt('Image URL');
    if (url) {
      // Image extension not installed
      toast.error('Image feature not available');
    }
  }, [editor]);
  
  // Word count
  const wordCount = editor?.storage.characterCount?.words() || 0;
  const charCount = editor?.storage.characterCount?.characters() || 0;
  
  if (!editor) {
    return null;
  }
  
  return (
    <div className="glass-card rounded-lg overflow-hidden">
      {/* Toolbar */}
      {showToolbar && editable && (
        <div className="border-b border-white/10 p-2 flex flex-wrap items-center gap-1">
          {/* Text formatting */}
          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
              tooltip="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
              tooltip="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              active={editor.isActive('strike')}
              tooltip="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              active={editor.isActive('code')}
              tooltip="Code"
            >
              <Code className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          {/* Headings */}
          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              active={editor.isActive('heading', { level: 1 })}
              tooltip="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              active={editor.isActive('heading', { level: 2 })}
              tooltip="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              active={editor.isActive('heading', { level: 3 })}
              tooltip="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setParagraph().run()}
              active={editor.isActive('paragraph')}
              tooltip="Paragraph"
            >
              <Pilcrow className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          {/* Lists */}
          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              active={editor.isActive('bulletList')}
              tooltip="Bullet List"
            >
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              active={editor.isActive('orderedList')}
              tooltip="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              active={editor.isActive('blockquote')}
              tooltip="Quote"
            >
              <Quote className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          {/* Links & Media */}
          <div className="flex items-center gap-1 pr-2 border-r border-white/10">
            <ToolbarButton
              onClick={setLink}
              active={editor.isActive('link')}
              tooltip="Add Link"
            >
              <Link className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={addImage}
              tooltip="Add Image"
            >
              <Image alt="Embedded content" className="h-4 w-4" />
            </ToolbarButton>
          </div>
          
          {/* History */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().chain().focus().undo().run()}
              tooltip="Undo (Ctrl+Z)"
            >
              <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().chain().focus().redo().run()}
              tooltip="Redo (Ctrl+Shift+Z)"
            >
              <Redo className="h-4 w-4" />
            </ToolbarButton>
          </div>
        </div>
      )}
      
      {/* Editor */}
      <div 
        className="relative overflow-y-auto"
        style={{ minHeight, maxHeight }}
      >
        <EditorContent editor={editor} />
        
        {/* Bubble Menu */}
        {editor && editable && (
          <BubbleMenu 
            editor={editor} 
            tippyOptions={{ duration: 100 }}
            className="glass-card p-1 flex items-center gap-1 rounded-lg shadow-xl"
          >
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              active={editor.isActive('bold')}
            >
              <Bold className="h-3 w-3" />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              active={editor.isActive('italic')}
            >
              <Italic className="h-3 w-3" />
            </ToolbarButton>
            <ToolbarButton
              onClick={setLink}
              active={editor.isActive('link')}
            >
              <Link className="h-3 w-3" />
            </ToolbarButton>
          </BubbleMenu>
        )}
      </div>
      
      {/* Status bar */}
      {showToolbar && (
        <div className="border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span>{wordCount} words</span>
            <span>{charCount} characters</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'w-2 h-2 rounded-full',
              editable ? 'bg-green-400' : 'bg-gray-400'
            )} />
            <span>{editable ? 'Editing' : 'Read-only'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Minimal editor for comments, notes, etc.
export function SimpleEditor({
  content = '',
  onChange,
  placeholder = 'Write a comment...',
  className = '',
  autoFocus = false
}: {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false
      })
    ],
    content,
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-invert max-w-none focus:outline-none',
          'prose-p:text-gray-300 prose-p:my-1',
          'min-h-[60px] p-3',
          className
        )
      }
    }
  });
  
  if (!editor) return null;
  
  return (
    <div className="glass-input rounded-lg overflow-hidden">
      <EditorContent editor={editor} />
      <div className="border-t border-white/10 px-3 py-1 flex items-center gap-2">
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 w-6 p-0',
            editor.isActive('bold') && 'text-purple-400'
          )}
        >
          <Bold className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 w-6 p-0',
            editor.isActive('italic') && 'text-purple-400'
          )}
        >
          <Italic className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}