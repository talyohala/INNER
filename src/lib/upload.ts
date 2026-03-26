import { supabase } from '../context/AuthContext';
import toast from 'react-hot-toast';

export const uploadImage = async (file: File): Promise<string | null> => {
  try {
    // יצירת שם ייחודי לקובץ כדי שלא ידרסו אחד את השני
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // העלאה ל-Supabase
    const { error: uploadError } = await supabase.storage
      .from('inner-storage')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // קבלת הלינק הפומבי לתמונה
    const { data } = supabase.storage.from('inner-storage').getPublicUrl(filePath);
    return data.publicUrl;
    
  } catch (err: any) {
    console.error('Upload Error:', err);
    toast.error('שגיאה בהעלאת התמונה. וודא שהקובץ תקין.');
    return null;
  }
};
