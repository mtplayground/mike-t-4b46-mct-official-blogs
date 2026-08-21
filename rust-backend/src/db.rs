use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool,
};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, str::FromStr, time::Duration};

pub type DbPool = PgPool;

const MIGRATION_TABLE: &str = "_ideavibes_schema_migrations";
const CONNECTIVITY_CHECK_SQL: &str = "SELECT 1";

struct Migration {
    version: &'static str,
    prisma_name: &'static str,
    description: &'static str,
    sql: &'static str,
}

// Prisma keeps each migration in a directory, while SQLx's built-in migrator expects
// flat files. Keep the existing Prisma migration source as the single source of truth
// and embed it here so the release binary can migrate before accepting requests.
const MIGRATIONS: &[Migration] = &[
    Migration {
        version: "20260611041500",
        prisma_name: "20260611041500_init",
        description: "init",
        sql: include_str!("../../prisma/migrations/20260611041500_init/migration.sql"),
    },
    Migration {
        version: "20260611042800",
        prisma_name: "20260611042800_add_post_category_models",
        description: "add post category models",
        sql: include_str!("../../prisma/migrations/20260611042800_add_post_category_models/migration.sql"),
    },
    Migration {
        version: "20260611043100",
        prisma_name: "20260611043100_add_subscriber_model",
        description: "add subscriber model",
        sql: include_str!("../../prisma/migrations/20260611043100_add_subscriber_model/migration.sql"),
    },
    Migration {
        version: "20260617173500",
        prisma_name: "20260617173500_add_post_featured_author_fields",
        description: "add post featured author fields",
        sql: include_str!("../../prisma/migrations/20260617173500_add_post_featured_author_fields/migration.sql"),
    },
    Migration {
        version: "20260626170000",
        prisma_name: "20260626170000_add_post_views",
        description: "add post views",
        sql: include_str!("../../prisma/migrations/20260626170000_add_post_views/migration.sql"),
    },
    Migration {
        version: "20260626174500",
        prisma_name: "20260626174500_add_square_cover_image_key",
        description: "add square cover image key",
        sql: include_str!("../../prisma/migrations/20260626174500_add_square_cover_image_key/migration.sql"),
    },
    Migration {
        version: "20260711055600",
        prisma_name: "20260711055600_add_post_company_card_fields",
        description: "add post company card fields",
        sql: include_str!("../../prisma/migrations/20260711055600_add_post_company_card_fields/migration.sql"),
    },
    Migration {
        version: "20260718165000",
        prisma_name: "20260718165000_update_company_card_defaults_to_ideavibes",
        description: "update company card defaults to ideavibes",
        sql: include_str!("../../prisma/migrations/20260718165000_update_company_card_defaults_to_ideavibes/migration.sql"),
    },
];

pub fn connect(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let options = PgConnectOptions::from_str(database_url)?;

    Ok(PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(30))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        .connect_lazy_with(options))
}

/// Verifies that the pool can acquire a PostgreSQL connection and execute a query.
///
/// Pool construction is lazy, so this is intentionally used by the readiness endpoint
/// instead of treating a cloned pool as proof that the database is available.
pub async fn check_connectivity(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query(CONNECTIVITY_CHECK_SQL).execute(pool).await?;
    Ok(())
}

/// Applies every committed schema migration before the HTTP server accepts traffic.
///
/// The database used by earlier releases may already have Prisma's migration ledger.
/// Those completed migrations are adopted into this runner's ledger so upgrading does
/// not attempt to recreate its existing tables/types. New migrations are then run in
/// version order and recorded transactionally.
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    tracing::info!(migration_count = MIGRATIONS.len(), "Starting database migrations");

    sqlx::query(&format!(
        "CREATE TABLE IF NOT EXISTS {MIGRATION_TABLE} (\
            version TEXT PRIMARY KEY, \
            checksum TEXT NOT NULL, \
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\
        )"
    ))
    .execute(pool)
    .await?;

    let prisma_ledger_exists = prisma_ledger_exists(pool).await?;
    let mut applied = applied_migrations(pool).await?;

    for migration in MIGRATIONS {
        let checksum = migration_checksum(migration.sql);

        if let Some(applied_checksum) = applied.get(migration.version) {
            ensure_matching_checksum(migration, applied_checksum, &checksum)?;
            continue;
        }

        if prisma_ledger_exists && prisma_migration_completed(pool, migration.prisma_name).await? {
            record_migration(pool, migration.version, &checksum).await?;
            applied.insert(migration.version.to_owned(), checksum);
            tracing::info!(
                version = migration.version,
                description = migration.description,
                "Adopted completed Prisma migration"
            );
        }
    }

    for migration in MIGRATIONS {
        let checksum = migration_checksum(migration.sql);

        if let Some(applied_checksum) = applied.get(migration.version) {
            ensure_matching_checksum(migration, applied_checksum, &checksum)?;
            continue;
        }

        tracing::info!(
            version = migration.version,
            description = migration.description,
            "Applying database migration"
        );
        let mut transaction = pool.begin().await?;
        sqlx::raw_sql(migration.sql)
            .execute(&mut *transaction)
            .await?;
        sqlx::query(&format!(
            "INSERT INTO {MIGRATION_TABLE} (version, checksum) VALUES ($1, $2)"
        ))
        .bind(migration.version)
        .bind(&checksum)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;
        applied.insert(migration.version.to_owned(), checksum);
        tracing::info!(
            version = migration.version,
            description = migration.description,
            "Database migration applied"
        );
    }

    tracing::info!("Database migrations complete");
    Ok(())
}

async fn applied_migrations(pool: &DbPool) -> Result<HashMap<String, String>, sqlx::Error> {
    let rows = sqlx::query_as::<_, (String, String)>(&format!(
        "SELECT version, checksum FROM {MIGRATION_TABLE}"
    ))
    .fetch_all(pool)
    .await?;

    Ok(rows.into_iter().collect())
}

async fn prisma_ledger_exists(pool: &DbPool) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT EXISTS(\
            SELECT 1 FROM pg_catalog.pg_tables \
            WHERE schemaname = current_schema() AND tablename = '_prisma_migrations'\
        )",
    )
    .fetch_one(pool)
    .await
}

async fn prisma_migration_completed(pool: &DbPool, migration_name: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar(
        "SELECT EXISTS(\
            SELECT 1 FROM \"_prisma_migrations\" \
            WHERE migration_name = $1 AND finished_at IS NOT NULL\
        )",
    )
    .bind(migration_name)
    .fetch_one(pool)
    .await
}

async fn record_migration(pool: &DbPool, version: &str, checksum: &str) -> Result<(), sqlx::Error> {
    sqlx::query(&format!(
        "INSERT INTO {MIGRATION_TABLE} (version, checksum) VALUES ($1, $2) ON CONFLICT (version) DO NOTHING"
    ))
    .bind(version)
    .bind(checksum)
    .execute(pool)
    .await?;

    Ok(())
}

fn ensure_matching_checksum(
    migration: &Migration,
    applied_checksum: &str,
    expected_checksum: &str,
) -> Result<(), sqlx::Error> {
    if applied_checksum == expected_checksum {
        return Ok(());
    }

    Err(sqlx::Error::Protocol(format!(
        "Database migration {} ({}) has changed since it was applied",
        migration.version, migration.description
    )))
}

fn migration_checksum(sql: &str) -> String {
    hex::encode(Sha256::digest(sql.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_migrations_are_unique_and_in_version_order() {
        assert!(!MIGRATIONS.is_empty());

        for pair in MIGRATIONS.windows(2) {
            assert!(pair[0].version < pair[1].version);
        }
        for migration in MIGRATIONS {
            assert!(migration.prisma_name.starts_with(migration.version));
        }
    }

    #[test]
    fn migration_checksums_detect_sql_changes() {
        assert_ne!(migration_checksum("SELECT 1"), migration_checksum("SELECT 2"));
    }

    #[test]
    fn connectivity_check_uses_a_lightweight_query() {
        assert_eq!(CONNECTIVITY_CHECK_SQL, "SELECT 1");
    }
}
