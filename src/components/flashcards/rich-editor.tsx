import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline as UIcon, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Image as ImageIcon,
  Undo2, Redo2, Type,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

export function RichEditor({ value, onChange, placeholder, minHeight = 200 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(ref.current?.innerHTML ?? "");
  };

  const onInput = () => onChange(ref.current?.innerHTML ?? "");

  const addLink = () => {
    const url = prompt("URL");
    if (url) exec("createLink", url);
  };
  const addImage = () => {
    const url = prompt("Image URL");
    if (url) exec("insertImage", url);
  };
  const setBlock = (tag: string) => exec("formatBlock", tag);

  return (
    <div className="border rounded-md bg-white flex flex-col">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b bg-slate-50 rounded-t-md text-slate-700">
        <select
          onChange={(e) => setBlock(e.target.value)}
          defaultValue="P"
          className="text-xs border rounded px-1 py-0.5 mr-1"
        >
          <option value="P">Paragraph</option>
          <option value="H1">Heading 1</option>
          <option value="H2">Heading 2</option>
          <option value="H3">Heading 3</option>
          <option value="BLOCKQUOTE">Quote</option>
          <option value="PRE">Code</option>
        </select>
        <Btn onClick={() => exec("fontSize", "5")} title="Bigger text"><Type className="h-3.5 w-3.5" /><span className="text-[10px]">+</span></Btn>
        <Btn onClick={() => exec("fontSize", "2")} title="Smaller text"><Type className="h-3 w-3" /><span className="text-[10px]">-</span></Btn>
        <Sep />
        <Btn onClick={() => exec("bold")} title="Bold"><Bold className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => exec("italic")} title="Italic"><Italic className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => exec("underline")} title="Underline"><UIcon className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => exec("strikeThrough")} title="Strike"><Strikethrough className="h-3.5 w-3.5" /></Btn>
        <input
          type="color"
          title="Text color"
          onChange={(e) => exec("foreColor", e.target.value)}
          className="w-6 h-6 p-0 border rounded"
        />
        <input
          type="color"
          title="Highlight"
          onChange={(e) => exec("hiliteColor", e.target.value)}
          className="w-6 h-6 p-0 border rounded"
        />
        <Sep />
        <Btn onClick={() => exec("insertUnorderedList")} title="Bullets"><List className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => exec("insertOrderedList")} title="Numbers"><ListOrdered className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => exec("justifyLeft")} title="Left"><AlignLeft className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => exec("justifyCenter")} title="Center"><AlignCenter className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => exec("justifyRight")} title="Right"><AlignRight className="h-3.5 w-3.5" /></Btn>
        <Sep />
        <Btn onClick={addLink} title="Link"><LinkIcon className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={addImage} title="Image"><ImageIcon className="h-3.5 w-3.5" /></Btn>
        <Sep />
        <Btn onClick={() => exec("undo")} title="Undo"><Undo2 className="h-3.5 w-3.5" /></Btn>
        <Btn onClick={() => exec("redo")} title="Redo"><Redo2 className="h-3.5 w-3.5" /></Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        data-placeholder={placeholder}
        className="prose prose-sm max-w-none p-3 focus:outline-none text-sm text-slate-800 empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
        style={{ minHeight }}
      />
    </div>
  );
}

function Btn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} title={title} className="p-1 rounded hover:bg-slate-200">
      <span className="flex items-center">{children}</span>
    </button>
  );
}
function Sep() {
  return <span className="w-px h-4 bg-slate-300 mx-1" />;
}

export function stripHtml(html: string): string {
  const el = document.createElement("div");
  el.innerHTML = html || "";
  return el.textContent?.trim() ?? "";
}
