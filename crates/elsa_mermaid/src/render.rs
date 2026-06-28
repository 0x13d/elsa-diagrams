use std::fmt::Write;

use crate::ir::{ActivityNode, EdgeIR, NodeShape, WorkflowIR};
use crate::label::activity_label;

pub struct RenderOptions {
    pub direction: Direction,
}

pub enum Direction {
    TopDown,
    LeftRight,
    BottomTop,
    RightLeft,
}

impl Direction {
    fn as_str(&self) -> &'static str {
        match self {
            Direction::TopDown => "TD",
            Direction::LeftRight => "LR",
            Direction::BottomTop => "BT",
            Direction::RightLeft => "RL",
        }
    }
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            direction: Direction::TopDown,
        }
    }
}

pub fn render(ir: &WorkflowIR, opts: &RenderOptions) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "flowchart {}", opts.direction.as_str());
    out.push('\n');

    for node in &ir.nodes {
        emit_node(&mut out, node, 1);
    }

    out.push('\n');

    for edge in &ir.edges {
        emit_edge(&mut out, edge, 1);
    }

    // Trim trailing newline for clean output.
    while out.ends_with('\n') {
        out.pop();
    }
    out.push('\n');
    out
}

fn emit_node(out: &mut String, node: &ActivityNode, indent: usize) {
    let pad = "    ".repeat(indent);
    let id = mermaid_id(&node.id);
    let label = escape_label(&activity_label(node));

    if let Some(children) = &node.children {
        let _ = writeln!(out, "{pad}subgraph {id}[\"{label}\"]");
        for child in &children.nodes {
            emit_node(out, child, indent + 1);
        }
        for edge in &children.edges {
            emit_edge(out, edge, indent + 1);
        }
        let _ = writeln!(out, "{pad}end");
    } else {
        let body = match node.shape {
            NodeShape::Default => format!("{id}[\"{label}\"]"),
            NodeShape::Decision => format!("{id}{{\"{label}\"}}"),
            NodeShape::Terminal => format!("{id}([\"{label}\"])"),
            NodeShape::Blocking => format!("{id}[/\"{label}\"/]"),
        };
        let _ = writeln!(out, "{pad}{body}");
    }
}

fn emit_edge(out: &mut String, edge: &EdgeIR, indent: usize) {
    let pad = "    ".repeat(indent);
    let src = mermaid_id(&edge.source_id);
    let tgt = mermaid_id(&edge.target_id);

    if edge.outcome.is_empty() || edge.outcome == "Done" {
        let _ = writeln!(out, "{pad}{src} --> {tgt}");
    } else {
        let _ = writeln!(out, "{pad}{src} -->|{}| {tgt}", edge.outcome);
    }
}

fn mermaid_id(id: &str) -> String {
    id.chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' })
        .collect()
}

fn escape_label(label: &str) -> String {
    label.replace('"', "#quot;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mermaid_id_replaces_hyphens_and_dots() {
        assert_eq!(mermaid_id("activity-1"), "activity_1");
        assert_eq!(mermaid_id("a.b.c"), "a_b_c");
        assert_eq!(mermaid_id("HttpEndpoint1"), "HttpEndpoint1");
    }

    #[test]
    fn escape_label_replaces_quotes() {
        assert_eq!(escape_label(r#"say "hi""#), "say #quot;hi#quot;");
    }
}
