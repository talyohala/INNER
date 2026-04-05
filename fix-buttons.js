const fs = require('fs');
const path = 'src/pages/CirclePage.tsx';

let code = fs.readFileSync(path, 'utf8');

const regex = /<div className="flex justify-between items-center mt-2 border-t border-white\/\[0\.05\] pt-3">[\s\S]*?<\/Button>\s*<\/div>/;

const replacement = `<div className="flex justify-end items-center gap-3 mt-2 border-t border-white/[0.05] pt-3">
                  <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-brand-muted hover:text-brand border border-white/[0.05] transition-all active:scale-95 shadow-md">
                    <Paperclip size={18} />
                  </button>
                  <button onClick={handlePost} disabled={posting || (!newPost.trim() && !selectedFile)} className="w-10 h-10 rounded-full bg-accent-primary text-surface flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-accent-primary/20">
                    {posting ? <Loader2 size={16} className="animate-spin text-surface" /> : <Send size={16} className="rtl:-scale-x-100 -ml-0.5" />}
                  </button>
                </div>`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(path, code);
  console.log("✅ Buttons updated successfully!");
} else {
  console.log("❌ Could not find the target code. Make sure you are in the right branch.");
}
