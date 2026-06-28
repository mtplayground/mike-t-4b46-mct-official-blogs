use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
pub struct Subscriber {
    pub id: String,
    pub email: String,
    pub created_at: NaiveDateTime,
}
