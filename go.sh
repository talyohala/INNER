#!/bin/bash
# בניית הפרויקט
npm run build && \
# סנכרון לאנדרואיד (APK ready)
npx cap sync android && \
# דחיפה לגיטהאב
git add . && \
git commit --allow-empty -m "Clean UI Update + APK Sync" && \
git push && \
# הפעלה של שרת הפיתוח
npm run dev
