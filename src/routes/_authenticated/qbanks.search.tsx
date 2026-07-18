import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Copy, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { searchQuestions } from "@/lib/qbank.functions";
import { rewriteMedia } from "@/lib/media";

export const Route = createFileRoute("/_authenticated/qbanks/search")({
  component: SearchPage,
});

type SearchResult = {
  id: number;
  title: string;
  question: string;
  correctAnswer: number;
  subject: string;
  system: string;
  answers: { answer_index: number; answer_text: string }[];
};

function SearchPage() {
  const searchFn = useServerFn(searchQuestions);
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState("USMLE Step 2 CK");

  const mutation = useMutation({
    mutationFn: async (q: string) => searchFn({ data: { query: q } }) as Promise<{ results: SearchResult[]; total: number; truncated: boolean }>,
  });

  const results = mutation.data?.results ?? [];

  const runSearch = () => {
    if (!query.trim()) {
      toast.error("Enter a question ID or keyword");
      return;
    }
    mutation.mutate(query);
  };

  const copyIds = () => {
    const ids = results.map((r) => r.id).join(", ");
    navigator.clipboard.writeText(ids);
    toast.success(`Copied ${results.length} IDs`);
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-[#1e3a8a]">Search Questions</h1>
        <p className="text-muted-foreground text-sm mt-1">Find questions by ID or keywords from your question bank</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-5 mb-4">
        <div className="grid gap-4 md:grid-cols-[1fr_240px_auto] items-end">
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Enter Question ID or Keywords</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                placeholder="Type to search..."
                className="w-full pl-9 pr-3 py-2.5 border rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Course</label>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="w-full mt-1 py-2.5 px-3 border rounded-md bg-white"
            >
              <option>USMLE Step 2 CK</option>
            </select>
          </div>
          <button
            onClick={runSearch}
            disabled={mutation.isPending}
            className="h-11 px-6 rounded-full bg-[#1e3a8a] text-white font-semibold flex items-center gap-2 hover:bg-[#2a4ba0] disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6 flex gap-3">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
          <li>Search can generate up to a maximum of 200 questions. To generate more questions, please refine your search criteria.</li>
          <li>Questions viewed through Search will have their correct answers revealed. To practice these questions unanswered, copy the question IDs using the "Copy IDs" button and use them to generate a custom quiz.</li>
        </ol>
      </div>

      {mutation.isPending && (
        <div className="text-center py-12 text-slate-500">Searching...</div>
      )}

      {mutation.isSuccess && results.length === 0 && (
        <div className="text-center py-12 text-slate-500">No questions found.</div>
      )}

      {results.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{results.length}</span> question{results.length === 1 ? "" : "s"} found
              {mutation.data?.truncated && <span className="text-amber-600 ml-2">(showing first 200)</span>}
            </div>
            <button
              onClick={copyIds}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-medium hover:bg-[#2a4ba0]"
            >
              <Copy className="h-4 w-4" /> Copy IDs
            </button>
          </div>

          <div className="space-y-4">
            {results.map((r) => (
              <ResultCard key={r.id} r={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ResultCard({ r }: { r: SearchResult }) {
  return (
    <div className="bg-white border rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-semibold text-[#1e3a8a]">#{r.id}</span>
          {r.subject && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{r.subject}</span>}
          {r.system && <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">{r.system}</span>}
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(String(r.id));
            toast.success(`Copied ID ${r.id}`);
          }}
          className="text-xs text-slate-500 hover:text-[#1e3a8a] inline-flex items-center gap-1"
        >
          <Copy className="h-3 w-3" /> Copy ID
        </button>
      </div>
      {r.title && <div className="text-sm font-semibold text-slate-700 mb-2">{r.title}</div>}
      <div
        className="qbank-html text-sm text-slate-800 mb-3"
        dangerouslySetInnerHTML={{ __html: rewriteMedia(r.question ?? "") }}
      />
      <div className="space-y-1.5">
        {r.answers.map((a) => {
          const isCorrect = a.answer_index === r.correctAnswer;
          return (
            <div
              key={a.answer_index}
              className={`flex gap-2 items-start p-2 rounded border text-sm ${
                isCorrect ? "bg-green-50 border-green-300" : "bg-slate-50 border-slate-200"
              }`}
            >
              <span className={`font-semibold ${isCorrect ? "text-green-700" : "text-slate-500"}`}>
                {String.fromCharCode(65 + a.answer_index)}.
              </span>
              <span
                className={`qbank-html flex-1 ${isCorrect ? "text-green-900 font-medium" : "text-slate-700"}`}
                dangerouslySetInnerHTML={{ __html: rewriteMedia(a.answer_text ?? "") }}
              />
              {isCorrect && <span className="text-green-700 text-xs font-semibold">✓ Correct</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
