use elsa_mermaid::detect::{detect, ElsaVersion};
use elsa_mermaid::ir::NodeShape;
use elsa_mermaid::normalize::normalize;

const COMPOSITE: &str = include_str!("../../../tests/fixtures/v3_composite.json");
const HELLO: &str = include_str!("../../../tests/fixtures/v3_hello_world.json");

#[test]
fn v3_composite_normalizes_with_children() {
    let json: serde_json::Value = serde_json::from_str(COMPOSITE).expect("valid JSON");
    let version = detect(&json).expect("detect succeeds");
    assert_eq!(version, ElsaVersion::V3);

    let ir = normalize(&json, version).expect("normalize succeeds");

    assert_eq!(ir.nodes.len(), 4, "top-level activities");
    assert_eq!(ir.edges.len(), 3);

    let sequence = ir
        .nodes
        .iter()
        .find(|n| n.id == "Sequence1")
        .expect("Sequence1 present");
    let children = sequence.children.as_ref().expect("Sequence1 has children");
    assert_eq!(children.nodes.len(), 2, "Sequence1 has 2 children");

    let signal = children
        .nodes
        .iter()
        .find(|n| n.id == "Signal1")
        .expect("Signal1 present");
    assert_eq!(signal.shape, NodeShape::Blocking);

    assert_eq!(children.edges.len(), 1, "implicit sequential edge");
    assert_eq!(children.edges[0].source_id, "Email1");
    assert_eq!(children.edges[0].target_id, "Signal1");
    assert_eq!(children.edges[0].outcome, "Done");

    let http = ir
        .nodes
        .iter()
        .find(|n| n.id == "HttpEndpoint1")
        .expect("HttpEndpoint1 present");
    assert!(http.is_start);
    assert_eq!(http.shape, NodeShape::Terminal);

    let cond = ir.nodes.iter().find(|n| n.id == "If1").unwrap();
    assert_eq!(cond.shape, NodeShape::Decision);
}

#[test]
fn v3_hello_world_normalizes() {
    let json: serde_json::Value = serde_json::from_str(HELLO).expect("valid JSON");
    let version = detect(&json).expect("detect succeeds");
    let ir = normalize(&json, version).expect("normalize succeeds");

    assert_eq!(ir.nodes.len(), 1);
    assert_eq!(ir.edges.len(), 0);
    assert!(ir.nodes[0].is_start);
    assert_eq!(ir.nodes[0].id, "WriteLine1");
}

#[test]
fn v3_nested_connection_format_parses() {
    let json: serde_json::Value = serde_json::json!({
        "id": "x",
        "root": {
            "id": "fc",
            "type": "Elsa.Flowchart",
            "activities": [
                { "id": "A", "type": "Elsa.WriteLine" },
                { "id": "B", "type": "Elsa.WriteLine" }
            ],
            "connections": [
                {
                    "source": { "activity": "A", "port": "Done" },
                    "target": { "activity": "B", "port": "In" }
                }
            ]
        }
    });
    let ir = normalize(&json, ElsaVersion::V3).expect("normalize succeeds");
    assert_eq!(ir.edges.len(), 1);
    assert_eq!(ir.edges[0].source_id, "A");
    assert_eq!(ir.edges[0].target_id, "B");
    assert_eq!(ir.edges[0].outcome, "Done");
}
