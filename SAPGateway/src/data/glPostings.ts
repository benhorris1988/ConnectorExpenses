export interface GLPosting {
  DocumentNumber: string;
  FiscalYear: string;
  CompanyCode: string;
  DocumentDate: string;
  PostingDate: string;
  DocumentType: string;
  DocumentTypeDesc: string;
  Currency: string;
  Reference: string;
  HeaderText: string;
  PostedBy: string;
  Status: "Posted" | "Reversed" | "Parked";
}

export interface GLLineItem {
  LineItemID: string;
  DocumentNumber: string;
  FiscalYear: string;
  LineNumber: string;
  GLAccount: string;
  GLAccountDesc: string;
  CostCentreID: string | null;
  WBSCode: string | null;
  PostingKey: string;
  DebitCredit: "D" | "C";
  Amount: number;
  Currency: string;
  TaxCode: string | null;
  TaxAmount: number;
  AssignmentField: string;
  ItemText: string;
}

export const glPostings: GLPosting[] = [
  { DocumentNumber: "1800000001", FiscalYear: "2025", CompanyCode: "GB01", DocumentDate: "2025-11-14", PostingDate: "2025-11-14", DocumentType: "ZP", DocumentTypeDesc: "Payment", Currency: "GBP", Reference: "EXP-2025-0001", HeaderText: "Expense reimbursement - Alice Thompson", PostedBy: "EMP006", Status: "Posted" },
  { DocumentNumber: "1800000002", FiscalYear: "2025", CompanyCode: "GB01", DocumentDate: "2025-11-30", PostingDate: "2025-11-30", DocumentType: "KR", DocumentTypeDesc: "Vendor Invoice", Currency: "GBP", Reference: "INV-CS-2025-1189", HeaderText: "CloudSoft - BiFrost Licence & Impl", PostedBy: "EMP006", Status: "Posted" },
  { DocumentNumber: "1800000003", FiscalYear: "2025", CompanyCode: "GB01", DocumentDate: "2025-12-01", PostingDate: "2025-12-01", DocumentType: "SA", DocumentTypeDesc: "G/L Account Posting", Currency: "GBP", Reference: "ACCRUAL-DEC-2025", HeaderText: "Monthly accrual - IT projects", PostedBy: "EMP006", Status: "Posted" },
  { DocumentNumber: "1800000004", FiscalYear: "2025", CompanyCode: "GB01", DocumentDate: "2025-12-31", PostingDate: "2025-12-31", DocumentType: "SA", DocumentTypeDesc: "G/L Account Posting", Currency: "GBP", Reference: "YE-CLOSE-2025", HeaderText: "Year-end closing entries", PostedBy: "EMP006", Status: "Posted" },
  { DocumentNumber: "1900000001", FiscalYear: "2026", CompanyCode: "GB01", DocumentDate: "2026-01-15", PostingDate: "2026-01-15", DocumentType: "KR", DocumentTypeDesc: "Vendor Invoice", Currency: "GBP", Reference: "INV-MH-2026-0022", HeaderText: "Marriott Hotels - Edinburgh Q1", PostedBy: "EMP006", Status: "Posted" },
  { DocumentNumber: "1900000002", FiscalYear: "2026", CompanyCode: "GB01", DocumentDate: "2026-02-01", PostingDate: "2026-02-01", DocumentType: "SA", DocumentTypeDesc: "G/L Account Posting", Currency: "GBP", Reference: "ACCRUAL-JAN-2026", HeaderText: "Monthly accrual - Jan 2026", PostedBy: "EMP006", Status: "Posted" },
  { DocumentNumber: "1900000003", FiscalYear: "2026", CompanyCode: "GB01", DocumentDate: "2026-03-10", PostingDate: "2026-03-10", DocumentType: "ZP", DocumentTypeDesc: "Payment", Currency: "GBP", Reference: "EXP-2025-0002", HeaderText: "Expense reimbursement - Ben Hargreaves", PostedBy: "EMP006", Status: "Posted" },
  { DocumentNumber: "1900000004", FiscalYear: "2026", CompanyCode: "GB01", DocumentDate: "2026-03-15", PostingDate: "2026-03-15", DocumentType: "KR", DocumentTypeDesc: "Vendor Invoice", Currency: "GBP", Reference: "INV-CS-2026-0041", HeaderText: "CloudSoft - Data Platform M4", PostedBy: "EMP006", Status: "Reversed" },
];

export const glLineItems: GLLineItem[] = [
  // Document 1800000001 - Expense payment
  { LineItemID: "1800000001-1", DocumentNumber: "1800000001", FiscalYear: "2025", LineNumber: "1", GLAccount: "115000", GLAccountDesc: "Accounts Payable - Employees", CostCentreID: null, WBSCode: null, PostingKey: "31", DebitCredit: "C", Amount: 487.50, Currency: "GBP", TaxCode: null, TaxAmount: 0, AssignmentField: "EXP-2025-0001", ItemText: "Expense claim EMP001" },
  { LineItemID: "1800000001-2", DocumentNumber: "1800000001", FiscalYear: "2025", LineNumber: "2", GLAccount: "470000", GLAccountDesc: "Travel Expenses", CostCentreID: "CC500", WBSCode: null, PostingKey: "40", DebitCredit: "D", Amount: 449.00, Currency: "GBP", TaxCode: "Z0", TaxAmount: 0, AssignmentField: "EXP-2025-0001", ItemText: "Travel - Manchester client visit" },
  { LineItemID: "1800000001-3", DocumentNumber: "1800000001", FiscalYear: "2025", LineNumber: "3", GLAccount: "472000", GLAccountDesc: "Subsistence & Meals", CostCentreID: "CC500", WBSCode: null, PostingKey: "40", DebitCredit: "D", Amount: 35.42, Currency: "GBP", TaxCode: "V1", TaxAmount: 7.08, AssignmentField: "EXP-2025-0001", ItemText: "Subsistence - Manchester" },
  { LineItemID: "1800000001-4", DocumentNumber: "1800000001", FiscalYear: "2025", LineNumber: "4", GLAccount: "175000", GLAccountDesc: "Input VAT", CostCentreID: null, WBSCode: null, PostingKey: "40", DebitCredit: "D", Amount: 38.58, Currency: "GBP", TaxCode: "V1", TaxAmount: 38.58, AssignmentField: "EXP-2025-0001", ItemText: "VAT on expenses" },
  // Document 1800000002 - CloudSoft vendor invoice
  { LineItemID: "1800000002-1", DocumentNumber: "1800000002", FiscalYear: "2025", LineNumber: "1", GLAccount: "160000", GLAccountDesc: "Accounts Payable - Vendors", CostCentreID: null, WBSCode: null, PostingKey: "31", DebitCredit: "C", Amount: 28800.00, Currency: "GBP", TaxCode: null, TaxAmount: 0, AssignmentField: "4500001001", ItemText: "Vendor: V100003 CloudSoft" },
  { LineItemID: "1800000002-2", DocumentNumber: "1800000002", FiscalYear: "2025", LineNumber: "2", GLAccount: "476000", GLAccountDesc: "Software Licences", CostCentreID: "CC200", WBSCode: "PRJ-2025-001", PostingKey: "40", DebitCredit: "D", Amount: 12000.00, Currency: "GBP", TaxCode: "V1", TaxAmount: 2000.00, AssignmentField: "4500001001", ItemText: "BiFrost Licence" },
  { LineItemID: "1800000002-3", DocumentNumber: "1800000002", FiscalYear: "2025", LineNumber: "3", GLAccount: "476100", GLAccountDesc: "IT Consultancy", CostCentreID: "CC200", WBSCode: "PRJ-2025-001", PostingKey: "40", DebitCredit: "D", Amount: 12000.00, Currency: "GBP", TaxCode: "V1", TaxAmount: 2000.00, AssignmentField: "4500001001", ItemText: "Implementation 10 days" },
  { LineItemID: "1800000002-4", DocumentNumber: "1800000002", FiscalYear: "2025", LineNumber: "4", GLAccount: "175000", GLAccountDesc: "Input VAT", CostCentreID: null, WBSCode: null, PostingKey: "40", DebitCredit: "D", Amount: 4800.00, Currency: "GBP", TaxCode: "V1", TaxAmount: 4800.00, AssignmentField: "4500001001", ItemText: "VAT on CloudSoft invoice" },
];
