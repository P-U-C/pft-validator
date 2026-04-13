/**
 * subs-router.ts — SUBS Payment Router Settlement Core
 *
 * Watches incoming subscribe payments to the SUBS protocol address,
 * validates each against the live service registry, retains the protocol
 * fee using floor(amount × 0.025), and forwards the remainder to the
 * provider with auditable memo linkage to the source transaction.
 *
 * Designed as a reusable module consumable by the bot loop, verifier,
 * and marketplace surfaces. Handles duplicate processing and all
 * invalid-payment branches explicitly.
 *
 * Protocol spec: https://github.com/P-U-C/pft-validator/blob/main/subs-protocol.md
 *
 * ─── Sample Input / Output ──────────────────────────────────────────────
 *
 * Input:
 *   processSubscription(db, registry, xrplClient, {
 *     tx_hash: "AAA111...",
 *     account: "rSubscriber...",
 *     destination: "rSUBSprotocol...",
 *     amount_drops: "500000000",
 *     memo_type: "subs.subscribe",
 *     memo_data: "alpha",
 *     timestamp_iso: "2026-04-13T10:00:00Z",
 *   })
 *
 * Output (success):
 *   {
 *     status: "settled",
 *     subscriber: "rSubscriber...",
 *     serviceId: "alpha",
 *     amountDrops: 500000000,
 *     protocolFeeDrops: 12500000,
 *     providerAmountDrops: 487500000,
 *     providerAddress: "rProvider...",
 *     sourceTxHash: "AAA111...",
 *     forwardTxHash: "FWD222...",
 *     settlementId: "STL-AAA111...",
 *     settledAt: "2026-04-13T10:00:05Z",
 *   }
 *
 * Output (rejection):
 *   {
 *     status: "rejected",
 *     reason: "SERVICE_NOT_FOUND",
 *     subscriber: "rSubscriber...",
 *     serviceId: "unknown_service",
 *     sourceTxHash: "BBB222...",
 *   }
 */

import type Database from "better-sqlite3";

// ─── Types ──────────────────────────────────────────────────────────

/** A service entry in the live registry */
export interface ServiceRegistryEntry {
  serviceId: string;
  name: string;
  providerAddress: string;
  serviceAddress: string;
  priceDrops: number;
  periodDays: number;
  status: "active" | "paused" | "retired";
}

/** The full service registry (in-memory, loaded from subs.json or DB) */
export interface ServiceRegistry {
  services: ServiceRegistryEntry[];
  protocolAddress: string;
  treasuryAddress: string;
  feeRate: number; // 0.025 = 2.5%
}

/** An incoming subscription payment to process */
export interface IncomingPayment {
  tx_hash: string;
  account: string;      // subscriber
  destination: string;  // should be protocol address
  amount_drops: string;
  memo_type: string;
  memo_data: string;    // service_id
  timestamp_iso: string;
}

/** Interface for submitting XRPL transactions */
export interface XrplSubmitter {
  submitPayment(params: {
    destination: string;
    amountDrops: string;
    memoType: string;
    memoData: string;
  }): Promise<{ tx_hash: string; success: boolean }>;
}

// ─── Settlement Record ──────────────────────────────────────────────

export type SettlementStatus = "settled" | "rejected" | "duplicate" | "forward_failed";

export type RejectionReason =
  | "SERVICE_NOT_FOUND"
  | "SERVICE_RETIRED"
  | "SERVICE_PAUSED"
  | "INSUFFICIENT_PAYMENT"
  | "WRONG_DESTINATION"
  | "INVALID_MEMO_TYPE"
  | "EMPTY_SERVICE_ID"
  | "DUPLICATE_PROCESSED"
  | "FORWARD_FAILED";

export interface SettlementRecord {
  /** Unique settlement identifier: "STL-{source_tx_hash}" */
  settlementId: string;
  /** Processing outcome */
  status: SettlementStatus;
  /** Reason code if rejected */
  reason: RejectionReason | null;
  /** Subscriber address */
  subscriber: string;
  /** Service ID from memo_data */
  serviceId: string;
  /** Provider address that received the forwarded payment */
  providerAddress: string | null;
  /** Original payment amount in drops */
  amountDrops: number;
  /** Protocol fee retained: floor(amount × 0.025) */
  protocolFeeDrops: number;
  /** Amount forwarded to provider: amount - fee */
  providerAmountDrops: number;
  /** Hash of the original subscription payment */
  sourceTxHash: string;
  /** Hash of the forwarding transaction, null if not forwarded */
  forwardTxHash: string | null;
  /** Memo on the forwarding transaction: "subs.forward" */
  forwardMemoType: string | null;
  /** Memo data on forward: "{service_id}:{source_tx_hash}" */
  forwardMemoData: string | null;
  /** ISO timestamp of settlement processing */
  settledAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────

const PROTOCOL_FEE_RATE = 0.025;
const MEMO_TYPE_SUBSCRIBE = "subs.subscribe";
const MEMO_TYPE_FORWARD = "subs.forward";

// ─── Settlement Log Schema ──────────────────────────────────────────

/**
 * Ensure the subs_settlements table exists in the chain index database.
 * Call once at startup.
 */
export function ensureSettlementSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS subs_settlements (
      settlement_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      reason TEXT,
      subscriber TEXT NOT NULL,
      service_id TEXT NOT NULL,
      provider_address TEXT,
      amount_drops INTEGER NOT NULL,
      protocol_fee_drops INTEGER NOT NULL,
      provider_amount_drops INTEGER NOT NULL,
      source_tx_hash TEXT NOT NULL UNIQUE,
      forward_tx_hash TEXT,
      forward_memo_type TEXT,
      forward_memo_data TEXT,
      settled_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_settlements_subscriber ON subs_settlements(subscriber);
    CREATE INDEX IF NOT EXISTS idx_settlements_service ON subs_settlements(service_id);
    CREATE INDEX IF NOT EXISTS idx_settlements_source ON subs_settlements(source_tx_hash);
  `);
}

// ─── Fee Calculation ────────────────────────────────────────────────

/**
 * Compute protocol fee using floor(amount × rate).
 * Deterministic: same inputs always produce same outputs.
 */
export function computeFee(amountDrops: number, feeRate: number = PROTOCOL_FEE_RATE): {
  feeDrops: number;
  providerDrops: number;
} {
  const feeDrops = Math.floor(amountDrops * feeRate);
  const providerDrops = amountDrops - feeDrops;
  return { feeDrops, providerDrops };
}

// ─── Registry Lookup ────────────────────────────────────────────────

function findService(registry: ServiceRegistry, serviceId: string): ServiceRegistryEntry | null {
  return registry.services.find(s => s.serviceId === serviceId) ?? null;
}

// ─── Duplicate Check ────────────────────────────────────────────────

function isDuplicate(db: Database.Database, sourceTxHash: string): boolean {
  const row = db.prepare(
    "SELECT 1 FROM subs_settlements WHERE source_tx_hash = ?"
  ).get(sourceTxHash);
  return row !== undefined;
}

// ─── Write Settlement Record ────────────────────────────────────────

function writeSettlement(db: Database.Database, record: SettlementRecord): void {
  db.prepare(`
    INSERT INTO subs_settlements
    (settlement_id, status, reason, subscriber, service_id, provider_address,
     amount_drops, protocol_fee_drops, provider_amount_drops,
     source_tx_hash, forward_tx_hash, forward_memo_type, forward_memo_data, settled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.settlementId,
    record.status,
    record.reason,
    record.subscriber,
    record.serviceId,
    record.providerAddress,
    record.amountDrops,
    record.protocolFeeDrops,
    record.providerAmountDrops,
    record.sourceTxHash,
    record.forwardTxHash,
    record.forwardMemoType,
    record.forwardMemoData,
    record.settledAt,
  );
}

// ─── Core: Process a Subscription Payment ───────────────────────────

/**
 * Process a single incoming subscription payment.
 *
 * Validates against the registry, computes the fee split, forwards
 * the provider's share, and writes a settlement record.
 *
 * @param db - chain-index.db with subs_settlements table
 * @param registry - live service registry
 * @param submitter - XRPL transaction submitter (or null for dry-run)
 * @param payment - incoming subscription payment
 * @returns Settlement record
 */
export async function processSubscription(
  db: Database.Database,
  registry: ServiceRegistry,
  submitter: XrplSubmitter | null,
  payment: IncomingPayment,
): Promise<SettlementRecord> {
  const now = new Date().toISOString();
  const settlementId = `STL-${payment.tx_hash}`;
  const amountDrops = parseInt(payment.amount_drops, 10);
  const serviceId = (payment.memo_data ?? "").trim();

  // ── Duplicate check ─────────────────────────────────────────────

  if (isDuplicate(db, payment.tx_hash)) {
    const record: SettlementRecord = {
      settlementId,
      status: "duplicate",
      reason: "DUPLICATE_PROCESSED",
      subscriber: payment.account,
      serviceId,
      providerAddress: null,
      amountDrops,
      protocolFeeDrops: 0,
      providerAmountDrops: 0,
      sourceTxHash: payment.tx_hash,
      forwardTxHash: null,
      forwardMemoType: null,
      forwardMemoData: null,
      settledAt: now,
    };
    // Don't write duplicate — it already exists
    return record;
  }

  // ── Validate destination ────────────────────────────────────────

  if (payment.destination !== registry.protocolAddress) {
    const record = buildRejection(
      settlementId, "WRONG_DESTINATION", payment, serviceId, amountDrops, now,
    );
    writeSettlement(db, record);
    return record;
  }

  // ── Validate memo type ──────────────────────────────────────────

  if (payment.memo_type !== MEMO_TYPE_SUBSCRIBE) {
    const record = buildRejection(
      settlementId, "INVALID_MEMO_TYPE", payment, serviceId, amountDrops, now,
    );
    writeSettlement(db, record);
    return record;
  }

  // ── Validate service ID present ─────────────────────────────────

  if (!serviceId) {
    const record = buildRejection(
      settlementId, "EMPTY_SERVICE_ID", payment, serviceId, amountDrops, now,
    );
    writeSettlement(db, record);
    return record;
  }

  // ── Registry lookup ─────────────────────────────────────────────

  const service = findService(registry, serviceId);

  if (!service) {
    const record = buildRejection(
      settlementId, "SERVICE_NOT_FOUND", payment, serviceId, amountDrops, now,
    );
    writeSettlement(db, record);
    return record;
  }

  // ── Service status check ────────────────────────────────────────

  if (service.status === "retired") {
    const record = buildRejection(
      settlementId, "SERVICE_RETIRED", payment, serviceId, amountDrops, now,
    );
    writeSettlement(db, record);
    return record;
  }

  if (service.status === "paused") {
    const record = buildRejection(
      settlementId, "SERVICE_PAUSED", payment, serviceId, amountDrops, now,
    );
    writeSettlement(db, record);
    return record;
  }

  // ── Validate payment amount ─────────────────────────────────────

  if (amountDrops < service.priceDrops) {
    const record = buildRejection(
      settlementId, "INSUFFICIENT_PAYMENT", payment, serviceId, amountDrops, now,
    );
    writeSettlement(db, record);
    return record;
  }

  // ── Compute fee split ───────────────────────────────────────────

  const { feeDrops, providerDrops } = computeFee(amountDrops, registry.feeRate);
  const forwardMemoData = `${serviceId}:${payment.tx_hash}`;

  // ── Forward payment to provider ─────────────────────────────────

  let forwardTxHash: string | null = null;

  if (submitter) {
    try {
      const result = await submitter.submitPayment({
        destination: service.providerAddress,
        amountDrops: String(providerDrops),
        memoType: MEMO_TYPE_FORWARD,
        memoData: forwardMemoData,
      });

      if (result.success) {
        forwardTxHash = result.tx_hash;
      } else {
        // Forward failed — record but don't reject (funds still in protocol address)
        const record: SettlementRecord = {
          settlementId,
          status: "forward_failed",
          reason: "FORWARD_FAILED",
          subscriber: payment.account,
          serviceId,
          providerAddress: service.providerAddress,
          amountDrops,
          protocolFeeDrops: feeDrops,
          providerAmountDrops: providerDrops,
          sourceTxHash: payment.tx_hash,
          forwardTxHash: null,
          forwardMemoType: MEMO_TYPE_FORWARD,
          forwardMemoData: forwardMemoData,
          settledAt: now,
        };
        writeSettlement(db, record);
        return record;
      }
    } catch {
      const record: SettlementRecord = {
        settlementId,
        status: "forward_failed",
        reason: "FORWARD_FAILED",
        subscriber: payment.account,
        serviceId,
        providerAddress: service.providerAddress,
        amountDrops,
        protocolFeeDrops: feeDrops,
        providerAmountDrops: providerDrops,
        sourceTxHash: payment.tx_hash,
        forwardTxHash: null,
        forwardMemoType: MEMO_TYPE_FORWARD,
        forwardMemoData: forwardMemoData,
        settledAt: now,
      };
      writeSettlement(db, record);
      return record;
    }
  }

  // ── Write settlement record ─────────────────────────────────────

  const record: SettlementRecord = {
    settlementId,
    status: "settled",
    reason: null,
    subscriber: payment.account,
    serviceId,
    providerAddress: service.providerAddress,
    amountDrops,
    protocolFeeDrops: feeDrops,
    providerAmountDrops: providerDrops,
    sourceTxHash: payment.tx_hash,
    forwardTxHash: forwardTxHash,
    forwardMemoType: MEMO_TYPE_FORWARD,
    forwardMemoData: forwardMemoData,
    settledAt: now,
  };

  writeSettlement(db, record);
  return record;
}

// ─── Batch: Process Pending Payments ────────────────────────────────

/**
 * Scan for unprocessed subscription payments and route them.
 * Called from the bot loop on each poll cycle.
 */
export async function processPendingSubscriptions(
  db: Database.Database,
  registry: ServiceRegistry,
  submitter: XrplSubmitter | null,
): Promise<SettlementRecord[]> {
  // Find all subs.subscribe payments to the protocol address
  // that don't have a settlement record yet
  const pending = db.prepare(`
    SELECT t.tx_hash, t.account, t.destination, t.amount_drops,
           t.memo_type, t.memo_data_preview as memo_data, t.timestamp_iso
    FROM transactions t
    WHERE t.destination = ?
      AND t.memo_type = 'subs.subscribe'
      AND t.tx_type = 'Payment'
      AND NOT EXISTS (
        SELECT 1 FROM subs_settlements s WHERE s.source_tx_hash = t.tx_hash
      )
    ORDER BY t.timestamp_iso ASC
  `).all(registry.protocolAddress) as IncomingPayment[];

  const results: SettlementRecord[] = [];
  for (const payment of pending) {
    const result = await processSubscription(db, registry, submitter, payment);
    results.push(result);
  }
  return results;
}

// ─── Query Helpers ──────────────────────────────────────────────────

/** Get all settlements for a subscriber */
export function getSubscriberSettlements(
  db: Database.Database,
  subscriber: string,
): SettlementRecord[] {
  return db.prepare(
    "SELECT * FROM subs_settlements WHERE subscriber = ? ORDER BY settled_at DESC"
  ).all(subscriber) as unknown as SettlementRecord[];
}

/** Get protocol revenue for a time window */
export function getProtocolRevenue(
  db: Database.Database,
  sinceDays: number = 30,
): { totalFeeDrops: number; totalFeePft: number; settlementCount: number } {
  const row = db.prepare(`
    SELECT COALESCE(SUM(protocol_fee_drops), 0) as total,
           COUNT(*) as cnt
    FROM subs_settlements
    WHERE status = 'settled'
    AND settled_at > datetime('now', ?)
  `).get(`-${sinceDays} days`) as { total: number; cnt: number };

  return {
    totalFeeDrops: row.total,
    totalFeePft: row.total / 1_000_000,
    settlementCount: row.cnt,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

function buildRejection(
  settlementId: string,
  reason: RejectionReason,
  payment: IncomingPayment,
  serviceId: string,
  amountDrops: number,
  now: string,
): SettlementRecord {
  return {
    settlementId,
    status: "rejected",
    reason,
    subscriber: payment.account,
    serviceId,
    providerAddress: null,
    amountDrops,
    protocolFeeDrops: 0,
    providerAmountDrops: 0,
    sourceTxHash: payment.tx_hash,
    forwardTxHash: null,
    forwardMemoType: null,
    forwardMemoData: null,
    settledAt: now,
  };
}
