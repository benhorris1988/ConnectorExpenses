export interface CostCentre {
  CostCentreID: string;
  Description: string;
  Department: string;
  BudgetHolder: string;
  AnnualBudget: number;
  Currency: string;
  ValidFrom: string;
  ValidTo: string;
  IsActive: boolean;
}

export interface WBSElement {
  WBSCode: string;
  Description: string;
  ProjectID: string;
  CostCentreID: string;
  BudgetAmount: number;
  Currency: string;
  StartDate: string;
  EndDate: string;
  Status: "Active" | "Closed" | "Pending";
}

export const costCentres: CostCentre[] = [
  {
    CostCentreID: "CC100",
    Description: "Finance & Accounting",
    Department: "Finance",
    BudgetHolder: "EMP010",
    AnnualBudget: 250000,
    Currency: "GBP",
    ValidFrom: "2024-01-01",
    ValidTo: "2026-12-31",
    IsActive: true,
  },
  {
    CostCentreID: "CC200",
    Description: "Information Technology",
    Department: "IT",
    BudgetHolder: "EMP011",
    AnnualBudget: 480000,
    Currency: "GBP",
    ValidFrom: "2024-01-01",
    ValidTo: "2026-12-31",
    IsActive: true,
  },
  {
    CostCentreID: "CC300",
    Description: "Human Resources",
    Department: "HR",
    BudgetHolder: "EMP012",
    AnnualBudget: 150000,
    Currency: "GBP",
    ValidFrom: "2024-01-01",
    ValidTo: "2026-12-31",
    IsActive: true,
  },
  {
    CostCentreID: "CC400",
    Description: "Operations & Delivery",
    Department: "Operations",
    BudgetHolder: "EMP013",
    AnnualBudget: 320000,
    Currency: "GBP",
    ValidFrom: "2024-01-01",
    ValidTo: "2026-12-31",
    IsActive: true,
  },
  {
    CostCentreID: "CC500",
    Description: "Sales & Business Development",
    Department: "Sales",
    BudgetHolder: "EMP009",
    AnnualBudget: 600000,
    Currency: "GBP",
    ValidFrom: "2024-01-01",
    ValidTo: "2026-12-31",
    IsActive: true,
  },
  {
    CostCentreID: "CC600",
    Description: "Marketing",
    Department: "Marketing",
    BudgetHolder: "EMP015",
    AnnualBudget: 200000,
    Currency: "GBP",
    ValidFrom: "2024-01-01",
    ValidTo: "2026-12-31",
    IsActive: true,
  },
  {
    CostCentreID: "CC900",
    Description: "Legacy Systems (Decommissioned)",
    Department: "IT",
    BudgetHolder: "EMP011",
    AnnualBudget: 0,
    Currency: "GBP",
    ValidFrom: "2020-01-01",
    ValidTo: "2023-12-31",
    IsActive: false,
  },
];

export const wbsElements: WBSElement[] = [
  {
    WBSCode: "PRJ-2024-001",
    Description: "ERP Migration Phase 1",
    ProjectID: "P2024001",
    CostCentreID: "CC200",
    BudgetAmount: 120000,
    Currency: "GBP",
    StartDate: "2024-01-01",
    EndDate: "2024-06-30",
    Status: "Closed",
  },
  {
    WBSCode: "PRJ-2024-002",
    Description: "ERP Migration Phase 2",
    ProjectID: "P2024001",
    CostCentreID: "CC200",
    BudgetAmount: 95000,
    Currency: "GBP",
    StartDate: "2024-07-01",
    EndDate: "2025-03-31",
    Status: "Closed",
  },
  {
    WBSCode: "PRJ-2025-001",
    Description: "BiFrost Connector Implementation",
    ProjectID: "P2025001",
    CostCentreID: "CC200",
    BudgetAmount: 75000,
    Currency: "GBP",
    StartDate: "2025-01-01",
    EndDate: "2025-12-31",
    Status: "Active",
  },
  {
    WBSCode: "PRJ-2025-002",
    Description: "Finance Systems Upgrade",
    ProjectID: "P2025002",
    CostCentreID: "CC100",
    BudgetAmount: 45000,
    Currency: "GBP",
    StartDate: "2025-03-01",
    EndDate: "2025-09-30",
    Status: "Active",
  },
  {
    WBSCode: "PRJ-2025-003",
    Description: "HR Self-Service Portal",
    ProjectID: "P2025003",
    CostCentreID: "CC300",
    BudgetAmount: 30000,
    Currency: "GBP",
    StartDate: "2025-06-01",
    EndDate: "2025-12-31",
    Status: "Active",
  },
  {
    WBSCode: "PRJ-2026-001",
    Description: "Data Platform Modernisation",
    ProjectID: "P2026001",
    CostCentreID: "CC200",
    BudgetAmount: 200000,
    Currency: "GBP",
    StartDate: "2026-01-01",
    EndDate: "2026-12-31",
    Status: "Pending",
  },
];
