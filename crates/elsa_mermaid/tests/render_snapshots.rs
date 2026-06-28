use elsa_mermaid::detect::detect;
use elsa_mermaid::normalize::normalize;
use elsa_mermaid::render::{render, RenderOptions};
use pretty_assertions::assert_eq;

fn convert(json_str: &str) -> String {
    let json: serde_json::Value = serde_json::from_str(json_str).expect("valid JSON");
    let version = detect(&json).expect("detect");
    let ir = normalize(&json, version).expect("normalize");
    render(&ir, &RenderOptions::default())
}

#[test]
fn snapshot_v2_if_branch() {
    let input = include_str!("../../../tests/fixtures/v2_if_branch.json");
    let expected = "flowchart TD\n\
        \n\
        \x20\x20\x20\x20activity_1([\"HTTP Endpoint\"])\n\
        \x20\x20\x20\x20activity_2{\"Check Status\"}\n\
        \x20\x20\x20\x20activity_3[\"Notify Approver\"]\n\
        \x20\x20\x20\x20activity_4[\"Reject Response\"]\n\
        \n\
        \x20\x20\x20\x20activity_1 --> activity_2\n\
        \x20\x20\x20\x20activity_2 -->|True| activity_3\n\
        \x20\x20\x20\x20activity_2 -->|False| activity_4\n";
    assert_eq!(convert(input), expected);
}

#[test]
fn snapshot_v2_document_approval() {
    let input = include_str!("../../../tests/fixtures/v2_document_approval.json");
    let expected = "flowchart TD\n\
        \n\
        \x20\x20\x20\x20activity_1([\"Receive Document\"])\n\
        \x20\x20\x20\x20activity_2{\"Check Approval\"}\n\
        \x20\x20\x20\x20activity_3[\"Notify Approver\"]\n\
        \x20\x20\x20\x20activity_4[/\"Send Approved Signal\"/]\n\
        \x20\x20\x20\x20activity_5[\"Reject Response\"]\n\
        \n\
        \x20\x20\x20\x20activity_1 --> activity_2\n\
        \x20\x20\x20\x20activity_2 -->|True| activity_3\n\
        \x20\x20\x20\x20activity_3 --> activity_4\n\
        \x20\x20\x20\x20activity_2 -->|False| activity_5\n";
    assert_eq!(convert(input), expected);
}

#[test]
fn snapshot_v3_hello_world() {
    let input = include_str!("../../../tests/fixtures/v3_hello_world.json");
    let expected = "flowchart TD\n\
        \n\
        \x20\x20\x20\x20WriteLine1[\"Say Hello\"]\n";
    assert_eq!(convert(input), expected);
}

#[test]
fn snapshot_v3_composite() {
    let input = include_str!("../../../tests/fixtures/v3_composite.json");
    let expected = "flowchart TD\n\
        \n\
        \x20\x20\x20\x20HttpEndpoint1([\"Receive Document\"])\n\
        \x20\x20\x20\x20If1{\"Check Approval\"}\n\
        \x20\x20\x20\x20subgraph Sequence1[\"Approval Path\"]\n\
        \x20\x20\x20\x20\x20\x20\x20\x20Email1[\"Notify Approver\"]\n\
        \x20\x20\x20\x20\x20\x20\x20\x20Signal1[/\"Wait for Decision\"/]\n\
        \x20\x20\x20\x20\x20\x20\x20\x20Email1 --> Signal1\n\
        \x20\x20\x20\x20end\n\
        \x20\x20\x20\x20HttpResponse1[\"Send Rejection\"]\n\
        \n\
        \x20\x20\x20\x20HttpEndpoint1 --> If1\n\
        \x20\x20\x20\x20If1 -->|True| Sequence1\n\
        \x20\x20\x20\x20If1 -->|False| HttpResponse1\n";
    assert_eq!(convert(input), expected);
}
