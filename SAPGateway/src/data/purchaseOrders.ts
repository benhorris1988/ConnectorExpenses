export interface PurchaseOrder {
  PONumber: string;
  VendorID: string;
  CompanyCode: string;
  PurchasingOrg: string;
  PurchasingGroup: string;
  DocumentDate: string;
  Currency: string;
  TotalNetAmount: number;
  Status: "Open" | "Partially Delivered" | "Fully Delivered" | "Cancelled" | "Invoiced";
  CostCentreID: string;
  WBSCode: string | null;
  CreatedBy: string;
  ApprovedBy: string | null;
  DeliveryDate: string;
}

export interface POLineItem {
  LineItemID: string;
  PONumber: string;
  LineNumber: string;
  MaterialCode: string;
  Description: string;
  Quantity: number;
  Unit: string;
  UnitPrice: number;
  NetAmount: number;
  Currency: string;
  DeliveredQty: number;
  InvoicedQty: number;
  GlAccount: string;
  TaxCode: string;
}

export const purchaseOrders: PurchaseOrder[] = [
  {
    PONumber: "4500001001",
    VendorID: "V100003",
    CompanyCode: "GB01",
    PurchasingOrg: "UK01",
    PurchasingGroup: "IT1",
    DocumentDate: "2025-10-01",
    Currency: "GBP",
    TotalNetAmount: 24000.00,
    Status: "Invoiced",
    CostCentreID: "CC200",
    WBSCode: "PRJ-2025-001",
    CreatedBy: "EMP002",
    ApprovedBy: "EMP011",
    DeliveryDate: "2025-10-31",
  },
  {
    PONumber: "4500001002",
    VendorID: "V100001",
    CompanyCode: "GB01",
    PurchasingOrg: "UK01",
    PurchasingGroup: "GEN",
    DocumentDate: "2025-11-05",
    Currency: "GBP",
    TotalNetAmount: 1850.00,
    Status: "Fully Delivered",
    CostCentreID: "CC300",
    WBSCode: null,
    CreatedBy: "EMP003",
    ApprovedBy: "EMP012",
    DeliveryDate: "2025-11-20",
  },
  {
    PONumber: "4500001003",
    VendorID: "V100002",
    CompanyCode: "GB01",
    PurchasingOrg: "UK01",
    PurchasingGroup: "TRV",
    DocumentDate: "2025-12-01",
    Currency: "GBP",
    TotalNetAmount: 8500.00,
    Status: "Open",
    CostCentreID: "CC500",
    WBSCode: null,
    CreatedBy: "EMP005",
    ApprovedBy: "EMP009",
    DeliveryDate: "2026-01-31",
  },
  {
    PONumber: "4500001004",
    VendorID: "V100003",
    CompanyCode: "GB01",
    PurchasingOrg: "UK01",
    PurchasingGroup: "IT1",
    DocumentDate: "2026-01-10",
    Currency: "GBP",
    TotalNetAmount: 45000.00,
    Status: "Partially Delivered",
    CostCentreID: "CC200",
    WBSCode: "PRJ-2026-001",
    CreatedBy: "EMP007",
    ApprovedBy: "EMP011",
    DeliveryDate: "2026-06-30",
  },
  {
    PONumber: "4500001005",
    VendorID: "V100004",
    CompanyCode: "GB01",
    PurchasingOrg: "UK01",
    PurchasingGroup: "TRV",
    DocumentDate: "2026-02-01",
    Currency: "GBP",
    TotalNetAmount: 3200.00,
    Status: "Open",
    CostCentreID: "CC100",
    WBSCode: null,
    CreatedBy: "EMP001",
    ApprovedBy: "EMP010",
    DeliveryDate: "2026-02-28",
  },
  {
    PONumber: "4500001006",
    VendorID: "V100007",
    CompanyCode: "GB01",
    PurchasingOrg: "UK01",
    PurchasingGroup: "GEN",
    DocumentDate: "2025-08-15",
    Currency: "GBP",
    TotalNetAmount: 650.00,
    Status: "Cancelled",
    CostCentreID: "CC400",
    WBSCode: null,
    CreatedBy: "EMP004",
    ApprovedBy: null,
    DeliveryDate: "2025-09-01",
  },
];

export const poLineItems: POLineItem[] = [
  { LineItemID: "4500001001-10", PONumber: "4500001001", LineNumber: "10", MaterialCode: "SW-BIFROST-LIC", Description: "BiFrost Connector - Annual Licence", Quantity: 1, Unit: "EA", UnitPrice: 12000.00, NetAmount: 12000.00, Currency: "GBP", DeliveredQty: 1, InvoicedQty: 1, GlAccount: "476000", TaxCode: "V1" },
  { LineItemID: "4500001001-20", PONumber: "4500001001", LineNumber: "20", MaterialCode: "SVC-IMPL-DAYS", Description: "Implementation Consultancy - 10 days", Quantity: 10, Unit: "DAY", UnitPrice: 1200.00, NetAmount: 12000.00, Currency: "GBP", DeliveredQty: 10, InvoicedQty: 10, GlAccount: "476100", TaxCode: "V1" },
  { LineItemID: "4500001002-10", PONumber: "4500001002", LineNumber: "10", MaterialCode: "OFF-SUPPLY-MIX", Description: "Office Supplies - Mixed Pack", Quantity: 50, Unit: "EA", UnitPrice: 25.00, NetAmount: 1250.00, Currency: "GBP", DeliveredQty: 50, InvoicedQty: 50, GlAccount: "400000", TaxCode: "V1" },
  { LineItemID: "4500001002-20", PONumber: "4500001002", LineNumber: "20", MaterialCode: "OFF-PRINTER-PPR", Description: "A4 Printer Paper - Box", Quantity: 20, Unit: "BOX", UnitPrice: 30.00, NetAmount: 600.00, Currency: "GBP", DeliveredQty: 20, InvoicedQty: 20, GlAccount: "400000", TaxCode: "V1" },
  { LineItemID: "4500001003-10", PONumber: "4500001003", LineNumber: "10", MaterialCode: "TRV-MGMT-SVC", Description: "Corporate Travel Management - Q1 2026", Quantity: 1, Unit: "MO", UnitPrice: 8500.00, NetAmount: 8500.00, Currency: "GBP", DeliveredQty: 0, InvoicedQty: 0, GlAccount: "470000", TaxCode: "V1" },
  { LineItemID: "4500001004-10", PONumber: "4500001004", LineNumber: "10", MaterialCode: "SW-DATAPLATFORM", Description: "Data Platform Cloud Subscription - 12mo", Quantity: 12, Unit: "MO", UnitPrice: 2500.00, NetAmount: 30000.00, Currency: "GBP", DeliveredQty: 4, InvoicedQty: 0, GlAccount: "476000", TaxCode: "V1" },
  { LineItemID: "4500001004-20", PONumber: "4500001004", LineNumber: "20", MaterialCode: "SVC-ARCH-DESIGN", Description: "Architecture Design - 12.5 days", Quantity: 12.5, Unit: "DAY", UnitPrice: 1200.00, NetAmount: 15000.00, Currency: "GBP", DeliveredQty: 4, InvoicedQty: 0, GlAccount: "476100", TaxCode: "V1" },
];
