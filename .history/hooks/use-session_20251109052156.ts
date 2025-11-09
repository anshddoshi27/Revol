import { useMemo } from "react";

type FakeUser = {
  name: string;
  email: string;
  onboardingStep: number;
};

const fakeUser: FakeUser = {
  name: "Jordan Patel",
  email: "jordan@tithi.com",
  onboardingStep: 2,
};

export function useSession() {
  const session = useMemo(
    () => ({
      user: fakeUser,
      status: "authenticated" as const,
    }),
    []
  );

  return session;
}

