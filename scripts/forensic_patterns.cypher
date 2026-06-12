// ============================================================================
// 🕸️ Actuarial Persistency & Forensic Hub
// Graph Forensics: Cypher Risk Pattern Analytics Recipes
// File: scripts/forensic_patterns.cypher
// ============================================================================

// These queries are prepared for execution on production property graph deployments
// (e.g., Neo4j AuraDB Enterprise or GDS). They use pattern-matching syntax
// to isolate collusive crime rings that are notoriously difficult to track in SQL.


// ----------------------------------------------------------------------------
// 🚩 Pattern 1: Bank Account Recycling (The "Mule Ring" Indicator)
// Identifies instances where distinct, unrelated policyholder nodes have 
// their premium payments or claim payout targets directed to the exact same 
// bank account. High indication of account farming or loan sharks keeping policies.
// ----------------------------------------------------------------------------
MATCH (acc:BankAccount)<-[:PAYOUT_TO]-(c:Claim)-[:CLAIMED_ON]->(p:Policy)
WITH acc, count(DISTINCT p) AS associated_policies, collect(p.id) AS policy_ids, sum(c.amount) AS total_stolen
WHERE associated_policies >= 3
RETURN 
    acc.bank_name AS bank, 
    acc.account_number AS account, 
    associated_policies AS connection_density, 
    policy_ids AS suspicious_policies, 
    total_stolen AS exposure_zar
ORDER BY exposure_zar DESC;


// ----------------------------------------------------------------------------
// 🚩 Pattern 2: Broker-Doctor Collusion Clusters (The "Claim Mill")
// Scans for sub-graphs where a writing broker (Agent) and a certifying medical 
// practitioner co-occur on multiple claims with rapid claim turnaround times 
// (claims filed shortly after policy inception, indicating pre-deceased buying).
// ----------------------------------------------------------------------------
MATCH (a:Agent)-[:SOLD]->(p:Policy)-[:HAS_CLAIM]->(c:Claim)-[:CERTIFIED_BY]->(doc:Practitioner)
WITH a, doc, count(c) AS claim_count, collect(c.claim_type) AS types, sum(c.amount) AS cluster_claims_value
WHERE claim_count >= 4
RETURN 
    a.name AS writing_broker, 
    a.fsp_license_no AS fsp_license,
    doc.name AS certifying_practitioner, 
    doc.hpcsa_registration_no AS hpcsa_no,
    claim_count AS unified_cases, 
    cluster_claims_value AS total_payouts_zar
ORDER BY total_payouts_zar DESC;


// ----------------------------------------------------------------------------
// 🚩 Pattern 3: Circular Phone Number Reference Syndicates
// Isolation of circles where customers, agents, and medical practitioners 
// share phone or contact nodes, highlighting false identities and manufactured policies.
// ----------------------------------------------------------------------------
MATCH (n1:Entity)-[:HAS_CONTACT]->(ph:Phone)<-[:HAS_CONTACT]-(n2:Entity)
WHERE id(n1) < id(n2) AND NOT (n1:PolicyHolder AND n2:FamilyMember) -- Ignores valid family coverage
RETURN 
    labels(n1)[0] AS type_a, 
    n1.name AS entity_a, 
    labels(n2)[0] AS type_b, 
    n2.name AS entity_b, 
    ph.number AS shared_contact_number
LIMIT 50;


// ----------------------------------------------------------------------------
// 🚩 Pattern 4: PageRank Forensic Importance Calculation
// Runs central gravity calculations via Graph Data Science (GDS) to pinpoint
// the most influential nexus entities behind suspicious transactional clusters.
// ----------------------------------------------------------------------------
CALL gds.pageRank.stream('forensic-subgraph', {
  maxIterations: 20,
  dampingFactor: 0.85,
  relationshipWeightProperty: 'amount'
})
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS entity_name, labels(gds.util.asNode(nodeId))[0] AS category, score
ORDER BY score DESC
LIMIT 10;
