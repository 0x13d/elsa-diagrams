#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ElsaVersion {
    V2,
    V3,
}

pub fn detect(json: &serde_json::Value) -> Result<ElsaVersion, String> {
    if json.get("root").map(|v| v.is_object()).unwrap_or(false) {
        return Ok(ElsaVersion::V3);
    }

    if let Some(activities) = json.get("activities").and_then(|v| v.as_array()) {
        if activities
            .first()
            .and_then(|a| a.get("activityId"))
            .is_some()
        {
            return Ok(ElsaVersion::V2);
        }
    }

    Err("Unrecognized Elsa workflow JSON format".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn detects_v3_by_root_object() {
        let v = json!({ "root": { "activities": [] } });
        assert_eq!(detect(&v).unwrap(), ElsaVersion::V3);
    }

    #[test]
    fn detects_v2_by_activityid() {
        let v = json!({
            "activities": [{ "activityId": "a-1", "type": "If" }]
        });
        assert_eq!(detect(&v).unwrap(), ElsaVersion::V2);
    }

    #[test]
    fn rejects_unknown_shape() {
        let v = json!({ "activities": [{ "id": "x" }] });
        assert!(detect(&v).is_err());
    }

    #[test]
    fn rejects_empty_object() {
        let v = json!({});
        assert!(detect(&v).is_err());
    }
}
