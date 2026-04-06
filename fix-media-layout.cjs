const fs = require('fs');
const path = 'src/pages/CirclePage.tsx';
let code = fs.readFileSync(path, 'utf8');

const startStr = "{/* התוכן העליון - עד הקצה */}";
const endStr = "/* עיצוב חכם לטקסט בלבד - רק כמה שהוא צריך, ולא נבלע */";

if (code.includes(startStr) && code.includes(endStr)) {
  const before = code.substring(0, code.indexOf(startStr));
  const after = code.substring(code.indexOf(endStr));

  const newLayout = `{/* התוכן העליון - עד הקצה */}
                  {hasMedia ? (
                    <div className="w-full relative cursor-pointer overflow-hidden bg-surface flex flex-col" onClick={() => openOverlay(() => { const vids = posts.filter((p: any) => p.media_url); setFullScreenMedia([post, ...vids.filter((v: any) => v.id !== post.id).sort(() => Math.random() - 0.5)]); setCurrentMediaIndex(0); })}>
                      {/* מדיה יושבת עד למטה, ביחס מלבני אלגנטי */}
                      {isVideo ? (
                        <FeedVideo src={post.media_url} className="w-full max-h-[400px] aspect-[4/5] object-cover" />
                      ) : (
                        <img src={post.media_url} loading="lazy" className="w-full max-h-[400px] aspect-[4/5] object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/500x500/1E1F22/333?text=Media+Unavailable'; }} />
                      )}
                      
                      {/* טקסט מולבש על גבי התמונה בתחתית (בלי קופסה נפרדת) */}
                      {post.content && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 pt-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end pointer-events-none">
                          <p onClick={(e) => { e.stopPropagation(); openOverlay(() => setActiveDescPost(post)); }} className="text-white text-[14px] font-medium leading-relaxed text-right line-clamp-2 w-full pr-1 cursor-pointer active:opacity-70 pointer-events-auto drop-shadow-md">
                            {post.content}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    `;

  fs.writeFileSync(path, before + newLayout + after);
  console.log('✅ Media layout and text overlay fixed successfully!');
} else {
  console.log('❌ Could not find the layout block to replace.');
}
