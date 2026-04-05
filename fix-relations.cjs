const fs = require('fs');
const path = 'src/pages/CirclePage.tsx';
let code = fs.readFileSync(path, 'utf8');

// מחליף את כל הבקשות הכלליות לבקשות מדויקות לפי user_id
code = code.split('profiles(*), likes(user_id), comments(id)').join('profiles!user_id(*), likes(user_id), comments(id)');

fs.writeFileSync(path, code);
console.log('✅ Supabase relationships fixed successfully!');
