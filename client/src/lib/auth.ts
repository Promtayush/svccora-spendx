export interface AuthUser {
  id: number | string;
  name: string | null;
  email: string;
  role: string;
}

export const getUser = (): AuthUser | null => {
  const storedUser = localStorage.getItem("user");

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    return null;
  }
};

export const getToken = (): string | null => localStorage.getItem("token");

export const setUser = (user: AuthUser): void => {
  localStorage.setItem("user", JSON.stringify(user));
};

export const logout = (): void => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const getFirstName = (name: string | null | undefined): string => {
  return name?.trim().split(/\s+/)[0] || "";
};
