import { useMemo } from "react";

type MockSession = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  businesses: Array<{
    id: string;
    name: string;
    status: "trial" | "active" | "paused";
  }>;
};

const MOCK_SESSION: MockSession = {
  user: {
    id: "user_123",
    name: "Jordan Patel",
    email: "jordan@tithi.com"
  },
  businesses: [
    { id: "biz_1", name: "Luminous Aesthetics", status: "active" },
    { id: "biz_2", name: "Elevate Fitness Studio", status: "trial" }
  ]
};

export function useMockSession() {
  return useMemo(() => MOCK_SESSION, []);
}

