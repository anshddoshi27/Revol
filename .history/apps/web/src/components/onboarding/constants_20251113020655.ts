export const RESERVED_SUBDOMAINS = [
  "www",
  "admin",
  "api",
  "support",
  "billing",
  "status",
  "blog",
  "help",
  "docs",
  "payments",
  "dashboard"
];

export const PLACEHOLDER_TOKENS = [
  "${customer.name}",
  "${service.name}",
  "${service.duration}",
  "${service.price}",
  "${booking.date}",
  "${booking.time}",
  "${business.name}",
  "${booking.url}"
];

export const DAY_OPTIONS = [
  { label: "Monday", value: "monday" },
  { label: "Tuesday", value: "tuesday" },
  { label: "Wednesday", value: "wednesday" },
  { label: "Thursday", value: "thursday" },
  { label: "Friday", value: "friday" },
  { label: "Saturday", value: "saturday" },
  { label: "Sunday", value: "sunday" }
];

export const PAYMENT_METHODS = [
  { id: "card", label: "Credit & debit cards" },
  { id: "cash", label: "Cash (recorded offline)" },
  { id: "wallets", label: "Digital wallets (Apple Pay, Google Pay)" }
];



