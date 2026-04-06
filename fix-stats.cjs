const fs = require('fs');
const path = 'src/pages/CirclePage.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /<div className="flex items-center gap-5 bg-surface-card backdrop-blur-xl[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*<\/div>/;

const replacement = `<div className="flex items-center gap-8 bg-surface-card backdrop-blur-xl rounded-full py-3.5 px-10 w-fit text-brand font-black justify-center border border-white/[0.05] shadow-2xl">
              <button 
                onClick={() => { openOverlay(() => setShowMembers(true)); fetchMembersList(); triggerFeedback('pop'); }} 
                className="flex flex-col items-center justify-center text-white hover:text-white/70 transition-colors active:scale-95 min-w-[64px]"
              >
                <span className="text-[18px] leading-none mb-1">{circle.members_count || 0}</span>
                <span className="text-[10px] text-brand-muted font-bold tracking-widest uppercase">חברים</span>
              </button>
              
              <div className="w-px h-10 bg-white/[0.08]"></div>
              
              <button 
                onClick={() => { openOverlay(() => setShowOnline(true)); triggerFeedback('pop'); }} 
                className="flex flex-col items-center justify-center text-green-400 hover:text-green-300 transition-colors active:scale-95 min-w-[64px]"
              >
                <span className="text-[18px] leading-none mb-1">{activeNow}</span>
                <span className="text-[10px] text-green-500/70 font-bold tracking-widest uppercase">אונליין</span>
              </button>
            </div>
          </div>
        </div>`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(path, code);
  console.log('✅ Stats section updated successfully!');
} else {
  console.log('❌ Could not find stats section.');
}
