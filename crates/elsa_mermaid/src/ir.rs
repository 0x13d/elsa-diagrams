use std::collections::BTreeMap;

#[derive(Debug, Clone)]
pub struct WorkflowIR {
    pub id: String,
    pub name: String,
    pub version: Option<u32>,
    pub definition_id: Option<String>,
    pub is_published: Option<bool>,
    pub is_latest: Option<bool>,
    pub nodes: Vec<ActivityNode>,
    pub edges: Vec<EdgeIR>,
}

#[derive(Debug, Clone)]
pub struct ActivityNode {
    pub id: String,
    pub activity_type: String,
    pub display_name: Option<String>,
    pub is_start: bool,
    pub shape: NodeShape,
    pub children: Option<Box<WorkflowIR>>,
    pub properties: Vec<PropertyIR>,
    pub extras: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum NodeShape {
    Default,
    Decision,
    Terminal,
    Blocking,
}

#[derive(Debug, Clone)]
pub struct PropertyIR {
    pub name: String,
    pub value: serde_json::Value,
    pub syntax: Option<String>,
}

#[derive(Debug, Clone)]
pub struct EdgeIR {
    pub source_id: String,
    pub target_id: String,
    pub outcome: String,
    pub target_port: Option<String>,
}
