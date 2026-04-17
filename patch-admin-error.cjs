const fs = require('fs');

const adminPath = 'src/pages/AdminPage.tsx';
if (fs.existsSync(adminPath)) {
  let content = fs.readFileSync(adminPath, 'utf8');
  
  const oldFetch = `const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_data');
      if (error) throw error;
      setAdminData(data as any);
    } catch (err) {
      toast.error('שגיאה בטעינת נתוני אדמין');
    } finally {
      setLoading(false);
    }
  };`;

  const newFetch = `const fetchAdminData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_admin_data');
      if (error) {
        console.error("Supabase Error:", error);
        toast.error(\`שגיאת שרת: \${error.message}\`, { duration: 5000 });
        return;
      }
      setAdminData(data as any);
    } catch (err: any) {
      console.error("App Error:", err);
      toast.error(\`תקלה: \${err.message || 'לא ידועה'}\`, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };`;

  // נחליף את הפונקציה הישנה בחדשה
  if (content.includes("toast.error('שגיאה בטעינת נתוני אדמין');")) {
     content = content.replace(/const fetchAdminData = async \(\) => \{[\s\S]*?finally \{\s*setLoading\(false\);\s*\}\s*\};/, newFetch);
     fs.writeFileSync(adminPath, content);
     console.log("✅ Admin error reporting updated!");
  } else {
     console.log("⚠️ Couldn't find the exact function, but it might already be updated.");
  }
}
