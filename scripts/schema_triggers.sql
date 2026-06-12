-- ============================================================================
-- 🏛️ South African Funeral Insurance Data Warehouse Integration Suite
-- Database Automation Layer: PL/pgSQL Transaction Triggers & Metrics
-- File: scripts/schema_triggers.sql
-- ============================================================================

-- This script serves as a production-grade blueprint for database architects.
-- It establishes a transactional automation system on the relational warehouse 
-- (PostgreSQL) to handle real-time metric calculation, automatic grace-period
-- lapse transitions, and data integrity constraints.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Automatic Grace-Period Policy Lapse Enforcer
-- Under South African underwriting guidelines (long-term insurance conventions),
-- policies must be maintained during a grace period. If three consecutive 
-- premium installments (debit order runs) are returned 'Unpaid', the policy is 
-- automatically transitioned into a 'Lapsed' status.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION process_installment_bounce() 
RETURNS TRIGGER AS $$
DECLARE
    consecutive_bounces INT;
    v_policy_status VARCHAR(50);
BEGIN
    -- Only act on Unpaid or Bounced debit order statuses
    IF NEW.status = 'Unpaid' OR NEW.status = 'Bounced' THEN
        
        -- Double-check that the policy is currently in an Active state 
        -- inside the parent policy register
        SELECT status INTO v_policy_status
        FROM fact_policy
        WHERE policy_id = NEW.policy_key;
        
        -- Skip calculations for policies that have already been Lapsed or Claimed
        IF v_policy_status <> 'Active' THEN
            RETURN NEW;
        END IF;

        -- Count unpaid occurrences over the last 90 days
        SELECT COUNT(*) INTO consecutive_bounces 
        FROM fact_premium 
        WHERE policy_key = NEW.policy_key 
          AND (status = 'Unpaid' OR status = 'Bounced')
          AND record_date >= NEW.record_date - INTERVAL '90 days';

        -- If policy has accumulated 3 failed cycles, trigger standard lapse
        IF consecutive_bounces >= 3 THEN
            RAISE NOTICE 'Policy ID % has failed 3 consecutive debit orders. Upgrading state to Lapsed.', NEW.policy_key;
            
            UPDATE fact_policy 
            SET 
                status = 'Lapsed', 
                lapse_date = NEW.record_date::text,
                total_premium_collected = total_premium_collected -- maintain current collect state
            WHERE policy_id = NEW.policy_key;
        END IF;
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the fact_premium table
DROP TRIGGER IF EXISTS trg_premium_installment_bounce ON fact_premium;
CREATE TRIGGER trg_premium_installment_bounce
    AFTER INSERT OR UPDATE ON fact_premium
    FOR EACH ROW
    EXECUTE FUNCTION process_installment_bounce();


-- ----------------------------------------------------------------------------
-- 2. Audit Trail for Policy Status Changes (Compliance Standard)
-- Captures state transitions to ensure accurate records for the South African 
-- Financial Sector Conduct Authority (FSCA) audits and POPIA compliance logs.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS compliance_status_log (
    log_id SERIAL PRIMARY KEY,
    policy_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    change_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    db_user VARCHAR(100) DEFAULT CURRENT_USER
);

CREATE OR REPLACE FUNCTION log_policy_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO compliance_status_log (policy_id, old_status, new_status)
        VALUES (NEW.policy_id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach status change logger to fact_policy
DROP TRIGGER IF EXISTS trg_log_policy_status ON fact_policy;
CREATE TRIGGER trg_log_policy_status
    AFTER UPDATE OF status ON fact_policy
    FOR EACH ROW
    EXECUTE FUNCTION log_policy_status_transition();


-- ----------------------------------------------------------------------------
-- 3. Actuarial Metrics View
-- Generates annualized dashboards representing Persistency Metrics (Lapse ratios,
-- collected premiums, claim payouts) categorized by Local branch offices.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW v_branch_actuarial_dashboard AS
SELECT 
    b.branch_key,
    b.branch_name,
    b.region,
    COUNT(DISTINCT p.policy_id) AS total_policies_issued,
    SUM(CASE WHEN p.status = 'Active' THEN 1 ELSE 0 END) AS active_policies,
    SUM(CASE WHEN p.status = 'Lapsed' THEN 1 ELSE 0 END) AS lapsed_policies,
    -- Formula: Lapse Ratio = (Lapsed Count / Total Core Issued) * 100
    ROUND(
        (SUM(CASE WHEN p.status = 'Lapsed' THEN 1.0 ELSE 0.0 END) / NULLIF(COUNT(DISTINCT p.policy_id), 0)) * 100, 
        2
    ) AS lapse_ratio,
    COALESCE(SUM(p.total_premium_collected), 0.0) AS premium_collections,
    COALESCE(SUM(c.claim_amount), 0.0) AS total_claims_paid
FROM dim_branch b
LEFT JOIN fact_policy p ON b.branch_key = p.branch_key
LEFT JOIN fact_claim c ON p.policy_id = c.policy_key AND c.approval_status = 'Approved'
GROUP BY b.branch_key, b.branch_name, b.region;

COMMIT;
