// ... (זה בדיוק ה-HomePage העשיר והמלא שיש לך עכשיו, רק שאנחנו מחליפים בפנים שורה קטנה)
sed -i 's/const \[unreadCount, setUnreadCount\] = useState(0);/const { unreadCount } = useAuth();/g' src/pages/HomePage.tsx
sed -i 's/checkUnreadNotifications();//g' src/pages/HomePage.tsx
