import { useState, useEffect } from "react";
import { db } from "../config/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const useTheme = (username) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved || "dark";
  });

  useEffect(() => {
    if (username) {
      const loadTheme = async () => {
        try {
          const userThemeRef = doc(db, `users/${username}/preferences`, "theme");
          const snapshot = await getDoc(userThemeRef);
          if (snapshot.exists()) {
            const savedTheme = snapshot.data().value;
            setTheme(savedTheme);
            document.documentElement.setAttribute("data-theme", savedTheme);
          } else {
            document.documentElement.setAttribute("data-theme", theme);
          }
        } catch (error) {
          console.error("Error loading theme:", error);
          document.documentElement.setAttribute("data-theme", theme);
        }
      };
      loadTheme();
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [username, theme]);

  const toggleTheme = async () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    
    if (username) {
      try {
        const userThemeRef = doc(db, `users/${username}/preferences`, "theme");
        await setDoc(userThemeRef, { value: newTheme });
      } catch (error) {
        console.error("Error saving theme:", error);
      }
    }
  };

  return [theme, toggleTheme];
};

