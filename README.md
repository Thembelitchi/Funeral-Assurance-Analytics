# 🏛️ South African Funeral Insurance Data Warehouse Integration Guide

This guide is compiled for enterprise Group Risk Managers, ICT Directors, and Data Engineers of South African funeral assurers. It details how to connect the **Actuarial Persistency & Forensic Hub** visual platform directly to your core production insurance databases (such as **PostgreSQL, Microsoft SQL Server, Oracle, or Google Cloud SQL**).

Currently, this application runs on a high-performance in-memory and local SQLite star-schema representation populated with simulated actuary-approved records (8,000 policies across KwaZulu-Natal). This document provides step-by-step technical blueprints to map and route live operational databases to the visual analytics, text-to-SQL translator, and graph-theoretic forensic engine.

---

## 🗺️ Architectural Topology & Star Schema

The visual telemetry, executive briefing, and translation models read from an optimized Dimensional Model (Star Schema) representing premium cycles and lapse behaviors. Below is the structural schema of the tables as populated in the warehouse:

```
                  +-----------------------+
                  |      dim_plan         |
                  +-----------------------+
                  | plan_key (PK)         |
                  | plan_type (varch)     |
                  | base_premium (real)   |
                  +-----------+-----------+
                              |
                              | 1
                              |
                              | 0..*
+-----------------------+   +--+------------------------+   +-----------------------+
|      dim_branch       |   |       fact_policy         |   |       dim_date        |
+-----------------------+   +---------------------------+   +-----------------------+
| branch_key (PK)       |   | policy_id (PK)            |   | date_key (PK)         |
| branch_name (varch)   | 1 | branch_key (FK)           | 1 | full_date (text)      |
| region (varch)        +---+ plan_key (FK)             +---+ financial_year (int)  |
+-----------------------+   | agent_key (FK)            |   | financial_period (int)|
                            | inception_date_key (FK)   |   +-----------------------+
                            | status (varch)            |
                            | monthly_premium (real)    |
                            | months_on_books (int)     |
                            | total_premium_collected   |
                            | lapse_date (varch/null)   |
| 1                         | claim_date (varch/null)   |                         | 1
|                           +-------------+-------------+                         |
|                                         |                                       |
| 0..*                                    | 1                                     | 0..*
|                           0..*          |                                       |
|                           +-------------+-------------+                         |
|                           |       fact_claim          |                         |
|                           +---------------------------+                         |
|                           | claim_id (PK)             |                         |
+---------------------------+ policy_key (FK)           |                         |
                            | branch_key (FK)           |                         |
                            | claim_date_key (FK)  -----+-------------------------+
                            | claim_amount (real)       |
                            | claim_type (varch)        |
                            | cause_of_death (text)     |
                            | approval_status (varch)   |
                            | days_to_settlement (int)  |
                            +---------------------------+
```

### Table Definitions

#### 1. `dim_branch` (KZN Offices)
*   `branch_key` (INTEGER, Primary Key): Unique branch code (e.g., `1` for Durban Central, `2` for KwaMashu, `12` for Newcastle).
*   `branch_name` (VARCHAR): Standard localized branch office label.
*   `region` (VARCHAR): District Municipality (e.g., eThekwini Metro, iLembe, Amajuba).

#### 2. `dim_plan` (Funeral Plan Types)
*   `plan_key` (INTEGER, Primary Key): Unique identifier of the product ledger.
*   `plan_type` (VARCHAR): Name of coverage tier (e.g., 'Individual Standard', 'Family Plan', 'Senior Dignity', 'Community Group').
*   `base_premium` (REAL): Benchmark premium tier in South African Rand (ZAR).

#### 3. `dim_date` (Financial Calendar Sync)
*   `date_key` (INTEGER, Primary Key): YYYYMMDD code representing historical dates.
*   `full_date` (VARCHAR): Date representation string (`YYYY-MM-DD`).
*   `financial_year` (INTEGER): South African financial year calculation (March to February cycle).
*   `financial_period` (INTEGER): Month index adjusted for local cycle (March is Period 1, February is Period 12).

#### 4. `fact_policy` (Active & Historic Risk Records)
*   `policy_id` (INTEGER, Primary Key): Customer policy agreement contract identifier.
*   `branch_key` (INTEGER, Foreign Key referencing `dim_branch`).
*   `plan_key` (INTEGER, Foreign Key referencing `dim_plan`).
*   `agent_key` (INTEGER): Broker ledger index mapping.
*   `inception_date_key` (INTEGER, Foreign Key referencing `dim_date`).
*   `status` (VARCHAR): Premium status (`Active`, `Lapsed`, `Cancelled`, `Claimed`).
*   `monthly_premium` (REAL): Policy premium billed per month (ZAR).
*   `months_on_books` (INTEGER): Tenure count representing active risk duration.
*   `total_premium_collected` (REAL): Cumulative raw premiums successfully matched.
*   `lapse_date` (VARCHAR, Nullable): Date of policy lapse due to unpaid debit order cycles.
*   `claim_date` (VARCHAR, Nullable): Date of death claimant submission.

#### 5. `fact_claim` (Life Claims Audit)
*   `claim_id` (INTEGER, Primary Key): Underwriter submission record identifier.
*   `policy_key` (INTEGER, Foreign Key referencing `fact_policy`).
*   `branch_key` (INTEGER, Foreign Key referencing `dim_branch`).
*   `claim_date_key` (INTEGER, Foreign Key referencing `dim_date`).
*   `claim_amount` (REAL): Declared payout sought (ZAR).
*   `claim_type` (VARCHAR): Standard claim classes (e.g., Natural, Accidental).
*   `cause_of_death` (TEXT): Diagnostic classifications (e.g., Cardiovascular, Respiratory).
*   `approval_status` (VARCHAR): Processing outcomes (`Approved`, `Rejected`, `Hold-Investigate`).
*   `days_to_settlement` (INTEGER): Turnaround time (TAT) interval in days.

---

## 🕸️ Graph-Powered Forensics (Neo4j Integration)

While standard actuarial reporting benefits from relational star schemas, **collusive fraud detection is natively graph-powered**. Relational joins scale exponentially in complexity and computational cost when auditing multi-hop connections (e.g., investigating if a claimant's doctor shares a bank account or phone number with a writing broker).

This system simulates a high-performance **index-free adjacency** model represented by a digital twin in **Neo4j AuraDB** or **Amazon Neptune**. 

### 1. Unified Graph Ontology (Labeled Property Graph)
In the production graph store, the relational keys are transformed into first-class nodes and structural relationships:

```
 (:Agent {id, name, fsp_no})
      │
   [:SOLD]
      ▼
 (:Policy {id, monthly_premium}) ──[:HAS_CLAIM]──► (:Claim {id, amount})
      │                                                │
   [:PAID_TO]                                      [:CERTIFIED_BY]
      ▼                                                ▼
 (:BankAccount {account_no, bank})               (:Practitioner {hpcsa_no, name})
```

### 2. Cypher Pattern Matching
Relational databases require 5-way SQL joins to uncover a collusive doctor-broker collar. In Neo4j, this is matched instantly using standard **Cypher**:

```cypher
// Cypher Query: Uncover Doctor-Broker collusion collars
MATCH (doc:Practitioner)-[:CERTIFIED_BY]-(c:Claim)-[:HAS_CLAIM]-(p:Policy)-[:SOLD]-(a:Agent)
WITH doc, a, collect(p) as policies, sum(c.amount) as total_exposure
WHERE size(policies) >= 3
RETURN doc.name AS doctor, a.name AS broker, size(policies) AS case_volume, total_exposure
ORDER BY total_exposure DESC
```

---

## 🛠️ Multi-Language Data Pipeline Stack (Python, Cypher & PL/pgSQL)

A complete production implementation blends multiple languages to manage ingestion, graph projections, and database synchronization.

### 1. Ingestion & Graph Synchronization (Python & Apache Spark)
We utilize **Python 3.10+** for automated ETL tasks. Python acts as the glue to pull core life insurance transaction lines from traditional COBOL or Delphi mainframes, structure them, and bulk-load them into Neo4j using the official `neo4j` driver.

Below is an operational production-blueprint script in Python:

```python
# sync_records_to_graph.py
import os
import sys
from neo4j import GraphDatabase
import psycopg2

def sync_active_claims():
    # PostgreSQL Source Connect
    pg_conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "funeral_warehouse"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )
    
    # Neo4j Target Connect
    neo4j_uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user = os.getenv("NEO4J_USER", "neo4j")
    neo4j_pass = os.getenv("NEO4J_PASSWORD", "password")
    graph_driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_pass))
    
    sql_query = """
        SELECT c.claim_id, c.claim_amount, p.policy_id, p.agent_key, c.cause_of_death
        FROM fact_claim c
        JOIN fact_policy p ON c.policy_key = p.policy_id
        WHERE c.approval_status = 'Hold-Investigate';
    """
    
    with pg_conn.cursor() as cursor:
        cursor.execute(sql_query)
        claims = cursor.fetchall()
        
    # Write nodes and edges to Neo4j Graph
    with graph_driver.session() as session:
        for claim_id, amount, policy_id, agent_key, cause_of_death in claims:
            session.run("""
                MERGE (p:Policy {id: $policy_id})
                MERGE (a:Agent {id: $agent_id})
                MERGE (c:Claim {id: $claim_id})
                SET c.amount = $amount, c.cause = $cause
                MERGE (p)-[:SOLD_BY]->(a)
                MERGE (p)-[:HAS_CLAIM]->(c)
            """, policy_id=policy_id, agent_id=agent_key, claim_id=claim_id, amount=amount, cause=cause_of_death)
            
    print(f"Successfully synced {len(claims)} suspicious claim-legs into Neo4j AuraDB.")
    pg_conn.close()
    graph_driver.close()

if __name__ == "__main__":
    sync_active_claims()
```

### 2. Database Triggers (PL/pgSQL)
We use procedural **PL/pgSQL** on PostgreSQL to automatically maintain months on books, trigger late-payment warnings, and mark policies as `Lapsed` or `Cancelled` the millisecond consecutive debit orders bounce:

```sql
CREATE OR REPLACE FUNCTION process_installment_bounce() 
RETURNS TRIGGER AS $$
DECLARE
    consecutive_bounces INT;
BEGIN
    -- Query recent premium payment history
    SELECT count(*) INTO consecutive_bounces 
    FROM fact_premium 
    WHERE policy_key = NEW.policy_key 
      AND status = 'Unpaid'
      AND record_date >= CURRENT_DATE - INTERVAL '90 days';

    -- Enforce automatic lapse after 3 bounced debit orders (industry-standard grace period)
    IF consecutive_bounces >= 3 THEN
        UPDATE fact_policy 
        SET status = 'Lapsed', lapse_date = CURRENT_DATE::text
        WHERE policy_id = NEW.policy_key;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 🔌 Connection Playbook: Migrating to PostgreSQL / Cloud SQL

To establish a live integration with a professional SQL database (like Google Cloud SQL PostgreSQL), apply this direct code-adaptation checklist:

### Step 1: Install Enterprise Drivers
Add required database adapters to your Node.js server dependencies. For PostgreSQL:
```bash
npm install pg @types/pg
```

### Step 2: Configure Environment Credentials
Declare the target connection pool parameters inside your secure environment configuration (`.env`). Create or append these lines to define connections to your production instance:

```env
# Production Database Connection Pool config
DB_HOST=your-db-host.internal
DB_PORT=5432
DB_USER=assure_analytics_user
DB_PASSWORD=SecureMamelodiBrokerPass99!
DB_NAME=funeral_warehouse
DB_SSL=true

# Secure API Configurations
GEMINI_API_KEY=AIzaSyYourSecureCorporateAPIKeyHere
```

> [!WARNING]
> Ensure all core firewalls or Security Groups on your database hosting server permit incoming traffic from the container application runtime IPs on port `5432` (PostgreSQL) or `1433` (SQL Server).

### Step 3: Implement the Database Provider Adapter
Create a database-connection helper file `/src/db_prod.ts` to manage Connection Pooling. Use standard `pg.Pool` for automatic thread safety:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 20, // Maximum pool clients
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Execute a query against the live production PostgreSQL database
 */
export async function runProductionQuery(sql: string, params: any[] = []): Promise<any[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}
```

### Step 4: Drop-In Connection Pool in the Server API Routes
Inside your server file (`/server.ts`), import the production query model and swap out the SQLite runner:

```typescript
// /server.ts
import { runProductionQuery } from './src/db_prod';

// Replace the previous runQuery implementation:
async function runQuery(sql: string, params: any[] = []): Promise<any[]> {
  // SQLite Local Fallback:
  // return runSQLiteLocalQuery(sql, params);
  
  // LIVE PRODUCTION DATABASE ROUTER:
  return await runProductionQuery(sql, params);
}
```

### Step 5: Address Database Engine Formats & SQL Mappings
The interactive text-from-SQL generator inside the AI Assistant uses standard ANSI-SQL formatting. However, SQLite and PostgreSQL handle certain date formats differently. Update the AI system prompts or database mapping logic accordingly:

*   **SQLite Date Extraction**: `strftime('%Y-%m', date_key)`
*   **PostgreSQL Date Extraction**: `TO_CHAR(TO_DATE(CAST(date_key AS VARCHAR), 'YYYYMMDD'), 'YYYY-MM')`
*   **Julian Day Representation**: PostgreSQL does not use standard `julianday()`. Substitute calculations tracing days on books with standard interval queries:
    ```sql
    -- PostgreSQL tenure interval query
    EXTRACT(MONTH FROM AGE(lapse_date::date, inception_date::date))
    ```

---

## 🔄 Daily Ingestion, ETL Pipelines & SA Specific Considerations

### 1. Ingestion Frequency
Most funeral underwriting platforms (e.g., **SST, Custom Delphi Legacy Ledgers, Syspro**) produce transaction files overnight. We recommend a midnight ETL pipeline scheduled via **Apache Airflow, dbt (Data Build Tool), or SQL Server Integration Services (SSIS)**:
*   **Bronze Layer**: Direct replica ingestion of policies, premium debit records, and medical logs.
*   **Silver Layer**: Clean invalid ID checksums (South African HANIS standards), resolve agent license details (FSP registration statuses via FSCA registrar datasets).
*   **Gold Layer**: Rebuild and index the star schema tables (`dim_branch`, `fact_policy`, `fact_claim`) shown above.

### 2. Safeguarding Personal Identifiable Information (POPIA)
Under the South African **Protection of Personal Information Act (POPIA)**:
1.  **Do NOT ingest raw South African National Identity Numbers (ID numbers)** directly into analytical clouds. Always parse the birth date, gender, and citizenship status securely at source, then hash or remove the raw digits (`NationalID` -> `ID_HASH_SHA256`).
2.  Encrypt and sanitize all claimant names, medical diagnoses, and phone contact vectors before populating the visualization cache.

### 3. FICA Verification Integrations
For automated Mule Bank Account and Agent Commission Anti-Fraud checks:
*   Integrate the warehouse sync pipeline with the **South African Fraud Prevention Service (SAFPS)** database.
*   Perform real-time KYC validation checking for premium debit origins with Bank Verification APIs (e.g., Nedbank API, FNB Connect, Standard Bank Developer APIs).

---

For customized implementation consulting or queries, consult your in-house Group Risk Compliance and Enterprise Architecture team.
