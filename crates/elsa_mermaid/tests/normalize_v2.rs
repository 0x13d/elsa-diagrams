use elsa_mermaid::detect::{detect, ElsaVersion};
use elsa_mermaid::ir::NodeShape;
use elsa_mermaid::normalize::normalize;

const FIXTURE: &str = include_str!("../../../tests/fixtures/v2_if_branch.json");

#[test]
fn v2_if_branch_normalizes_correctly() {
    let json: serde_json::Value = serde_json::from_str(FIXTURE).expect("valid JSON");
    let version = detect(&json).expect("detect succeeds");
    assert_eq!(version, ElsaVersion::V2);

    let ir = normalize(&json, version).expect("normalize succeeds");

    assert_eq!(ir.nodes.len(), 4);
    assert_eq!(ir.edges.len(), 3);

    let a2 = ir
        .nodes
        .iter()
        .find(|n| n.id == "activity-2")
        .expect("activity-2 present");
    assert_eq!(a2.shape, NodeShape::Decision);

    let a1 = ir
        .nodes
        .iter()
        .find(|n| n.id == "activity-1")
        .expect("activity-1 present");
    assert!(a1.is_start, "activity-1 should be start (no inbound edge)");

    assert!(!a2.is_start, "activity-2 has an inbound edge");
}
