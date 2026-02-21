/** Domain Service Layer — single entry point */
export { AccountingService } from "./accounting";
export { BillingService } from "./billing";
export type { CreateInvoiceInput } from "./billing";
export { InventoryService } from "./inventory";
export { CrmService } from "./crm";
export type { CreateCustomerInput } from "./crm";
export { GovernanceService } from "./governance";
export type { LogViolationInput } from "./governance";
export { HrService } from "./hr";
export { IntegrationsService } from "./integrations";
export { DomainEventsService } from "./domain-events";
export type { DomainEvent, DomainName, ServiceResult } from "./types";
