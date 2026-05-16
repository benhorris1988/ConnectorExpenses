import express from "express";
import cors from "cors";
import hrMasterRoutes from "./routes/hrMaster";
import costCodeRoutes from "./routes/costCodes";
import expenseRoutes from "./routes/expenses";
import vendorRoutes from "./routes/vendorMaster";
import poRoutes from "./routes/purchaseOrders";
import glRoutes from "./routes/glPostings";
import readApiRoutes from "./routes/readApi";
import { getDb, closeDb } from "./db/surreal";
import { startScheduler, seedEntityConfigs } from "./scheduler/syncJob";

const app = express();
const PORT = 3001;
const SCHEDULER_CRON = process.env.SCHEDULER_CRON ?? "*/5 * * * *";

app.use(cors());
app.use(express.json());

// ── OData $metadata ────────────────────────────────────────────────────────────
app.get("/sap/opu/odata/sap/:service/$metadata", (req, res) => {
  res.setHeader("Content-Type", "application/xml");
  res.send(`<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices m:DataServiceVersion="2.0" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
    <Schema Namespace="${req.params["service"]}" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">
      <EntityContainer Name="${req.params["service"]}_Entities" m:IsDefaultEntityContainer="true"/>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`);
});

// ── OData routes ───────────────────────────────────────────────────────────────
app.use("/sap/opu/odata/sap/HCM_HR_MASTER",   hrMasterRoutes);
app.use("/sap/opu/odata/sap/BIFROST_COST",    costCodeRoutes);
app.use("/sap/opu/odata/sap/BIFROST_EXPENSES", expenseRoutes);
app.use("/sap/opu/odata/sap/BIFROST_VENDOR",  vendorRoutes);
app.use("/sap/opu/odata/sap/BIFROST_MM",      poRoutes);
app.use("/sap/opu/odata/sap/BIFROST_FI",      glRoutes);

// ── BiFrost Read API (queried by the frontend) ─────────────────────────────────
app.use("/api", readApiRoutes);

// ── Health & info ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "BiFrost SAP OData Gateway", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({
    service: "BiFrost Fake SAP OData Gateway",
    version: "2.0.0",
    odata: {
      hrMaster:       "/sap/opu/odata/sap/HCM_HR_MASTER/EmployeeSet",
      costCentres:    "/sap/opu/odata/sap/BIFROST_COST/CostCentreSet",
      wbsElements:    "/sap/opu/odata/sap/BIFROST_COST/WBSElementSet",
      vendors:        "/sap/opu/odata/sap/BIFROST_VENDOR/VendorSet",
      expenseReports: "/sap/opu/odata/sap/BIFROST_EXPENSES/ExpenseReportSet",
      purchaseOrders: "/sap/opu/odata/sap/BIFROST_MM/PurchaseOrderSet",
      glPostings:     "/sap/opu/odata/sap/BIFROST_FI/GLPostingSet",
    },
    readApi: {
      entities: "/api/entities",
      batches:  "/api/batches",
      stats:    "/api/stats",
      records:  "/api/records/:table",
    },
  });
});

async function start() {
  try {
    await getDb();

    app.listen(PORT, () => {
      console.log(`\n BiFrost SAP OData Gateway v2 — http://localhost:${PORT}`);
      console.log(` OData services: HR, Cost, Expenses, Vendor, MM (PO), FI (GL)`);
      console.log(` Read API:       http://localhost:${PORT}/api/entities`);
      console.log(` Scheduler:      ${SCHEDULER_CRON}\n`);
    });

    await seedEntityConfigs();
    startScheduler(SCHEDULER_CRON);
  } catch (err) {
    console.error("[Gateway] Failed to start:", err);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await closeDb();
  process.exit(0);
});

start();
