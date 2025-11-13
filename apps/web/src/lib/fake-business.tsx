"use client";

import * as React from "react";

import {
  DEV_WORKSPACE_SEED,
  createWorkspaceFromOnboarding,
  deriveCustomersFromBookings,
  recomputeAnalytics,
  type BookingActionResponse,
  type FakeBusinessWorkspace,
  type FakeBooking,
  type FakeCustomer,
  type FakeBookingPolicyConsent,
  type GiftCardLedgerEntry,
  type GiftCardProgramState,
  type MoneyBoardAction,
  type WorkspaceSeedInput
} from "@/lib/admin-workspace";
import type {
  NotificationTemplate,
  PoliciesConfig,
  ServiceAvailability,
  ServiceCategory,
  StaffMember
} from "@/lib/onboarding-types";

export type BusinessSubscriptionStatus = "trial" | "active" | "paused" | "canceled";

export interface FakeBusiness {
  id: string;
  name: string;
  slug: string;
  bookingUrl: string;
  previewUrl: string;
  status: BusinessSubscriptionStatus;
  createdAt: string;
  trialEndsAt?: string;
  nextBillDate?: string;
}

interface FakeBusinessContextValue {
  business?: FakeBusiness;
  workspace?: FakeBusinessWorkspace;
  createBusiness: (business: FakeBusiness) => void;
  bootstrapWorkspace: (seed: WorkspaceSeedInput) => FakeBusinessWorkspace | undefined;
  loadSeedBusiness: (
    seed?: WorkspaceSeedInput,
    overrides?: Partial<FakeBusiness>
  ) => { business: FakeBusiness; workspace: FakeBusinessWorkspace };
  updateBusiness: (updates: Partial<FakeBusiness>) => void;
  updateWorkspace: (
    updater: (workspace: FakeBusinessWorkspace) => FakeBusinessWorkspace
  ) => void;
  setCatalog: (catalog: ServiceCategory[]) => void;
  setStaff: (staff: StaffMember[]) => void;
  setAvailability: (availability: ServiceAvailability[]) => void;
  setNotifications: (templates: NotificationTemplate[]) => void;
  setPolicies: (policies: PoliciesConfig) => void;
  setGiftCards: (program: GiftCardProgramState) => void;
  setPayment: (
    updater: (
      payment: FakeBusinessWorkspace["payment"]
    ) => FakeBusinessWorkspace["payment"]
  ) => void;
  setIdentity: (
    updater: (
      identity: FakeBusinessWorkspace["identity"]
    ) => FakeBusinessWorkspace["identity"]
  ) => void;
  performBookingAction: (
    bookingId: string,
    action: MoneyBoardAction
  ) => BookingActionResponse | undefined;
  copyAvailabilityTemplate: (templateId: string) => void;
  pasteAvailabilityTemplate: (serviceId: string) => void;
  clearAvailabilityClipboard: () => void;
  refreshAnalytics: () => void;
  recordPublicBooking: (payload: PublicBookingPayload) => FakeBooking | undefined;
  clearBusiness: () => void;
}

const STORAGE_KEY = "tithi.fakeBusiness.v1";

export interface PublicBookingPayload {
  serviceId: string;
  staffId?: string | null;
  startDateTime: string;
  endDateTime: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  consent: FakeBookingPolicyConsent;
  giftCard?: {
    code: string;
    amountCents: number;
  };
  paymentMethod: string;
  requiresAction?: boolean;
}

const FakeBusinessContext = React.createContext<FakeBusinessContextValue | undefined>(
  undefined
);

export function FakeBusinessProvider({ children }: { children: React.ReactNode }) {
  const [business, setBusiness] = React.useState<FakeBusiness | undefined>(undefined);
  const [workspace, setWorkspace] = React.useState<FakeBusinessWorkspace | undefined>(undefined);
  const [hasHydratedFromStorage, setHasHydratedFromStorage] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored) as {
        business?: FakeBusiness & { previewUrl?: string };
        workspace?: FakeBusinessWorkspace;
      };
      const storedBusiness = parsed.business
        ? {
            ...parsed.business,
            previewUrl: parsed.business.previewUrl ?? `/public/${parsed.business.slug}`
          }
        : undefined;
      if (storedBusiness) {
        setBusiness((existing) => existing ?? storedBusiness);
      }
      if (parsed.workspace) {
        setWorkspace((existing) => existing ?? parsed.workspace);
      }
    } catch (error) {
      console.warn("[FakeBusinessProvider] Failed to hydrate from storage", error);
    } finally {
      setHasHydratedFromStorage(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedFromStorage) return;
    if (business && workspace) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          business,
          workspace
        })
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [business, workspace, hasHydratedFromStorage]);

  const createBusiness = React.useCallback((payload: FakeBusiness) => {
    setBusiness(payload);
  }, []);

  const updateBusiness = React.useCallback((updates: Partial<FakeBusiness>) => {
    setBusiness((existing) => (existing ? { ...existing, ...updates } : existing));
  }, []);

  const bootstrapWorkspace = React.useCallback(
    (seed: WorkspaceSeedInput): FakeBusinessWorkspace | undefined => {
      const workspaceSnapshot = createWorkspaceFromOnboarding(seed);
      setWorkspace(workspaceSnapshot);
      return workspaceSnapshot;
    },
    []
  );

  const updateWorkspace = React.useCallback(
    (updater: (workspace: FakeBusinessWorkspace) => FakeBusinessWorkspace) => {
      setWorkspace((existing) => {
        if (!existing) return existing;
        const updated = updater(existing);
        return updated;
      });
    },
    []
  );

  const setCatalog = React.useCallback(
    (catalog: ServiceCategory[]) => {
      updateWorkspace((existing) => ({
        ...existing,
        catalog,
        availabilityTemplates: existing.availabilityTemplates.map((template) => {
          const service = catalog
            .flatMap((category) => category.services)
            .find((service) => service.id === template.serviceId);
          return service
            ? { ...template, serviceName: service.name }
            : template;
        }),
        availability: existing.availability
          .map((entry) => {
            const service = catalog
              .flatMap((category) => category.services)
              .find((svc) => svc.id === entry.serviceId);
            if (!service) return entry;
            const assignedIds = new Set(service.staffIds);
            const filteredStaff = entry.staff.filter((slot) => assignedIds.has(slot.staffId));
            const missingStaff = service.staffIds
              .filter((id) => !filteredStaff.some((slot) => slot.staffId === id))
              .map((id) => ({
                staffId: id,
                slots: []
              }));
            return {
              ...entry,
              staff: [...filteredStaff, ...missingStaff]
            };
          })
          .filter((entry) =>
            catalog.some((category) => category.services.some((svc) => svc.id === entry.serviceId))
          )
      }));
    },
    [updateWorkspace]
  );

  const setStaff = React.useCallback(
    (staff: StaffMember[]) => {
      updateWorkspace((existing) => ({
        ...existing,
        staff,
        availabilityTemplates: existing.availabilityTemplates.map((template) => ({
          ...template,
          staffAssignments: template.staffAssignments.map((assignment) => {
            const member = staff.find((staffMember) => staffMember.id === assignment.staffId);
            return {
              ...assignment,
              staffName: member ? member.name : assignment.staffName
            };
          })
        })),
        availability: existing.availability.map((entry) => ({
          ...entry,
          staff: entry.staff.filter((assignment) =>
            staff.some((member) => member.id === assignment.staffId)
          )
        }))
      }));
    },
    [updateWorkspace]
  );

  const setAvailability = React.useCallback(
    (availability: ServiceAvailability[]) => {
      updateWorkspace((existing) => ({
        ...existing,
        availability,
        availabilityTemplates: buildTemplatesFromAvailability(
          existing.catalog,
          existing.staff,
          availability
        )
      }));
    },
    [updateWorkspace]
  );

  const setNotifications = React.useCallback(
    (templates: NotificationTemplate[]) => {
      updateWorkspace((existing) => ({
        ...existing,
        notifications: templates
      }));
    },
    [updateWorkspace]
  );

  const setPolicies = React.useCallback(
    (policies: PoliciesConfig) => {
      updateWorkspace((existing) => ({
        ...existing,
        policies
      }));
    },
    [updateWorkspace]
  );

  const setGiftCards = React.useCallback(
    (program: GiftCardProgramState) => {
      updateWorkspace((existing) => ({
        ...existing,
        giftCards: program
      }));
    },
    [updateWorkspace]
  );

  const setPayment = React.useCallback(
    (updater: (payment: FakeBusinessWorkspace["payment"]) => FakeBusinessWorkspace["payment"]) => {
      updateWorkspace((existing) => ({
        ...existing,
        payment: updater(existing.payment)
      }));
    },
    [updateWorkspace]
  );

  const setIdentity = React.useCallback(
    (
      updater: (
        identity: FakeBusinessWorkspace["identity"]
      ) => FakeBusinessWorkspace["identity"]
    ) => {
      updateWorkspace((existing) => ({
        ...existing,
        identity: updater(existing.identity)
      }));
    },
    [updateWorkspace]
  );

  const performBookingAction = React.useCallback(
    (bookingId: string, action: MoneyBoardAction) => {
      let response: BookingActionResponse | undefined;
      setWorkspace((existing) => {
        if (!existing) return existing;
        const index = existing.bookings.findIndex((booking) => booking.id === bookingId);
        if (index === -1) return existing;

        const targetBooking = existing.bookings[index];
        const actionResult = applyMoneyBoardAction(
          targetBooking,
          action,
          existing.policies,
          existing.giftCards
        );

        response = actionResult.response;
        if (!actionResult.shouldPersist) {
          return existing;
        }

        const updatedBookings = [...existing.bookings];
        updatedBookings[index] = actionResult.booking;

        const updatedWorkspace: FakeBusinessWorkspace = {
          ...existing,
          bookings: updatedBookings,
          customers: deriveCustomersFromBookings(updatedBookings),
          analytics: recomputeAnalytics(updatedBookings),
          giftCards: actionResult.giftCards ?? existing.giftCards
        };

        return updatedWorkspace;
      });
      return response;
    },
    []
  );

  const recordPublicBooking = React.useCallback(
    (payload: PublicBookingPayload) => {
      if (!business) return undefined;
      let createdBooking: FakeBooking | undefined;
      setWorkspace((existing) => {
        if (!existing) return existing;
        const result = createBookingFromPublicFlow(
          business,
          existing,
          payload
        );
        if (!result) return existing;
        createdBooking = result.booking;
        return result.workspace;
      });
      return createdBooking;
    },
    [business]
  );

  const copyAvailabilityTemplate = React.useCallback((templateId: string) => {
    updateWorkspace((existing) => {
      const template = existing.availabilityTemplates.find((entry) => entry.id === templateId);
      return template
        ? {
            ...existing,
            availabilityClipboard: {
              ...template,
              staffAssignments: template.staffAssignments.map((assignment) => ({
                ...assignment,
                slots: assignment.slots.map((slot) => ({ ...slot }))
              }))
            }
          }
        : existing;
    });
  }, [updateWorkspace]);

  const pasteAvailabilityTemplate = React.useCallback((serviceId: string) => {
    updateWorkspace((existing) => {
      if (!existing.availabilityClipboard) return existing;
      const clipboard = existing.availabilityClipboard;
      const newAvailability = existing.availability.map((entry) =>
        entry.serviceId === serviceId
          ? {
              serviceId,
              staff: clipboard.staffAssignments.map((assignment) => ({
                staffId: assignment.staffId,
                slots: assignment.slots.map((slot) => ({ ...slot }))
              }))
            }
          : entry
      );

      const newTemplates = existing.availabilityTemplates.some(
        (template) => template.serviceId === serviceId
      )
        ? existing.availabilityTemplates.map((template) =>
            template.serviceId === serviceId
              ? {
                  ...clipboard,
                  id: template.id,
                  serviceId,
                  serviceName: clipboard.serviceName
                }
              : template
          )
        : [
            ...existing.availabilityTemplates,
            {
              ...clipboard,
              id: `template_${serviceId}`,
              serviceId,
              serviceName: clipboard.serviceName
            }
          ];

      return {
        ...existing,
        availability: newAvailability,
        availabilityTemplates: newTemplates
      };
    });
  }, [updateWorkspace]);

  const clearAvailabilityClipboard = React.useCallback(() => {
    updateWorkspace((existing) => ({
      ...existing,
      availabilityClipboard: null
    }));
  }, [updateWorkspace]);

  const refreshAnalytics = React.useCallback(() => {
    updateWorkspace((existing) => ({
      ...existing,
      analytics: recomputeAnalytics(existing.bookings),
      customers: deriveCustomersFromBookings(existing.bookings)
    }));
  }, [updateWorkspace]);

  const loadSeedBusiness = React.useCallback(
    (
      seed: WorkspaceSeedInput = DEV_WORKSPACE_SEED,
      overrides?: Partial<FakeBusiness>
    ) => {
      const slug = (overrides?.slug ?? seed.website.subdomain ?? "preview").toLowerCase();
      const bookingUrl = overrides?.bookingUrl ?? `https://${slug}.tithi.com`;
      const previewUrl = overrides?.previewUrl ?? `/public/${slug}`;
      const businessPayload: FakeBusiness = {
        id: overrides?.id ?? `biz_${slug}`,
        name: overrides?.name ?? seed.business.businessName,
        slug,
        bookingUrl,
        previewUrl,
        status: overrides?.status ?? seed.payment.subscriptionStatus,
        createdAt: overrides?.createdAt ?? new Date().toISOString(),
        trialEndsAt: overrides?.trialEndsAt ?? seed.payment.trialEndsAt,
        nextBillDate: overrides?.nextBillDate ?? seed.payment.nextBillDate
      };

      const workspaceSnapshot = createWorkspaceFromOnboarding(seed);

      let resolvedBusiness = businessPayload;
      setBusiness((existing) => {
        if (existing) {
          resolvedBusiness = existing;
          return existing;
        }
        resolvedBusiness = businessPayload;
        return businessPayload;
      });

      let resolvedWorkspace = workspaceSnapshot;
      setWorkspace((existing) => {
        if (existing) {
          resolvedWorkspace = existing;
          return existing;
        }
        resolvedWorkspace = workspaceSnapshot;
        return workspaceSnapshot;
      });

      return { business: resolvedBusiness, workspace: resolvedWorkspace };
    },
    []
  );

  const clearBusiness = React.useCallback(() => {
    setBusiness(undefined);
    setWorkspace(undefined);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = React.useMemo(
    () => ({
      business,
      workspace,
      createBusiness,
      bootstrapWorkspace,
      loadSeedBusiness,
      updateBusiness,
      updateWorkspace,
      setCatalog,
      setStaff,
      setAvailability,
      setNotifications,
      setPolicies,
      setGiftCards,
      setPayment,
      setIdentity,
      performBookingAction,
      copyAvailabilityTemplate,
      pasteAvailabilityTemplate,
      clearAvailabilityClipboard,
      refreshAnalytics,
      recordPublicBooking,
      clearBusiness
    }),
    [
      business,
      workspace,
      createBusiness,
      bootstrapWorkspace,
      loadSeedBusiness,
      updateBusiness,
      updateWorkspace,
      setCatalog,
      setStaff,
      setAvailability,
      setNotifications,
      setPolicies,
      setGiftCards,
      setPayment,
      setIdentity,
      performBookingAction,
      copyAvailabilityTemplate,
      pasteAvailabilityTemplate,
      clearAvailabilityClipboard,
      refreshAnalytics,
      recordPublicBooking,
      clearBusiness
    ]
  );

  return (
    <FakeBusinessContext.Provider value={value}>{children}</FakeBusinessContext.Provider>
  );
}

export function useFakeBusiness() {
  const context = React.useContext(FakeBusinessContext);
  if (!context) {
    throw new Error("useFakeBusiness must be used within a FakeBusinessProvider");
  }
  return context;
}

function createBookingFromPublicFlow(
  business: FakeBusiness,
  workspace: FakeBusinessWorkspace,
  payload: PublicBookingPayload
): { booking: FakeBooking; workspace: FakeBusinessWorkspace } | undefined {
  const serviceResult = findServiceInCatalog(workspace.catalog, payload.serviceId);
  if (!serviceResult) {
    return undefined;
  }

  const { service, category } = serviceResult;
  const staffMember = payload.staffId
    ? workspace.staff.find((member) => member.id === payload.staffId)
    : null;

  const listPriceCents = Math.max(service.priceCents, 0);
  const requestedGiftCardCents = Math.max(payload.giftCard?.amountCents ?? 0, 0);
  const giftCardAmountCents = Math.min(requestedGiftCardCents, listPriceCents);
  const authorizationAmountCents = Math.max(listPriceCents - giftCardAmountCents, 0);

  const normalizedEmail = normalizeEmail(payload.customer.email);
  const normalizedPhone = payload.customer.phone ? normalizePhone(payload.customer.phone) : undefined;

  const existingCustomer =
    workspace.customers.find((customer) => normalizeEmail(customer.email) === normalizedEmail) ??
    (normalizedPhone
      ? workspace.customers.find(
          (customer) => customer.phone && normalizePhone(customer.phone) === normalizedPhone
        )
      : undefined);

  const customer: FakeCustomer = existingCustomer
    ? {
        ...existingCustomer,
        name: payload.customer.name,
        phone: payload.customer.phone ?? existingCustomer.phone
      }
    : {
        id: `cust_${crypto.randomUUID()}`,
        name: payload.customer.name,
        email: payload.customer.email,
        phone: payload.customer.phone,
        createdAt: payload.consent.acceptedAt ?? new Date().toISOString()
      };

  const bookingCode = generateBookingCode(
    business.slug,
    workspace.bookings.map((booking) => booking.code)
  );

  const authorizationPayment: FakeBooking["payments"][number] = {
    id: `pay_${crypto.randomUUID()}`,
    bookingId: `booking_${bookingCode}`,
    type: "authorization",
    amountCents: authorizationAmountCents,
    status: payload.requiresAction ? "requires_action" : "authorized",
    occurredAt: payload.startDateTime,
    notes: "Card saved securely for manual capture"
  };

  const booking: FakeBooking = {
    id: `booking_${bookingCode}`,
    code: bookingCode,
    status: payload.requiresAction ? "requires_action" : "authorized",
    serviceId: service.id,
    serviceName: service.name,
    categoryName: category.name,
    durationMinutes: service.durationMinutes,
    startDateTime: payload.startDateTime,
    endDateTime: payload.endDateTime,
    staff: staffMember
      ? { id: staffMember.id, name: staffMember.name, color: staffMember.color }
      : null,
    customer,
    payments: [authorizationPayment],
    financials: {
      listPriceCents,
      giftCardAmountCents,
      platformFeeCents: 0,
      stripeFeeEstimateCents: 0,
      netPayoutCents: 0,
      currency: "usd"
    },
    policyConsent: payload.consent,
    requiresAction: Boolean(payload.requiresAction),
    notes: undefined
  };

  const updatedBookings = [booking, ...workspace.bookings];
  const updatedCustomers = deriveCustomersFromBookings(updatedBookings);
  const updatedAnalytics = recomputeAnalytics(updatedBookings);
  const updatedGiftCards = applyGiftCardRedemption(
    workspace.giftCards,
    payload,
    giftCardAmountCents,
    bookingCode
  );

  return {
    booking,
    workspace: {
      ...workspace,
      bookings: updatedBookings,
      customers: updatedCustomers,
      analytics: updatedAnalytics,
      giftCards: updatedGiftCards
    }
  };
}

function findServiceInCatalog(
  catalog: ServiceCategory[],
  serviceId: string
): { service: ServiceCategory["services"][number]; category: ServiceCategory } | undefined {
  for (const category of catalog) {
    const service = category.services.find((entry) => entry.id === serviceId);
    if (service) {
      return { service, category };
    }
  }
  return undefined;
}

function applyGiftCardRedemption(
  giftCards: GiftCardProgramState,
  payload: PublicBookingPayload,
  redemptionAmountCents: number,
  bookingCode: string
): GiftCardProgramState {
  if (!giftCards.config.enabled || !payload.giftCard || redemptionAmountCents <= 0) {
    return giftCards;
  }

  const code = payload.giftCard.code.toUpperCase();
  const ledgerForCode = giftCards.ledger.filter((entry) => entry.code === code);
  const lastBalance =
    ledgerForCode.at(-1)?.balanceAfterCents ??
    (giftCards.config.amountType === "amount" ? giftCards.config.amountValue : 0);
  const nextBalance =
    giftCards.config.amountType === "amount"
      ? Math.max(lastBalance - redemptionAmountCents, 0)
      : 0;

  const ledgerEntry: GiftCardLedgerEntry = {
    id: `gcl_${crypto.randomUUID()}`,
    code,
    bookingCode,
    deltaCents: -redemptionAmountCents,
    balanceAfterCents: nextBalance,
    occurredAt: payload.consent.acceptedAt ?? new Date().toISOString(),
    reason: "redeemed"
  };

  return {
    ...giftCards,
    config: {
      ...giftCards.config,
      generatedCodes: Array.from(new Set([...giftCards.config.generatedCodes, code]))
    },
    ledger: [...giftCards.ledger, ledgerEntry]
  };
}

function generateBookingCode(slug: string, existingCodes: string[]): string {
  const prefix = createBookingPrefix(slug);
  const year = new Date().getFullYear();
  let attempt = 0;
  let code = "";
  do {
    const sequence = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}-${year}-${sequence}`;
    attempt += 1;
  } while (existingCodes.includes(code) && attempt < 25);
  return code;
}

function createBookingPrefix(slug: string): string {
  const sanitized = slug.replace(/[^a-z0-9]/gi, "");
  const prefix = sanitized.slice(0, 3).toUpperCase();
  return prefix.padEnd(3, "X");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone?: string): string {
  return phone ? phone.replace(/\D/g, "") : "";
}

function buildTemplatesFromAvailability(
  catalog: ServiceCategory[],
  staff: StaffMember[],
  availability: ServiceAvailability[]
) {
  return availability.map((entry) => {
    const service = catalog
      .flatMap((category) => category.services)
      .find((svc) => svc.id === entry.serviceId);
    return {
      id: `template_${entry.serviceId}`,
      label: service ? `${service.name} default` : "Default",
      serviceId: entry.serviceId,
      serviceName: service ? service.name : "Service",
      staffAssignments: entry.staff.map((assignment) => {
        const member = staff.find((staffMember) => staffMember.id === assignment.staffId);
        return {
          staffId: assignment.staffId,
          staffName: member ? member.name : "Staff",
          slots: assignment.slots.map((slot) => ({ ...slot }))
        };
      })
    };
  });
}

interface ActionResult {
  booking: FakeBooking;
  response: BookingActionResponse;
  shouldPersist: boolean;
  giftCards?: GiftCardProgramState;
}

function applyMoneyBoardAction(
  booking: FakeBooking,
  action: MoneyBoardAction,
  policies: PoliciesConfig,
  giftCards: GiftCardProgramState
): ActionResult {
  switch (action) {
    case "complete":
      return completeBooking(booking);
    case "no_show":
      return noShowBooking(booking, policies);
    case "cancel":
      return cancelBooking(booking, policies);
    case "refund":
      return refundBooking(booking, giftCards);
    default:
      return {
        booking,
        response: {
          booking,
          status: "success",
          message: "No action taken."
        },
        shouldPersist: false
      };
  }
}

function completeBooking(booking: FakeBooking): ActionResult {
  if (booking.status === "captured") {
    return {
      booking,
      response: {
        booking,
        status: "success",
        message: "This booking is already captured."
      },
      shouldPersist: false
    };
  }

  if (booking.requiresAction) {
    return {
      booking: {
        ...booking,
        status: "requires_action"
      },
      response: {
        booking,
        status: "requires_action",
        message: "Customer must complete authentication.",
        payLinkUrl: `https://pay.stripe.com/pm/${booking.code.toLowerCase()}`
      },
      shouldPersist: false
    };
  }

  const hasCapture = booking.payments.some((payment) => payment.type === "capture");
  if (hasCapture) {
    return {
      booking,
      response: {
        booking,
        status: "success",
        message: "Capture already recorded."
      },
      shouldPersist: false
    };
  }

  const captureAmount =
    booking.financials.listPriceCents - booking.financials.giftCardAmountCents;
  const platformFee = Math.round(captureAmount * 0.01);
  const stripeFee = Math.round(captureAmount * 0.029) + 30;

  const capturePayment = {
    id: `pay_${crypto.randomUUID()}`,
    bookingId: booking.id,
    type: "capture" as const,
    amountCents: captureAmount,
    status: "captured" as const,
    occurredAt: new Date().toISOString(),
    notes: "Captured from money board"
  };

  const updatedBooking: FakeBooking = {
    ...booking,
    status: "captured",
    requiresAction: false,
    payments: [...booking.payments, capturePayment],
    financials: {
      ...booking.financials,
      platformFeeCents: platformFee,
      stripeFeeEstimateCents: stripeFee,
      netPayoutCents: Math.max(captureAmount - platformFee - stripeFee, 0)
    }
  };

  return {
    booking: updatedBooking,
    response: {
      booking: updatedBooking,
      status: "success",
      message: "Capture succeeded — funds en route to your Connect account."
    },
    shouldPersist: true
  };
}

function noShowBooking(booking: FakeBooking, policies: PoliciesConfig): ActionResult {
  const fee =
    policies.noShowFeeType === "percent"
      ? Math.round((booking.financials.listPriceCents * policies.noShowFeeValue) / 100)
      : Math.round(policies.noShowFeeValue * 100);

  if (fee <= 0) {
    const updatedBooking: FakeBooking = {
      ...booking,
      status: "no_show",
      payments: booking.payments,
      financials: {
        ...booking.financials,
        platformFeeCents: 0,
        stripeFeeEstimateCents: 0,
        netPayoutCents: 0
      }
    };
    return {
      booking: updatedBooking,
      response: {
        booking: updatedBooking,
        status: "success",
        message: "Marked as no-show with no charge."
      },
      shouldPersist: true
    };
  }

  const platformFee = Math.round(fee * 0.01);
  const stripeFee = Math.round(fee * 0.029) + 30;

  const feePayment = {
    id: `pay_${crypto.randomUUID()}`,
    bookingId: booking.id,
    type: "no_show_fee" as const,
    amountCents: fee,
    status: "captured" as const,
    occurredAt: new Date().toISOString(),
    notes: "No-show fee charged"
  };

  const updatedBooking: FakeBooking = {
    ...booking,
    status: "no_show",
    requiresAction: false,
    payments: [...booking.payments, feePayment],
    financials: {
      ...booking.financials,
      platformFeeCents: platformFee,
      stripeFeeEstimateCents: stripeFee,
      netPayoutCents: Math.max(fee - platformFee - stripeFee, 0)
    }
  };

  return {
    booking: updatedBooking,
    response: {
      booking: updatedBooking,
      status: "success",
      message: "No-show fee captured."
    },
    shouldPersist: true
  };
}

function cancelBooking(booking: FakeBooking, policies: PoliciesConfig): ActionResult {
  const fee =
    policies.cancellationFeeType === "percent"
      ? Math.round((booking.financials.listPriceCents * policies.cancellationFeeValue) / 100)
      : Math.round(policies.cancellationFeeValue * 100);

  if (fee <= 0) {
    const updatedBooking: FakeBooking = {
      ...booking,
      status: "canceled",
      requiresAction: false,
      financials: {
        ...booking.financials,
        platformFeeCents: 0,
        stripeFeeEstimateCents: 0,
        netPayoutCents: 0
      }
    };
    return {
      booking: updatedBooking,
      response: {
        booking: updatedBooking,
        status: "success",
        message: "Booking canceled without charge."
      },
      shouldPersist: true
    };
  }

  const platformFee = Math.round(fee * 0.01);
  const stripeFee = Math.round(fee * 0.029) + 30;

  const feePayment = {
    id: `pay_${crypto.randomUUID()}`,
    bookingId: booking.id,
    type: "cancel_fee" as const,
    amountCents: fee,
    status: "captured" as const,
    occurredAt: new Date().toISOString(),
    notes: "Cancellation fee charged"
  };

  const updatedBooking: FakeBooking = {
    ...booking,
    status: "canceled",
    requiresAction: false,
    payments: [...booking.payments, feePayment],
    financials: {
      ...booking.financials,
      platformFeeCents: platformFee,
      stripeFeeEstimateCents: stripeFee,
      netPayoutCents: Math.max(fee - platformFee - stripeFee, 0)
    }
  };

  return {
    booking: updatedBooking,
    response: {
      booking: updatedBooking,
      status: "success",
      message: "Cancellation fee captured."
    },
    shouldPersist: true
  };
}

function refundBooking(booking: FakeBooking, giftCards: GiftCardProgramState): ActionResult {
  const capturedAmount = booking.payments
    .filter((payment) => payment.type !== "authorization" && payment.status === "captured")
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  if (capturedAmount <= 0) {
    return {
      booking,
      response: {
        booking,
        status: "success",
        message: "No payment to refund."
      },
      shouldPersist: false
    };
  }

  const refundPayment = {
    id: `pay_${crypto.randomUUID()}`,
    bookingId: booking.id,
    type: "refund" as const,
    amountCents: capturedAmount,
    status: "refunded" as const,
    occurredAt: new Date().toISOString(),
    notes: "Refund processed from admin"
  };

  const updatedBooking: FakeBooking = {
    ...booking,
    status: "refunded",
    requiresAction: false,
    payments: [...booking.payments, refundPayment],
    financials: {
      ...booking.financials,
      platformFeeCents: 0,
      stripeFeeEstimateCents: 0,
      netPayoutCents: 0
    }
  };

  let updatedGiftCards: GiftCardProgramState | undefined;
  if (
    giftCards.config.enabled &&
    giftCards.restoreBalanceOnRefund &&
    booking.financials.giftCardAmountCents > 0
  ) {
    const restoreEntry = {
      id: `gcl_${crypto.randomUUID()}`,
      code: giftCards.config.generatedCodes[0] ?? "WELCOME120",
      bookingCode: booking.code,
      deltaCents: booking.financials.giftCardAmountCents,
      balanceAfterCents:
        (giftCards.ledger[0]?.balanceAfterCents ?? 0) + booking.financials.giftCardAmountCents,
      occurredAt: new Date().toISOString(),
      reason: "refunded" as const
    };
    updatedGiftCards = {
      ...giftCards,
      ledger: [...giftCards.ledger, restoreEntry]
    };
  }

  return {
    booking: updatedBooking,
    response: {
      booking: updatedBooking,
      status: "success",
      message: "Refund issued. Gift card balance restored if applicable."
    },
    shouldPersist: true,
    giftCards: updatedGiftCards
  };
}
