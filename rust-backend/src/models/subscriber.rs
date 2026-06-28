use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
pub struct Subscriber {
    pub id: String,
    pub email: String,
    pub created_at: NaiveDateTime,
}
