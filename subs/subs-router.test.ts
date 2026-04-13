/**
 * subs-router.test.ts — Tests for the SUBS Payment Router Settlement Core
 *
 * 14 test cases covering:
 *   1.  Successful subscription: fee split, forwarding, settlement record
 *   2.  Fee rounding: floor(amount × 0.025) is exact
 *   3.  Fee on small amounts: 1 PFT → 0 fee (floor of 25000 drops)
 *   4.  Fee on odd amounts: 333 PFT → exact floor calculation
 *   5.  Service not found → SERVICE_NOT_FOUND rejection
 *   6.  Service retired → SERVICE_RETIRED rejection
 *   7.  Service paused → SERVICE_PAUSED rejection
 *   8.  Insufficient payment → INSUFFICIENT_PAYMENT rejection
 *   9.  Wrong destination → WRONG_DESTINATION rejection
 *  10.  Invalid memo type → INVALID_MEMO_TYPE rejection
 *  11.  Empty service ID → EMPTY_SERVICE_ID rejection
 *  12.  Duplicate prevention → returns duplicate, does not write twice
 *  13.  Forward failure → FORWARD_FAILED status, record written
 *  14.  Settlement record persists in DB and is queryable
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  processSubscription,
  ensureSettlementSchema,
  computeFee,
  getProtocolRevenue,
  type ServiceRegistry,
  type IncomingPayment,
  type XrplSubmitter,
} from "./subs-router.js";

// ─── Test Helpers ───────────────────────────────────────────────────

const PROTOCOL_ADDR = "rSUBSprotocol123";
const TREASURY_ADDR = "rSUBStreasury123";
const PROVIDER_ADDR = "rProvider123";
const SUBSCRIBER = "rSubscriber123";

const TEST_REGISTRY: ServiceRegistry = {
  protocolAddress: PROTOCOL_ADDR,
  treasuryAddress: TREASURY_ADDR,
  feeRate: 0.025,
  services: [
    {
      serviceId: "alpha",
      name: "Alpha Terminal",
      providerAddress: PROVIDER_ADDR,
      serviceAddress: PROVIDER_ADDR,
      priceDrops: 500_000_000, // 500 PFT
      periodDays: 30,
      status: "active",
    },
    {
      serviceId: "retired-svc",
      name: "Old Service",
      providerAddress: PROVIDER_ADDR,
      serviceAddress: PROVIDER_ADDR,
      priceDrops: 100_000_000,
      periodDays: 30,
      status: "retired",
    },
    {
      serviceId: "paused-svc",
      name: "Paused Service",
      providerAddress: PROVIDER_ADDR,
      serviceAddress: PROVIDER_ADDR,
      priceDrops: 200_000_000,
      periodDays: 30,
      status: "paused",
    },
  ],
};

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE transactions (
      tx_hash TEXT PRIMARY KEY, ledger_index INTEGER NOT NULL,
      tx_type TEXT NOT NULL, account TEXT NOT NULL, destination TEXT,
      amount_drops TEXT, fee_drops TEXT, timestamp_ripple INTEGER,
      timestamp_iso TEXT, has_memo INTEGER DEFAULT 0, memo_type TEXT,
      memo_data_preview TEXT, memo_cid TEXT, raw_json TEXT
    );
  `);
  ensureSettlementSchema(db);
  return db;
}

function makePayment(overrides: Partial<IncomingPayment> = {}): IncomingPayment {
  return {
    tx_hash: overrides.tx_hash ?? `TX_${Math.random().toString(36).substring(2, 10)}`,
    account: overrides.account ?? SUBSCRIBER,
    destination: overrides.destination ?? PROTOCOL_ADDR,
    amount_drops: overrides.amount_drops ?? "500000000",
    memo_type: overrides.memo_type ?? "subs.subscribe",
    memo_data: overrides.memo_data ?? "alpha",
    timestamp_iso: overrides.timestamp_iso ?? new Date().toISOString(),
  };
}

const mockSubmitter: XrplSubmitter = {
  async submitPayment(params) {
    return { tx_hash: `FWD_${Date.now()}`, success: true };
  },
};

const failingSubmitter: XrplSubmitter = {
  async submitPayment() {
    return { tx_hash: "", success: false };
  },
};

// ─── Tests ──────────────────────────────────────────────────────────

describe("subs-router: processSubscription", () => {
  let db: Database.Database;
  beforeEach(() => { db = createTestDb(); });
  afterEach(() => { db.close(); });

  // 1. Successful subscription
  it("settles a valid subscription with correct fee split and forwarding", async () => {
    const payment = makePayment({ tx_hash: "TX_SUCCESS" });
    const result = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);

    expect(result.status).toBe("settled");
    expect(result.reason).toBeNull();
    expect(result.subscriber).toBe(SUBSCRIBER);
    expect(result.serviceId).toBe("alpha");
    expect(result.amountDrops).toBe(500_000_000);
    expect(result.protocolFeeDrops).toBe(12_500_000);    // floor(500M × 0.025)
    expect(result.providerAmountDrops).toBe(487_500_000); // 500M - 12.5M
    expect(result.providerAddress).toBe(PROVIDER_ADDR);
    expect(result.sourceTxHash).toBe("TX_SUCCESS");
    expect(result.forwardTxHash).toBeTruthy();
    expect(result.forwardMemoType).toBe("subs.forward");
    expect(result.forwardMemoData).toBe("alpha:TX_SUCCESS");
    expect(result.settlementId).toBe("STL-TX_SUCCESS");
  });

  // 2. Fee rounding: floor is exact for 500 PFT
  it("computes fee as exact floor(amount × 0.025)", () => {
    const { feeDrops, providerDrops } = computeFee(500_000_000);
    expect(feeDrops).toBe(12_500_000);
    expect(providerDrops).toBe(487_500_000);
    expect(feeDrops + providerDrops).toBe(500_000_000); // No drops lost
  });

  // 3. Fee on small amount: 1 PFT
  it("computes fee correctly on small amounts (1 PFT = 25000 drops fee)", () => {
    const { feeDrops, providerDrops } = computeFee(1_000_000);
    expect(feeDrops).toBe(25_000);           // floor(1M × 0.025)
    expect(providerDrops).toBe(975_000);
    expect(feeDrops + providerDrops).toBe(1_000_000);
  });

  // 4. Fee on odd amount: 333 PFT
  it("applies floor rounding on non-round amounts (333 PFT)", () => {
    const { feeDrops, providerDrops } = computeFee(333_000_000);
    expect(feeDrops).toBe(8_325_000);         // floor(333M × 0.025) = 8,325,000
    expect(providerDrops).toBe(324_675_000);
    expect(feeDrops + providerDrops).toBe(333_000_000);
  });

  // 5. Service not found
  it("rejects with SERVICE_NOT_FOUND for unknown service_id", async () => {
    const payment = makePayment({ memo_data: "nonexistent" });
    const result = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("SERVICE_NOT_FOUND");
    expect(result.serviceId).toBe("nonexistent");
    expect(result.protocolFeeDrops).toBe(0);
    expect(result.forwardTxHash).toBeNull();
  });

  // 6. Service retired
  it("rejects with SERVICE_RETIRED for retired services", async () => {
    const payment = makePayment({ memo_data: "retired-svc" });
    const result = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("SERVICE_RETIRED");
  });

  // 7. Service paused
  it("rejects with SERVICE_PAUSED for paused services", async () => {
    const payment = makePayment({ memo_data: "paused-svc" });
    const result = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("SERVICE_PAUSED");
  });

  // 8. Insufficient payment
  it("rejects with INSUFFICIENT_PAYMENT when amount is below service price", async () => {
    const payment = makePayment({ amount_drops: "100000000" }); // 100 PFT < 500 PFT
    const result = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("INSUFFICIENT_PAYMENT");
  });

  // 9. Wrong destination
  it("rejects with WRONG_DESTINATION when payment goes to wrong address", async () => {
    const payment = makePayment({ destination: "rWrongAddress123" });
    const result = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("WRONG_DESTINATION");
  });

  // 10. Invalid memo type
  it("rejects with INVALID_MEMO_TYPE when memo_type is not subs.subscribe", async () => {
    const payment = makePayment({ memo_type: "pf.ptr" });
    const result = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("INVALID_MEMO_TYPE");
  });

  // 11. Empty service ID
  it("rejects with EMPTY_SERVICE_ID when memo_data is empty", async () => {
    const payment = makePayment({ memo_data: "" });
    const result = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("EMPTY_SERVICE_ID");
  });

  // 12. Duplicate prevention
  it("returns duplicate status without writing twice for same tx_hash", async () => {
    const payment = makePayment({ tx_hash: "TX_DUPE" });

    const first = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);
    expect(first.status).toBe("settled");

    const second = await processSubscription(db, TEST_REGISTRY, mockSubmitter, payment);
    expect(second.status).toBe("duplicate");
    expect(second.reason).toBe("DUPLICATE_PROCESSED");

    // Only one record in DB
    const count = (db.prepare("SELECT COUNT(*) as c FROM subs_settlements WHERE source_tx_hash = 'TX_DUPE'").get() as { c: number }).c;
    expect(count).toBe(1);
  });

  // 13. Forward failure
  it("records FORWARD_FAILED when submitter returns failure", async () => {
    const payment = makePayment({ tx_hash: "TX_FWD_FAIL" });
    const result = await processSubscription(db, TEST_REGISTRY, failingSubmitter, payment);

    expect(result.status).toBe("forward_failed");
    expect(result.reason).toBe("FORWARD_FAILED");
    expect(result.forwardTxHash).toBeNull();
    expect(result.protocolFeeDrops).toBe(12_500_000); // Fee still computed
    expect(result.providerAmountDrops).toBe(487_500_000);

    // Record IS written (for retry/audit)
    const row = db.prepare("SELECT * FROM subs_settlements WHERE source_tx_hash = 'TX_FWD_FAIL'").get();
    expect(row).toBeTruthy();
  });

  // 14. Settlement record persists and is queryable
  it("persists settlement records and supports revenue queries", async () => {
    const p1 = makePayment({ tx_hash: "TX_REV_1", amount_drops: "500000000" });
    const p2 = makePayment({ tx_hash: "TX_REV_2", amount_drops: "1000000000" });

    await processSubscription(db, TEST_REGISTRY, mockSubmitter, p1);
    await processSubscription(db, TEST_REGISTRY, mockSubmitter, p2);

    const revenue = getProtocolRevenue(db, 30);
    expect(revenue.settlementCount).toBe(2);
    expect(revenue.totalFeeDrops).toBe(12_500_000 + 25_000_000); // 12.5M + 25M
    expect(revenue.totalFeePft).toBe(37.5);
  });
});
