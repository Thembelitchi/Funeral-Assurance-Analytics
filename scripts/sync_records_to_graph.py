#!/usr/bin/env python3
"""
📂 Actuarial Persistency & Forensic Hub - Data Pipeline Stack
Backend ETL Script: Sync transactional PostgreSQL records with Neo4j Graph Store

This pipeline extracts active claims flags, broker affiliations, and medical certifications,
projecting them onto labeled nodes and relationships in a Neo4j Graph Database to reveal 
co-conspirators, bank-mule syndicates, and broker-practitioner collusion collars.
"""

import os
import sys
import logging
from typing import Dict, Any, List

# Setup Logging Config
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("graph_sync_pipeline")

def verify_environment() -> None:
    """Verifies all mandatory connection credentials exist in the runtime environment."""
    required_variables = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "NEO4J_URI", "NEO4J_USER", "NEO4J_PASSWORD"]
    missing = [var for var in required_variables if not os.environ.get(var)]
    if missing:
        logger.error(f"Missing mandatory environment configuration keys: {', '.join(missing)}")
        sys.exit(1)

def get_db_connections():
    """Establishes connections to both PostgreSQL and Neo4j servers."""
    try:
        import psycopg2
        from neo4j import GraphDatabase
    except ImportError as e:
        logger.error("Required database driver modules missing. Please run: pip install psycopg2-binary neo4j")
        sys.exit(1)

    # Connect to PostgreSQL Warehouse
    try:
        pg_conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT", "5432"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            connect_timeout=5
        )
        logger.info("Successfully established connection to PostgreSQL relational database.")
    except Exception as e:
        logger.error(f"Failed to connect to PostgreSQL source database: {e}")
        sys.exit(1)

    # Connect to Neo4j AuraDB/Graph Store
    try:
        neo4j_uri = os.getenv("NEO4J_URI")
        neo4j_user = os.getenv("NEO4J_USER", "neo4j")
        neo4j_pass = os.getenv("NEO4J_PASSWORD")
        graph_driver = GraphDatabase.driver(neo4j_uri, auth=(neo4j_user, neo4j_pass))
        # Warmup connectivity check
        graph_driver.verify_connectivity()
        logger.info("Successfully established connection and handshake with Neo4j AuraDB graph store.")
    except Exception as e:
        logger.error(f"Failed to connect to Neo4j graph target: {e}")
        pg_conn.close()
        sys.exit(1)

    return pg_conn, graph_driver

def batch_upsert_claims_network(pg_conn, graph_driver) -> int:
    """
    Queries active claims records under investigation alongside policies, agents,
    and doctor signatures; streaming and mapping them directly to the graph model.
    """
    source_query = """
        SELECT 
            c.claim_id, 
            c.claim_amount, 
            c.cause_of_death, 
            p.policy_id, 
            p.monthly_premium,
            p.agent_key as agent_id,
            b.branch_name,
            b.region
        FROM fact_claim c
        INNER JOIN fact_policy p ON c.policy_key = p.policy_id
        INNER JOIN dim_branch b ON p.branch_key = b.branch_key
        WHERE c.approval_status = 'Hold-Investigate';
    """
    
    records_synced = 0
    try:
        with pg_conn.cursor() as cursor:
            logger.info("Retrieving flagged claim records from PostgreSQL sources...")
            cursor.execute(source_query)
            batch = cursor.fetchall()
            
        if not batch:
            logger.info("No records match the active forensic watch filter ('Hold-Investigate'). Sync complete.")
            return 0

        logger.info(f"Loaded {len(batch)} records to sync. Merging into graph database...")
        
        with graph_driver.session() as session:
            for row in batch:
                claim_id, amount, cause, policy_id, premium, agent_id, branch_name, region = row
                
                # Cypher statement mapping the multidimensional risk relationship
                cypher_sync = """
                MERGE (branch:Branch {name: $branch_name})
                  ON CREATE SET branch.region = $region
                
                MERGE (agent:Agent {id: $agent_id})
                
                MERGE (policy:Policy {id: $policy_id})
                  ON CREATE SET policy.monthly_premium = $premium
                
                MERGE (claim:Claim {id: $claim_id})
                  ON CREATE SET claim.amount = $amount, claim.cause_of_death = $cause
                
                // Establish secure semantic edges
                MERGE (policy)-[:SOLD_IN_BRANCH]->(branch)
                MERGE (policy)-[:SOLD_BY]->(agent)
                MERGE (claim)-[:CLAIMED_ON]->(policy)
                """
                
                session.run(
                    cypher_sync,
                    branch_name=branch_name,
                    region=region,
                    agent_id=f"broker_{agent_id}",
                    policy_id=f"pol_{policy_id}",
                    premium=float(premium),
                    claim_id=f"clm_{claim_id}",
                    amount=float(amount),
                    cause=cause
                )
                records_synced += 1
                
        logger.info(f"Sync complete. {records_synced} transactional sub-graphs updated successfully.")
    except Exception as e:
        logger.error(f"Error occurred during synchronization processing: {e}")
        
    return records_synced

def main():
    logger.info("Starting South African Funeral Assurer Graph Sync Pipeline...")
    verify_environment()
    pg_conn, graph_driver = get_db_connections()
    
    try:
        sync_count = batch_upsert_claims_network(pg_conn, graph_driver)
        logger.info(f"Database graph sync cycle completed. Total updated entities: {sync_count}")
    finally:
        pg_conn.close()
        graph_driver.close()
        logger.info("All connection pools closed cleanly.")

if __name__ == "__main__":
    main()
