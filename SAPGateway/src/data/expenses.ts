export interface ExpenseReport {
  ExpenseReportID: string;
  EmployeeID: string;
  Description: string;
  SubmissionDate: string;
  TripStartDate: string | null;
  TripEndDate: string | null;
  TotalAmount: number;
  Currency: string;
  Status: "Draft" | "Submitted" | "Approved" | "Rejected" | "Paid";
  CostCentreID: string;
  WBSCode: string | null;
  ApproverID: string | null;
  ApprovalDate: string | null;
  PaymentDate: string | null;
  BusinessPurpose: string;
}

export interface ExpenseLineItem {
  LineItemID: string;
  ExpenseReportID: string;
  ExpenseCategory: ExpenseCategory;
  ExpenseDate: string;
  Amount: number;
  Currency: string;
  Description: string;
  ReceiptAttached: boolean;
  VATAmount: number;
  VATCode: string;
  MerchantName: string;
  IsReimbursable: boolean;
}

export type ExpenseCategory =
  | "Travel_Rail"
  | "Travel_Air"
  | "Travel_Taxi"
  | "Travel_Mileage"
  | "Accommodation"
  | "Meals_Subsistence"
  | "Entertainment_Client"
  | "Conference_Registration"
  | "Equipment_Software"
  | "Telecoms"
  | "Other";

export const expenseReports: ExpenseReport[] = [
  {
    ExpenseReportID: "EXP-2025-0001",
    EmployeeID: "EMP005",
    Description: "Client visit - Manchester",
    SubmissionDate: "2025-11-05",
    TripStartDate: "2025-11-02",
    TripEndDate: "2025-11-04",
    TotalAmount: 487.50,
    Currency: "GBP",
    Status: "Paid",
    CostCentreID: "CC500",
    WBSCode: null,
    ApproverID: "EMP009",
    ApprovalDate: "2025-11-07",
    PaymentDate: "2025-11-14",
    BusinessPurpose: "Sales meeting with key account",
  },
  {
    ExpenseReportID: "EXP-2025-0002",
    EmployeeID: "EMP002",
    Description: "Tech conference - London",
    SubmissionDate: "2025-11-20",
    TripStartDate: "2025-11-18",
    TripEndDate: "2025-11-19",
    TotalAmount: 1240.00,
    Currency: "GBP",
    Status: "Approved",
    CostCentreID: "CC200",
    WBSCode: "PRJ-2025-001",
    ApproverID: "EMP011",
    ApprovalDate: "2025-11-22",
    PaymentDate: null,
    BusinessPurpose: "AWS re:Invent UK - knowledge sharing",
  },
  {
    ExpenseReportID: "EXP-2025-0003",
    EmployeeID: "EMP001",
    Description: "Finance summit - Birmingham",
    SubmissionDate: "2025-12-01",
    TripStartDate: "2025-11-28",
    TripEndDate: "2025-11-29",
    TotalAmount: 620.75,
    Currency: "GBP",
    Status: "Submitted",
    CostCentreID: "CC100",
    WBSCode: null,
    ApproverID: null,
    ApprovalDate: null,
    PaymentDate: null,
    BusinessPurpose: "CIMA Finance Leaders Forum",
  },
  {
    ExpenseReportID: "EXP-2025-0004",
    EmployeeID: "EMP004",
    Description: "Site visit - Glasgow",
    SubmissionDate: "2025-12-10",
    TripStartDate: "2025-12-08",
    TripEndDate: "2025-12-09",
    TotalAmount: 312.20,
    Currency: "GBP",
    Status: "Approved",
    CostCentreID: "CC400",
    WBSCode: null,
    ApproverID: "EMP013",
    ApprovalDate: "2025-12-12",
    PaymentDate: null,
    BusinessPurpose: "Operational review at Glasgow depot",
  },
  {
    ExpenseReportID: "EXP-2026-0001",
    EmployeeID: "EMP007",
    Description: "Data Platform Kick-off - Edinburgh",
    SubmissionDate: "2026-01-20",
    TripStartDate: "2026-01-18",
    TripEndDate: "2026-01-19",
    TotalAmount: 895.00,
    Currency: "GBP",
    Status: "Submitted",
    CostCentreID: "CC200",
    WBSCode: "PRJ-2026-001",
    ApproverID: null,
    ApprovalDate: null,
    PaymentDate: null,
    BusinessPurpose: "Project kick-off workshop with client",
  },
  {
    ExpenseReportID: "EXP-2026-0002",
    EmployeeID: "EMP003",
    Description: "HR Conference - London",
    SubmissionDate: "2026-02-14",
    TripStartDate: "2026-02-12",
    TripEndDate: "2026-02-13",
    TotalAmount: 540.00,
    Currency: "GBP",
    Status: "Draft",
    CostCentreID: "CC300",
    WBSCode: null,
    ApproverID: null,
    ApprovalDate: null,
    PaymentDate: null,
    BusinessPurpose: "CIPD Annual Conference",
  },
  {
    ExpenseReportID: "EXP-2026-0003",
    EmployeeID: "EMP005",
    Description: "Client Entertainment - Leeds",
    SubmissionDate: "2026-03-05",
    TripStartDate: null,
    TripEndDate: null,
    TotalAmount: 385.50,
    Currency: "GBP",
    Status: "Rejected",
    CostCentreID: "CC500",
    WBSCode: null,
    ApproverID: "EMP009",
    ApprovalDate: "2026-03-07",
    PaymentDate: null,
    BusinessPurpose: "Client dinner - policy limit exceeded",
  },
];

export const expenseLineItems: ExpenseLineItem[] = [
  // EXP-2025-0001 lines
  {
    LineItemID: "LI-0001-001",
    ExpenseReportID: "EXP-2025-0001",
    ExpenseCategory: "Travel_Rail",
    ExpenseDate: "2025-11-02",
    Amount: 124.00,
    Currency: "GBP",
    Description: "Train - London Euston to Manchester Piccadilly",
    ReceiptAttached: true,
    VATAmount: 0,
    VATCode: "Z0",
    MerchantName: "Avanti West Coast",
    IsReimbursable: true,
  },
  {
    LineItemID: "LI-0001-002",
    ExpenseReportID: "EXP-2025-0001",
    ExpenseCategory: "Accommodation",
    ExpenseDate: "2025-11-02",
    Amount: 189.00,
    Currency: "GBP",
    Description: "Hotel - 2 nights Marriott Manchester",
    ReceiptAttached: true,
    VATAmount: 31.50,
    VATCode: "V1",
    MerchantName: "Marriott Hotels",
    IsReimbursable: true,
  },
  {
    LineItemID: "LI-0001-003",
    ExpenseReportID: "EXP-2025-0001",
    ExpenseCategory: "Meals_Subsistence",
    ExpenseDate: "2025-11-03",
    Amount: 42.50,
    Currency: "GBP",
    Description: "Working lunch with client",
    ReceiptAttached: true,
    VATAmount: 7.08,
    VATCode: "V1",
    MerchantName: "The Ivy Manchester",
    IsReimbursable: true,
  },
  {
    LineItemID: "LI-0001-004",
    ExpenseReportID: "EXP-2025-0001",
    ExpenseCategory: "Travel_Taxi",
    ExpenseDate: "2025-11-04",
    Amount: 28.00,
    Currency: "GBP",
    Description: "Taxi to station",
    ReceiptAttached: false,
    VATAmount: 0,
    VATCode: "Z0",
    MerchantName: "Uber",
    IsReimbursable: true,
  },
  {
    LineItemID: "LI-0001-005",
    ExpenseReportID: "EXP-2025-0001",
    ExpenseCategory: "Travel_Rail",
    ExpenseDate: "2025-11-04",
    Amount: 104.00,
    Currency: "GBP",
    Description: "Train - Manchester Piccadilly to London Euston",
    ReceiptAttached: true,
    VATAmount: 0,
    VATCode: "Z0",
    MerchantName: "Avanti West Coast",
    IsReimbursable: true,
  },
  // EXP-2025-0002 lines
  {
    LineItemID: "LI-0002-001",
    ExpenseReportID: "EXP-2025-0002",
    ExpenseCategory: "Conference_Registration",
    ExpenseDate: "2025-11-18",
    Amount: 650.00,
    Currency: "GBP",
    Description: "AWS re:Invent UK conference ticket",
    ReceiptAttached: true,
    VATAmount: 108.33,
    VATCode: "V1",
    MerchantName: "Amazon Web Services",
    IsReimbursable: true,
  },
  {
    LineItemID: "LI-0002-002",
    ExpenseReportID: "EXP-2025-0002",
    ExpenseCategory: "Travel_Rail",
    ExpenseDate: "2025-11-18",
    Amount: 89.00,
    Currency: "GBP",
    Description: "Train - Bristol to London Paddington return",
    ReceiptAttached: true,
    VATAmount: 0,
    VATCode: "Z0",
    MerchantName: "Great Western Railway",
    IsReimbursable: true,
  },
  {
    LineItemID: "LI-0002-003",
    ExpenseReportID: "EXP-2025-0002",
    ExpenseCategory: "Accommodation",
    ExpenseDate: "2025-11-18",
    Amount: 220.00,
    Currency: "GBP",
    Description: "Hotel - 1 night ExCeL London",
    ReceiptAttached: true,
    VATAmount: 36.67,
    VATCode: "V1",
    MerchantName: "Premier Inn",
    IsReimbursable: true,
  },
  {
    LineItemID: "LI-0002-004",
    ExpenseReportID: "EXP-2025-0002",
    ExpenseCategory: "Meals_Subsistence",
    ExpenseDate: "2025-11-18",
    Amount: 35.00,
    Currency: "GBP",
    Description: "Evening meal",
    ReceiptAttached: true,
    VATAmount: 5.83,
    VATCode: "V1",
    MerchantName: "Pret a Manger",
    IsReimbursable: true,
  },
  {
    LineItemID: "LI-0002-005",
    ExpenseReportID: "EXP-2025-0002",
    ExpenseCategory: "Meals_Subsistence",
    ExpenseDate: "2025-11-19",
    Amount: 18.00,
    Currency: "GBP",
    Description: "Lunch",
    ReceiptAttached: false,
    VATAmount: 3.00,
    VATCode: "V1",
    MerchantName: "Various",
    IsReimbursable: true,
  },
  {
    LineItemID: "LI-0002-006",
    ExpenseReportID: "EXP-2025-0002",
    ExpenseCategory: "Travel_Taxi",
    ExpenseDate: "2025-11-19",
    Amount: 228.00,
    Currency: "GBP",
    Description: "Taxi Heathrow to ExCeL return",
    ReceiptAttached: true,
    VATAmount: 38.00,
    VATCode: "V1",
    MerchantName: "Addison Lee",
    IsReimbursable: true,
  },
];
