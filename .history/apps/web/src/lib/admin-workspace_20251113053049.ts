import {
  type AvailabilitySlot,
  type BrandingConfig,
  type BusinessBasics,
  type GiftCardConfig,
  type LocationContacts,
  type NotificationTemplate,
  type PaymentSetupConfig,
  type PoliciesConfig,
  type ServiceAvailability,
  type ServiceCategory,
  type StaffAvailability,
  type StaffMember,
  type WebsiteConfig
} from "@/lib/onboarding-types";

export type BookingStatus =
  | "pending"
  | "authorized"
  | "completed"
  | "captured"
  | "no_show"
  | "canceled"
  | "refunded"
  | "disputed"
  | "requires_action"
  | "expired";

export type PaymentStatus = "requires_action" | "authorized" | "captured" | "refunded" | "failed";

export type MoneyBoardAction = "complete" | "no_show" | "cancel" | "refund";

export interface FakeCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
}

export interface FakePayment {
  id: string;
  bookingId: string;
  type: "authorization" | "capture" | "no_show_fee" | "cancel_fee" | "refund";
  amountCents: number;
  status: PaymentStatus;
  occurredAt: string;
  notes?: string;
}

export interface FakeBookingFinancials {
  listPriceCents: number;
  giftCardAmountCents: number;
  platformFeeCents: number;
  stripeFeeEstimateCents: number;
  netPayoutCents: number;
  currency: string;
}

export interface FakeBookingPolicyConsent {
  hash: string;
  acceptedAt: string;
  ip: string;
  userAgent: string;
}

export interface FakeBooking {
  id: string;
  code: string;
  status: BookingStatus;
  serviceId: string;
  serviceName: string;
  categoryName: string;
  durationMinutes: number;
  startDateTime: string;
  endDateTime: string;
  staff?: {
    id: string;
    name: string;
    color: string;
  } | null;
  customer: FakeCustomer;
  payments: FakePayment[];
  financials: FakeBookingFinancials;
  policyConsent: FakeBookingPolicyConsent;
  requiresAction: boolean;
  notes?: string;
}

export interface GiftCardLedgerEntry {
  id: string;
  code: string;
  bookingCode?: string;
  deltaCents: number;
  balanceAfterCents: number;
  occurredAt: string;
  reason: "issued" | "redeemed" | "refunded" | "adjusted";
}

export interface GiftCardProgramState {
  config: GiftCardConfig;
  restoreBalanceOnRefund: boolean;
  ledger: GiftCardLedgerEntry[];
}

export interface PaymentControlState extends PaymentSetupConfig {
  keepSiteLiveWhenPaused: boolean;
  payLinkAutomationEnabled: boolean;
  startedTrialAt?: string;
  lastStatusChangeAt?: string;
}

export interface AvailabilityTemplate {
  id: string;
  label: string;
  serviceId: string;
  serviceName: string;
  staffAssignments: Array<{
    staffId: string;
    staffName: string;
    slots: AvailabilitySlot[];
  }>;
}

export interface AnalyticsSnapshot {
  revenueByMonth: Array<{
    month: string;
    capturedCents: number;
    noShowFeeCents: number;
    refundedCents: number;
  }>;
  bookingsByStatus: Array<{ status: BookingStatus; count: number }>;
  staffUtilization: Array<{
    staffId: string;
    staffName: string;
    utilizationPercent: number;
  }>;
  feeBreakdown: {
    totalCapturedCents: number;
    platformFeeCents: number;
    stripeFeeCents: number;
    netPayoutCents: number;
  };
  noShowRatePercent: number;
}

export interface FakeBusinessWorkspace {
  identity: {
    business: BusinessBasics;
    location: LocationContacts;
    branding: BrandingConfig;
    website: WebsiteConfig;
  };
  staff: StaffMember[];
  catalog: ServiceCategory[];
  availability: ServiceAvailability[];
  availabilityTemplates: AvailabilityTemplate[];
  availabilityClipboard?: AvailabilityTemplate | null;
  notifications: NotificationTemplate[];
  policies: PoliciesConfig;
  giftCards: GiftCardProgramState;
  payment: PaymentControlState;
  bookings: FakeBooking[];
  customers: FakeCustomer[];
  analytics: AnalyticsSnapshot;
}

export interface BookingActionResponse {
  booking: FakeBooking;
  status: "success" | "requires_action";
  message: string;
  payLinkUrl?: string;
}

export interface WorkspaceSeedInput {
  business: BusinessBasics;
  website: WebsiteConfig;
  location: LocationContacts;
  branding: BrandingConfig;
  team: StaffMember[];
  categories: ServiceCategory[];
  availability: ServiceAvailability[];
  notifications: NotificationTemplate[];
  policies: PoliciesConfig;
  giftCards: GiftCardConfig;
  payment: PaymentSetupConfig;
}

export function createWorkspaceFromOnboarding(seed: WorkspaceSeedInput): FakeBusinessWorkspace {
  const { categories, team, payment, giftCards } = seed;
  const catalog = cloneCategories(categories);
  const staff = cloneStaff(team);
  const availability = cloneAvailability(seed.availability);
  const availabilityTemplates = buildAvailabilityTemplates(catalog, staff, availability);

  const bookings = seedBookings(catalog, staff, payment);
  const customers = deriveCustomers(bookings);
  const analytics = deriveAnalytics(bookings);

  return {
    identity: {
      business: clone(seed.business),
      location: clone(seed.location),
      branding: clone(seed.branding),
      website: clone(seed.website)
    },
    staff,
    catalog,
    availability,
    availabilityTemplates,
    availabilityClipboard: null,
    notifications: cloneNotifications(seed.notifications),
    policies: clone(seed.policies),
    giftCards: {
      config: clone(giftCards),
      restoreBalanceOnRefund: true,
      ledger: seedGiftCardLedger(giftCards)
    },
    payment: {
      ...clone(payment),
      keepSiteLiveWhenPaused: true,
      payLinkAutomationEnabled: true,
      startedTrialAt: payment.subscriptionStatus === "trial" ? new Date().toISOString() : undefined,
      lastStatusChangeAt: new Date().toISOString()
    },
    bookings,
    customers,
    analytics
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function cloneCategories(categories: ServiceCategory[]): ServiceCategory[] {
  return categories.map((category) => ({
    ...category,
    services: category.services.map((service) => ({ ...service }))
  }));
}

function cloneStaff(staff: StaffMember[]): StaffMember[] {
  return staff.map((member) => ({ ...member }));
}

function cloneAvailability(availability: ServiceAvailability[]): ServiceAvailability[] {
  return availability.map((serviceAvailability) => ({
    serviceId: serviceAvailability.serviceId,
    staff: serviceAvailability.staff.map((staffAvailability) => ({
      staffId: staffAvailability.staffId,
      slots: staffAvailability.slots.map((slot) => ({ ...slot }))
    }))
  }));
}

function cloneNotifications(templates: NotificationTemplate[]): NotificationTemplate[] {
  return templates.map((template) => ({ ...template }));
}

function buildAvailabilityTemplates(
  catalog: ServiceCategory[],
  staff: StaffMember[],
  availability: ServiceAvailability[]
): AvailabilityTemplate[] {
  const templates: AvailabilityTemplate[] = [];
  for (const serviceAvailability of availability) {
    const service = findService(catalog, serviceAvailability.serviceId);
    if (!service) continue;
    templates.push({
      id: `template_${service.id}`,
      label: `${service.name} default`,
      serviceId: service.id,
      serviceName: service.name,
      staffAssignments: serviceAvailability.staff.map((assignment) => {
        const staffMember = staff.find((member) => member.id === assignment.staffId);
        return {
          staffId: assignment.staffId,
          staffName: staffMember ? staffMember.name : "Staff",
          slots: assignment.slots.map((slot) => ({ ...slot }))
        };
      })
    });
  }
  return templates;
}

function findService(
  catalog: ServiceCategory[],
  serviceId: string
): { service: ServiceCategory["services"][number]; category: ServiceCategory } | undefined {
  for (const category of catalog) {
    const service = category.services.find((svc) => svc.id === serviceId);
    if (service) {
      return { service, category };
    }
  }
  return undefined;
}

function seedBookings(
  catalog: ServiceCategory[],
  staff: StaffMember[],
  payment: PaymentSetupConfig
): FakeBooking[] {
  const services = catalog.flatMap((category) =>
    category.services.map((service) => ({ ...service, categoryName: category.name }))
  );

  if (services.length === 0) {
    return [];
  }

  const customersSeeds: Array<Omit<FakeCustomer, "id" | "createdAt">> = [
    { name: "Jordan Blake", email: "jordan@example.com", phone: "+14155550123" },
    { name: "Sofia Reyes", email: "sofia@example.com", phone: "+12135551212" },
    { name: "Aiden Chen", email: "aiden@example.com", phone: "+14155559876" },
    { name: "Priya Patel", email: "priya@example.com", phone: "+19175551234" },
    { name: "Noah Thompson", email: "noah@example.com", phone: "+16175554321" }
  ];

  const now = new Date();

  const sample = (index: number) => services[index % services.length];

  const bookings: FakeBooking[] = [
    createBooking({
      code: "TTH-2025-1042",
      baseDate: shiftDate(now, -3),
      service: sample(0),
      staff: staff[0],
      customerSeed: customersSeeds[0],
      status: "captured",
      capture: true,
      payment,
      notes: "Customer left a five-star review."
    }),
    createBooking({
      code: "TTH-2025-1043",
      baseDate: shiftDate(now, -1),
      service: sample(1),
      staff: staff[1] ?? staff[0],
      customerSeed: customersSeeds[1],
      status: "authorized",
      payment
    }),
    createBooking({
      code: "TTH-2025-1044",
      baseDate: shiftDate(now, -7),
      service: sample(2),
      staff: staff[0],
      customerSeed: customersSeeds[2],
      status: "no_show",
      noShowFee: true,
      payment
    }),
    createBooking({
      code: "TTH-2025-1045",
      baseDate: shiftDate(now, -2),
      service: sample(3),
      staff: staff[1] ?? staff[0],
      customerSeed: customersSeeds[3],
      status: "canceled",
      cancelFee: true,
      payment
    }),
    createBooking({
      code: "TTH-2025-1046",
      baseDate: shiftDate(now, 2),
      service: sample(4),
      staff: staff[0],
      customerSeed: customersSeeds[4],
      status: "requires_action",
      payment,
      requiresAction: true
    })
  ];

  return bookings;
}

interface CreateBookingOptions {
  code: string;
  baseDate: Date;
  service: ServiceCategory["services"][number] & { categoryName: string };
  staff?: StaffMember;
  customerSeed: Omit<FakeCustomer, "id" | "createdAt">;
  status: BookingStatus;
  capture?: boolean;
  noShowFee?: boolean;
  cancelFee?: boolean;
  requiresAction?: boolean;
  payment: PaymentSetupConfig;
  notes?: string;
}

function createBooking(options: CreateBookingOptions): FakeBooking {
  const durationMs = options.service.durationMinutes * 60 * 1000;
  const startDateTime = new Date(options.baseDate);
  startDateTime.setMinutes(startDateTime.getMinutes() + 90);
  const endDateTime = new Date(startDateTime.getTime() + durationMs);

  const customer: FakeCustomer = {
    id: `cust_${crypto.randomUUID()}`,
    name: options.customerSeed.name,
    email: options.customerSeed.email,
    phone: options.customerSeed.phone,
    createdAt: shiftDate(options.baseDate, -30).toISOString()
  };

  const authorizationAmount = options.service.priceCents;
  const platformFee = Math.round(authorizationAmount * 0.01);
  const stripeFeeEstimate = Math.round(authorizationAmount * 0.029) + 30;

  const payments: FakePayment[] = [
    {
      id: `pay_${crypto.randomUUID()}`,
      bookingId: `booking_${options.code}`,
      type: "authorization",
      amountCents: authorizationAmount,
      status: options.requiresAction ? "requires_action" : "authorized",
      occurredAt: startDateTime.toISOString()
    }
  ];

  if (options.capture) {
    payments.push({
      id: `pay_${crypto.randomUUID()}`,
      bookingId: `booking_${options.code}`,
      type: "capture",
      amountCents: authorizationAmount,
      status: "captured",
      occurredAt: shiftDate(endDateTime, -1).toISOString(),
      notes: "Manual capture completed from money board"
    });
  }

  if (options.noShowFee) {
    const fee = Math.round(authorizationAmount * 0.5);
    payments.push({
      id: `pay_${crypto.randomUUID()}`,
      bookingId: `booking_${options.code}`,
      type: "no_show_fee",
      amountCents: fee,
      status: "captured",
      occurredAt: shiftDate(endDateTime, 1).toISOString(),
      notes: "No-show fee applied"
    });
  }

  if (options.cancelFee) {
    const fee = Math.round(authorizationAmount * 0.25);
    payments.push({
      id: `pay_${crypto.randomUUID()}`,
      bookingId: `booking_${options.code}`,
      type: "cancel_fee",
      amountCents: fee,
      status: "captured",
      occurredAt: shiftDate(endDateTime, -6).toISOString(),
      notes: "Cancellation fee applied"
    });
  }

  const requiresAction = Boolean(options.requiresAction);

  const status = requiresAction ? "requires_action" : options.status;

  const capturedAmount =
    payments
      .filter((payment) => payment.type === "capture")
      .reduce((sum, payment) => sum + payment.amountCents, 0) +
    payments
      .filter((payment) => payment.type === "no_show_fee" || payment.type === "cancel_fee")
      .reduce((sum, payment) => sum + payment.amountCents, 0);

  const platformFeeCents = Math.round(capturedAmount * 0.01);
  const stripeFeeCents = capturedAmount ? Math.round(capturedAmount * 0.029) + 30 : 0;

  const booking: FakeBooking = {
    id: `booking_${options.code}`,
    code: options.code,
    status,
    serviceId: options.service.id,
    serviceName: options.service.name,
    categoryName: options.service.categoryName,
    durationMinutes: options.service.durationMinutes,
    startDateTime: startDateTime.toISOString(),
    endDateTime: endDateTime.toISOString(),
    staff: options.staff
      ? { id: options.staff.id, name: options.staff.name, color: options.staff.color }
      : null,
    customer,
    payments,
    financials: {
      listPriceCents: authorizationAmount,
      giftCardAmountCents: 0,
      platformFeeCents: platformFeeCents,
      stripeFeeEstimateCents: stripeFeeEstimate,
      netPayoutCents: Math.max(capturedAmount - platformFeeCents - stripeFeeCents, 0),
      currency: "usd"
    },
    policyConsent: {
      hash: crypto.randomUUID().replace(/-/g, ""),
      acceptedAt: shiftDate(options.baseDate, -2).toISOString(),
      ip: "203.0.113.5",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)"
    },
    requiresAction,
    notes: options.notes
  };

  return booking;
}

function shiftDate(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function deriveCustomers(bookings: FakeBooking[]): FakeCustomer[] {
  const map = new Map<string, FakeCustomer>();
  for (const booking of bookings) {
    if (!map.has(booking.customer.id)) {
      map.set(booking.customer.id, booking.customer);
    }
  }
  return Array.from(map.values());
}

function deriveAnalytics(bookings: FakeBooking[]): AnalyticsSnapshot {
  const revenueByMonthMap = new Map<
    string,
    { capturedCents: number; noShowFeeCents: number; refundedCents: number }
  >();
  const bookingsByStatusMap = new Map<BookingStatus, number>();
  const staffMap = new Map<string, { name: string; capturedMinutes: number; totalMinutes: number }>();

  let totalCaptured = 0;
  let platformFee = 0;
  let stripeFee = 0;
  let refunded = 0;
  let noShowRateCount = 0;

  for (const booking of bookings) {
    const monthKey = booking.startDateTime.substring(0, 7);
    const record =
      revenueByMonthMap.get(monthKey) ?? {
        capturedCents: 0,
        noShowFeeCents: 0,
        refundedCents: 0
      };

    bookingsByStatusMap.set(booking.status, (bookingsByStatusMap.get(booking.status) ?? 0) + 1);

    const capturedPayments = booking.payments.filter(
      (payment) => payment.status === "captured"
    );

    for (const payment of capturedPayments) {
      if (payment.type === "capture") {
        record.capturedCents += payment.amountCents;
        totalCaptured += payment.amountCents;
      }
      if (payment.type === "no_show_fee") {
        record.noShowFeeCents += payment.amountCents;
        totalCaptured += payment.amountCents;
        noShowRateCount += 1;
      }
      if (payment.type === "cancel_fee") {
        totalCaptured += payment.amountCents;
      }
    }

    const refundPayments = booking.payments.filter((payment) => payment.type === "refund");
    for (const refund of refundPayments) {
      record.refundedCents += refund.amountCents;
      refunded += refund.amountCents;
    }

    platformFee += booking.financials.platformFeeCents;
    stripeFee += booking.financials.stripeFeeEstimateCents;

    if (booking.staff) {
      const staffEntry =
        staffMap.get(booking.staff.id) ??
        { name: booking.staff.name, capturedMinutes: 0, totalMinutes: 0 };
      staffEntry.totalMinutes += booking.durationMinutes;
      staffEntry.capturedMinutes +=
        capturedPayments.length > 0 ? booking.durationMinutes : booking.durationMinutes / 2;
      staffMap.set(booking.staff.id, staffEntry);
    }

    revenueByMonthMap.set(monthKey, record);
  }

  const revenueByMonth = Array.from(revenueByMonthMap.entries()).map(([month, data]) => ({
    month,
    ...data
  }));

  revenueByMonth.sort((a, b) => (a.month > b.month ? 1 : -1));

  const bookingsByStatus = Array.from(bookingsByStatusMap.entries()).map(([status, count]) => ({
    status,
    count
  }));

  const staffUtilization = Array.from(staffMap.entries()).map(([staffId, data]) => ({
    staffId,
    staffName: data.name,
    utilizationPercent: data.totalMinutes
      ? Math.min(100, Math.round((data.capturedMinutes / data.totalMinutes) * 100))
      : 0
  }));

  const totalBookings = bookings.length || 1;
  const noShowRatePercent = Math.round((noShowRateCount / totalBookings) * 100);

  return {
    revenueByMonth,
    bookingsByStatus,
    staffUtilization,
    feeBreakdown: {
      totalCapturedCents: totalCaptured,
      platformFeeCents: platformFee,
      stripeFeeCents: stripeFee,
      netPayoutCents: Math.max(totalCaptured - platformFee - stripeFee - refunded, 0)
    },
    noShowRatePercent
  };
}

function seedGiftCardLedger(config: GiftCardConfig): GiftCardLedgerEntry[] {
  if (!config.enabled) {
    return [];
  }
  const issued: GiftCardLedgerEntry = {
    id: `gcl_${crypto.randomUUID()}`,
    code: config.generatedCodes[0] ?? "WELCOME120",
    deltaCents: config.amountType === "amount" ? config.amountValue : 0,
    balanceAfterCents: config.amountType === "amount" ? config.amountValue : 0,
    occurredAt: shiftDate(new Date(), -15).toISOString(),
    reason: "issued"
  };
  const redeemed: GiftCardLedgerEntry = {
    id: `gcl_${crypto.randomUUID()}`,
    code: issued.code,
    bookingCode: "TTH-2025-1042",
    deltaCents: config.amountType === "amount" ? -Math.min(config.amountValue, 6000) : -2400,
    balanceAfterCents:
      issued.balanceAfterCents +
      (config.amountType === "amount" ? -Math.min(config.amountValue, 6000) : -2400),
    occurredAt: shiftDate(new Date(), -5).toISOString(),
    reason: "redeemed"
  };
  return [issued, redeemed];
}

export function recomputeAnalytics(bookings: FakeBooking[]): AnalyticsSnapshot {
  return deriveAnalytics(bookings);
}

export function deriveCustomersFromBookings(bookings: FakeBooking[]): FakeCustomer[] {
  return deriveCustomers(bookings);
}

