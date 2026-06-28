use std::collections::BTreeMap;

use serde_json::Value;

use crate::detect::ElsaVersion;
use crate::ir::{ActivityNode, EdgeIR, PropertyIR, WorkflowIR};
use crate::label::classify_shape;

const EXTRA_KEYS: &[&str] = &[
    "persistWorkflow",
    "loadWorkflowContext",
    "saveWorkflowContext",
    "saveWorkflowInstance",
    "runAsynchronously",
    "description",
    "metadata",
];

pub fn normalize(json: &Value, version: ElsaVersion) -> Result<WorkflowIR, String> {
    match version {
        ElsaVersion::V2 => normalize_v2(json),
        ElsaVersion::V3 => normalize_v3(json),
    }
}

fn str_or(json: &Value, key: &str, fallback: &str) -> String {
    json.get(key)
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(|| fallback.to_string())
}

fn optional_string(json: &Value, key: &str) -> Option<String> {
    json.get(key).and_then(|v| v.as_str()).map(String::from)
}

fn optional_bool(json: &Value, key: &str) -> Option<bool> {
    json.get(key).and_then(|v| v.as_bool())
}

fn workflow_id(json: &Value) -> String {
    json.get("id")
        .and_then(|v| v.as_str())
        .or_else(|| json.get("definitionId").and_then(|v| v.as_str()))
        .map(String::from)
        .unwrap_or_else(|| "unknown".to_string())
}

fn mark_starts(nodes: &mut [ActivityNode], edges: &[EdgeIR]) {
    for node in nodes.iter_mut() {
        node.is_start = !edges.iter().any(|e| e.target_id == node.id);
    }
}

fn collect_extras(activity: &Value) -> BTreeMap<String, Value> {
    let mut map = BTreeMap::new();
    let Some(obj) = activity.as_object() else {
        return map;
    };
    for key in EXTRA_KEYS {
        if let Some(v) = obj.get(*key) {
            if !v.is_null() {
                map.insert((*key).to_string(), v.clone());
            }
        }
    }
    map
}

fn collect_v2_properties(activity: &Value) -> Vec<PropertyIR> {
    let Some(arr) = activity.get("properties").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    arr.iter()
        .filter_map(|p| {
            let name = p.get("name").and_then(|v| v.as_str())?.to_string();
            let syntax = p
                .get("syntax")
                .and_then(|v| v.as_str())
                .map(String::from);
            // Elsa v2 stores the executable form under expressions.{syntax}.
            // Surface the matching one; fall back to the whole expressions blob.
            let value = match (&syntax, p.get("expressions")) {
                (Some(s), Some(exprs)) => exprs.get(s).cloned().unwrap_or_else(|| exprs.clone()),
                (None, Some(exprs)) => exprs.clone(),
                _ => Value::Null,
            };
            Some(PropertyIR {
                name,
                value,
                syntax,
            })
        })
        .collect()
}

fn collect_v3_properties(activity: &Value) -> Vec<PropertyIR> {
    let Some(obj) = activity.get("properties").and_then(|v| v.as_object()) else {
        return Vec::new();
    };
    obj.iter()
        .map(|(name, value)| {
            // Elsa v3 properties often look like { typeName, expression: { type, value } }.
            let syntax = value
                .get("expression")
                .and_then(|e| e.get("type"))
                .and_then(|t| t.as_str())
                .map(String::from);
            PropertyIR {
                name: name.clone(),
                value: value.clone(),
                syntax,
            }
        })
        .collect()
}

fn normalize_v2(json: &Value) -> Result<WorkflowIR, String> {
    let id = workflow_id(json);
    let name = str_or(json, "name", "Unnamed Workflow");
    let version = json.get("version").and_then(|v| v.as_u64()).map(|v| v as u32);
    let definition_id = optional_string(json, "definitionId");
    let is_published = optional_bool(json, "isPublished");
    let is_latest = optional_bool(json, "isLatest");

    let activities = json
        .get("activities")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "V2 workflow missing 'activities' array".to_string())?;

    let mut nodes = Vec::with_capacity(activities.len());
    for activity in activities {
        let aid = activity
            .get("activityId")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "V2 activity missing 'activityId'".to_string())?
            .to_string();
        let activity_type = activity
            .get("type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| format!("V2 activity '{aid}' missing 'type'"))?
            .to_string();
        let display_name = optional_string(activity, "displayName");
        let shape = classify_shape(&activity_type);
        let properties = collect_v2_properties(activity);
        let extras = collect_extras(activity);

        nodes.push(ActivityNode {
            id: aid,
            activity_type,
            display_name,
            is_start: false,
            shape,
            children: None,
            properties,
            extras,
        });
    }

    let mut edges = Vec::new();
    if let Some(conns) = json.get("connections").and_then(|v| v.as_array()) {
        for conn in conns {
            let source_id = conn
                .get("sourceActivityId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "V2 connection missing 'sourceActivityId'".to_string())?
                .to_string();
            let target_id = conn
                .get("targetActivityId")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "V2 connection missing 'targetActivityId'".to_string())?
                .to_string();
            let outcome = conn
                .get("outcome")
                .and_then(|v| v.as_str())
                .unwrap_or("Done")
                .to_string();
            edges.push(EdgeIR {
                source_id,
                target_id,
                outcome,
                target_port: None,
            });
        }
    }

    mark_starts(&mut nodes, &edges);

    Ok(WorkflowIR {
        id,
        name,
        version,
        definition_id,
        is_published,
        is_latest,
        nodes,
        edges,
    })
}

fn normalize_v3(json: &Value) -> Result<WorkflowIR, String> {
    let id = workflow_id(json);
    let name = str_or(json, "name", "Unnamed Workflow");
    let version = json.get("version").and_then(|v| v.as_u64()).map(|v| v as u32);
    let definition_id = optional_string(json, "definitionId");
    let is_published = optional_bool(json, "isPublished");
    let is_latest = optional_bool(json, "isLatest");

    let root = json
        .get("root")
        .ok_or_else(|| "V3 workflow missing 'root'".to_string())?;

    let (nodes, edges) = normalize_v3_composite(root)?;

    Ok(WorkflowIR {
        id,
        name,
        version,
        definition_id,
        is_published,
        is_latest,
        nodes,
        edges,
    })
}

fn normalize_v3_composite(container: &Value) -> Result<(Vec<ActivityNode>, Vec<EdgeIR>), String> {
    let activities = container
        .get("activities")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "V3 composite missing 'activities'".to_string())?;

    let mut nodes = Vec::with_capacity(activities.len());
    for activity in activities {
        nodes.push(normalize_v3_activity(activity)?);
    }

    let mut edges = Vec::new();
    if let Some(conns) = container.get("connections").and_then(|v| v.as_array()) {
        for conn in conns {
            edges.push(normalize_v3_connection(conn)?);
        }
    }

    mark_starts(&mut nodes, &edges);
    Ok((nodes, edges))
}

fn normalize_v3_activity(activity: &Value) -> Result<ActivityNode, String> {
    let id = activity
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "V3 activity missing 'id'".to_string())?
        .to_string();
    let activity_type = activity
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or_else(|| format!("V3 activity '{id}' missing 'type'"))?
        .to_string();
    let display_name = optional_string(activity, "displayName");
    let shape = classify_shape(&activity_type);
    let properties = collect_v3_properties(activity);
    let extras = collect_extras(activity);

    let children = if activity.get("activities").is_some() {
        let (mut child_nodes, mut child_edges) = normalize_v3_composite(activity)?;

        // Sequence-type composites with no explicit connections chain children sequentially.
        if child_edges.is_empty() && is_sequence_type(&activity_type) {
            for window in child_nodes.windows(2) {
                child_edges.push(EdgeIR {
                    source_id: window[0].id.clone(),
                    target_id: window[1].id.clone(),
                    outcome: "Done".to_string(),
                    target_port: Some("In".to_string()),
                });
            }
            mark_starts(&mut child_nodes, &child_edges);
        }

        Some(Box::new(WorkflowIR {
            id: id.clone(),
            name: display_name.clone().unwrap_or_else(|| id.clone()),
            version: None,
            definition_id: None,
            is_published: None,
            is_latest: None,
            nodes: child_nodes,
            edges: child_edges,
        }))
    } else {
        None
    };

    Ok(ActivityNode {
        id,
        activity_type,
        display_name,
        is_start: false,
        shape,
        children,
        properties,
        extras,
    })
}

fn is_sequence_type(activity_type: &str) -> bool {
    activity_type
        .rsplit('.')
        .next()
        .unwrap_or(activity_type)
        .eq_ignore_ascii_case("sequence")
}

fn normalize_v3_connection(conn: &Value) -> Result<EdgeIR, String> {
    let source = conn
        .get("source")
        .ok_or_else(|| "V3 connection missing 'source'".to_string())?;
    let target = conn
        .get("target")
        .ok_or_else(|| "V3 connection missing 'target'".to_string())?;

    if source.is_string() {
        // Flat format
        let source_id = source.as_str().unwrap().to_string();
        let target_id = target
            .as_str()
            .ok_or_else(|| "V3 connection 'target' must be string when 'source' is string".to_string())?
            .to_string();
        let outcome = conn
            .get("sourcePort")
            .and_then(|v| v.as_str())
            .unwrap_or("Done")
            .to_string();
        let target_port = conn
            .get("targetPort")
            .and_then(|v| v.as_str())
            .map(String::from);
        Ok(EdgeIR {
            source_id,
            target_id,
            outcome,
            target_port,
        })
    } else if source.is_object() {
        // Nested format
        let source_id = source
            .get("activity")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "V3 nested connection 'source.activity' missing".to_string())?
            .to_string();
        let target_id = target
            .get("activity")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "V3 nested connection 'target.activity' missing".to_string())?
            .to_string();
        let outcome = source
            .get("port")
            .and_then(|v| v.as_str())
            .unwrap_or("Done")
            .to_string();
        let target_port = target
            .get("port")
            .and_then(|v| v.as_str())
            .map(String::from);
        Ok(EdgeIR {
            source_id,
            target_id,
            outcome,
            target_port,
        })
    } else {
        Err("V3 connection 'source' must be string or object".to_string())
    }
}
