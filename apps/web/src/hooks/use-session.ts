export type MockSessionStatus = "authenticated" | "unauthenticated";

export interface MockSession {
  status: MockSessionStatus;
  user: {
    name: string;
    email: string;
  } | null;
}

const MOCK_SESSION: MockSession = {
  status: "unauthenticated",
  user: null
};

export function useSession(): MockSession {
  // Placeholder hook so the UI can be wired before auth exists.
  return MOCK_SESSION;
}


