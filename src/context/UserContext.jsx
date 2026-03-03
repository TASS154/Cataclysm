import React, { createContext, useContext } from "react";

const UserContext = createContext(null);

export function UserProvider({ username, children }) {
  return (
    <UserContext.Provider value={{ username }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  return ctx;
}
