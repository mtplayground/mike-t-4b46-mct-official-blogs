use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    PgPool,
};
use std::{str::FromStr, time::Duration};

pub type DbPool = PgPool;

pub fn connect(database_url: &str) -> Result<DbPool, sqlx::Error> {
    let options = PgConnectOptions::from_str(database_url)?;

    Ok(PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(300))
        .max_lifetime(Duration::from_secs(1800))
        .connect_lazy_with(options))
}
