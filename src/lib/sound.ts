// מנוע סאונד ורטט (Haptics) ללא תלות בקבצים חיצוניים
export const triggerFeedback = (type: 'pop' | 'coin' | 'success' | 'error') => {
  // בדיקה אם המשתמש כיבה את הסאונד בהגדרות
  if (localStorage.getItem('inner_sound') === 'false') return;

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.1) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    };

    switch (type) {
      case 'pop':
        // צליל פופ עדין (ללייקים וכפתורים)
        playTone(600, 'sine', 0.1, 0.2);
        break;
      case 'coin':
        // צליל מטבע כפול (לקרדיטים ומתנות)
        playTone(1200, 'sine', 0.1, 0.1);
        setTimeout(() => playTone(1600, 'sine', 0.15, 0.15), 100);
        break;
      case 'success':
        // צליל עליית רמה (Level Up)
        playTone(400, 'square', 0.1, 0.05);
        setTimeout(() => playTone(600, 'square', 0.1, 0.05), 100);
        setTimeout(() => playTone(800, 'square', 0.3, 0.05), 200);
        break;
      case 'error':
        // צליל שגיאה/באזז
        playTone(150, 'sawtooth', 0.2, 0.1);
        break;
    }

    // הפעלת רטט בטלפון אם אפשרי (Haptics)
    if (localStorage.getItem('inner_haptic') !== 'false' && navigator.vibrate) {
      if (type === 'pop') navigator.vibrate(10);
      if (type === 'coin') navigator.vibrate([10, 50, 10]);
      if (type === 'success') navigator.vibrate([20, 50, 20, 50, 30]);
      if (type === 'error') navigator.vibrate(50);
    }
  } catch (err) {
    // התעלמות משגיאות אם הדפדפן חוסם סאונד לפני אינטראקציה
  }
};
