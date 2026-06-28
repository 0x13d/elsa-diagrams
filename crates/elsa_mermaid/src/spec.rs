use std::fmt::Write;

use serde_json::Value;

use crate::ir::{ActivityNode, EdgeIR, NodeShape, PropertyIR, WorkflowIR};
use crate::label::{activity_label, sanitize_type};

pub fn render_spec(ir: &WorkflowIR) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "# {}", ir.name);
    out.push('\n');

    write_workflow_meta(&mut out, ir);

    for node in &ir.nodes {
        write_activity_section(&mut out, node, &ir.edges, 2);
    }

    while out.ends_with('\n') {
        out.pop();
    }
    out.push('\n');
    out
}

fn write_workflow_meta(out: &mut String, ir: &WorkflowIR) {
    let mut bits: Vec<String> = Vec::new();
    bits.push(format!("**Workflow ID:** `{}`", ir.id));
    if let Some(def) = &ir.definition_id {
        if def != &ir.id {
            bits.push(format!("**Definition ID:** `{def}`"));
        }
    }
    if let Some(v) = ir.version {
        bits.push(format!("**Version:** {v}"));
    }
    if let Some(p) = ir.is_published {
        bits.push(format!("**Published:** {p}"));
    }
    if let Some(l) = ir.is_latest {
        bits.push(format!("**Latest:** {l}"));
    }
    let _ = writeln!(out, "{}", bits.join(" &middot; "));
    out.push('\n');
}

fn write_activity_section(out: &mut String, node: &ActivityNode, edges: &[EdgeIR], depth: usize) {
    let heading = "#".repeat(depth.min(6));
    let label = activity_label(node);
    let _ = writeln!(out, "<!-- elsa-activity: {} -->", node.id);
    let _ = writeln!(out, "{heading} {label}");
    out.push('\n');

    let mut chips: Vec<String> = Vec::new();
    chips.push(format!("**Id:** `{}`", node.id));
    chips.push(format!(
        "**Type:** `{}`",
        sanitize_type(&node.activity_type)
    ));
    chips.push(format!("**Shape:** {}", shape_label(&node.shape)));
    if node.is_start {
        chips.push("**Role:** Start".to_string());
    }
    let _ = writeln!(out, "{}", chips.join(" &middot; "));
    out.push('\n');

    write_pretty_properties(out, node);
    write_extras(out, node);
    write_edge_summary(out, &node.id, edges);

    if let Some(children) = &node.children {
        let _ = writeln!(out, "_Composite activity. Inner steps:_");
        out.push('\n');
        for child in &children.nodes {
            write_activity_section(out, child, &children.edges, (depth + 1).min(6));
        }
    }
}

fn shape_label(shape: &NodeShape) -> &'static str {
    match shape {
        NodeShape::Default => "Step",
        NodeShape::Decision => "Decision",
        NodeShape::Terminal => "Terminal",
        NodeShape::Blocking => "Blocking",
    }
}

fn write_pretty_properties(out: &mut String, node: &ActivityNode) {
    if node.properties.is_empty() {
        return;
    }
    let tail = node
        .activity_type
        .rsplit('.')
        .next()
        .unwrap_or(&node.activity_type)
        .to_lowercase();

    if let Some(rendered) = curated_property_block(&tail, &node.properties) {
        out.push_str(&rendered);
        out.push('\n');
        return;
    }
    write_default_properties(out, &node.properties);
}

fn write_default_properties(out: &mut String, props: &[PropertyIR]) {
    let _ = writeln!(out, "**Properties**");
    out.push('\n');
    for p in props {
        let mut line = format!("- **{}**", p.name);
        if let Some(s) = &p.syntax {
            let _ = write!(line, " *(`{s}`)*");
        }
        line.push_str(": ");
        line.push_str(&format_value_inline(&p.value));
        let _ = writeln!(out, "{line}");
    }
    out.push('\n');
}

fn curated_property_block(tail: &str, props: &[PropertyIR]) -> Option<String> {
    match tail {
        "httpendpoint" => Some(pretty_http_endpoint(props)),
        "httpresponse" | "writehttpresponse" => Some(pretty_http_response(props)),
        "if" | "ifelse" => Some(pretty_if(props)),
        "switch" => Some(pretty_switch(props)),
        "sendemail" => Some(pretty_send_email(props)),
        "signalreceived" | "receivesignal" => Some(pretty_signal_received(props)),
        "sendsignal" => Some(pretty_send_signal(props)),
        "writeline" => Some(pretty_write_line(props)),
        "timer" => Some(pretty_timer(props)),
        "cron" | "cronevent" => Some(pretty_cron(props)),
        "delay" => Some(pretty_delay(props)),
        "setvariable" => Some(pretty_set_variable(props)),
        _ => None,
    }
}

fn find_prop<'a>(props: &'a [PropertyIR], name: &str) -> Option<&'a PropertyIR> {
    props
        .iter()
        .find(|p| p.name.eq_ignore_ascii_case(name))
}

fn pretty_http_endpoint(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Endpoint**\n\n");
    let path = find_prop(props, "Path")
        .map(|p| format_value_inline(&p.value))
        .unwrap_or_else(|| "_(unspecified)_".to_string());
    let methods = find_prop(props, "Methods")
        .or_else(|| find_prop(props, "SupportedMethods"))
        .map(|p| format_value_inline(&p.value))
        .unwrap_or_else(|| "`GET`".to_string());
    let _ = writeln!(out, "- **Path:** {path}");
    let _ = writeln!(out, "- **Methods:** {methods}");
    if let Some(p) = find_prop(props, "ReadContent") {
        let _ = writeln!(out, "- **Read body:** {}", format_value_inline(&p.value));
    }
    if let Some(p) = find_prop(props, "Authorize") {
        let _ = writeln!(out, "- **Authorize:** {}", format_value_inline(&p.value));
    }
    out
}

fn pretty_http_response(props: &[PropertyIR]) -> String {
    let mut out = String::from("**HTTP response**\n\n");
    if let Some(p) = find_prop(props, "StatusCode") {
        let _ = writeln!(out, "- **Status:** {}", format_value_inline(&p.value));
    }
    if let Some(p) = find_prop(props, "ContentType") {
        let _ = writeln!(out, "- **Content-Type:** {}", format_value_inline(&p.value));
    }
    if let Some(p) = find_prop(props, "Content") {
        let _ = writeln!(out, "- **Body:**");
        out.push_str(&format_value_block(&p.value, p.syntax.as_deref(), 1));
    }
    out
}

fn pretty_if(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Branch condition**\n\n");
    let cond = find_prop(props, "Condition");
    match cond {
        Some(p) => {
            let _ = writeln!(out, "- **Condition:**");
            out.push_str(&format_value_block(&p.value, p.syntax.as_deref(), 1));
        }
        None => {
            let _ = writeln!(out, "- _(no condition expression set)_");
        }
    }
    let _ = writeln!(
        out,
        "- **Outcomes:** `True` (matched), `False` (otherwise)"
    );
    out
}

fn pretty_switch(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Switch cases**\n\n");
    if let Some(p) = find_prop(props, "Cases") {
        if let Some(arr) = p.value.as_array() {
            for case in arr {
                let name = case
                    .get("name")
                    .or_else(|| case.get("Name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("(unnamed)");
                let expr = case
                    .get("condition")
                    .or_else(|| case.get("Condition"))
                    .map(format_value_inline)
                    .unwrap_or_else(|| "_(empty)_".to_string());
                let _ = writeln!(out, "- **{name}** → {expr}");
            }
        } else {
            out.push_str(&format_value_block(&p.value, p.syntax.as_deref(), 0));
        }
    } else {
        let _ = writeln!(out, "_(no cases defined)_");
    }
    out
}

fn pretty_send_email(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Email message**\n\n");
    for key in ["From", "To", "Cc", "Bcc", "Subject"] {
        if let Some(p) = find_prop(props, key) {
            let _ = writeln!(out, "- **{key}:** {}", format_value_inline(&p.value));
        }
    }
    if let Some(p) = find_prop(props, "Body") {
        let _ = writeln!(out, "- **Body:**");
        out.push_str(&format_value_block(&p.value, p.syntax.as_deref(), 1));
    }
    out
}

fn pretty_signal_received(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Awaits signal**\n\n");
    let name = find_prop(props, "Signal")
        .or_else(|| find_prop(props, "SignalName"))
        .map(|p| format_value_inline(&p.value))
        .unwrap_or_else(|| "_(any)_".to_string());
    let _ = writeln!(out, "- **Signal name:** {name}");
    out.push_str("- Suspends the workflow until a matching signal is received.\n");
    out
}

fn pretty_send_signal(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Sends signal**\n\n");
    let name = find_prop(props, "Signal")
        .or_else(|| find_prop(props, "SignalName"))
        .map(|p| format_value_inline(&p.value))
        .unwrap_or_else(|| "_(unspecified)_".to_string());
    let _ = writeln!(out, "- **Signal name:** {name}");
    if let Some(p) = find_prop(props, "Input") {
        let _ = writeln!(out, "- **Payload:** {}", format_value_inline(&p.value));
    }
    out
}

fn pretty_write_line(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Writes line**\n\n");
    let text = find_prop(props, "Text")
        .map(|p| format_value_inline(&p.value))
        .unwrap_or_else(|| "_(empty)_".to_string());
    let _ = writeln!(out, "- **Text:** {text}");
    out
}

fn pretty_timer(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Timer**\n\n");
    let interval = find_prop(props, "Timeout")
        .or_else(|| find_prop(props, "Interval"))
        .map(|p| format_value_inline(&p.value))
        .unwrap_or_else(|| "_(unspecified)_".to_string());
    let _ = writeln!(out, "- **Interval:** {interval}");
    out
}

fn pretty_cron(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Cron trigger**\n\n");
    let expr = find_prop(props, "CronExpression")
        .map(|p| format_value_inline(&p.value))
        .unwrap_or_else(|| "_(unspecified)_".to_string());
    let _ = writeln!(out, "- **Expression:** {expr}");
    out
}

fn pretty_delay(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Delay**\n\n");
    let dur = find_prop(props, "TimeSpan")
        .or_else(|| find_prop(props, "Duration"))
        .map(|p| format_value_inline(&p.value))
        .unwrap_or_else(|| "_(unspecified)_".to_string());
    let _ = writeln!(out, "- **Duration:** {dur}");
    out
}

fn pretty_set_variable(props: &[PropertyIR]) -> String {
    let mut out = String::from("**Set variable**\n\n");
    if let Some(p) = find_prop(props, "Variable").or_else(|| find_prop(props, "VariableName")) {
        let _ = writeln!(out, "- **Variable:** {}", format_value_inline(&p.value));
    }
    if let Some(p) = find_prop(props, "Value") {
        let _ = writeln!(out, "- **Value:** {}", format_value_inline(&p.value));
    }
    out
}

fn write_extras(out: &mut String, node: &ActivityNode) {
    if node.extras.is_empty() {
        return;
    }
    let _ = writeln!(out, "**Configuration**");
    out.push('\n');
    for (k, v) in &node.extras {
        let _ = writeln!(out, "- **{k}:** {}", format_value_inline(v));
    }
    out.push('\n');
}

fn write_edge_summary(out: &mut String, id: &str, edges: &[EdgeIR]) {
    let inbound: Vec<&EdgeIR> = edges.iter().filter(|e| e.target_id == id).collect();
    let outbound: Vec<&EdgeIR> = edges.iter().filter(|e| e.source_id == id).collect();

    if inbound.is_empty() && outbound.is_empty() {
        return;
    }

    let _ = writeln!(out, "**Flow**");
    out.push('\n');

    if inbound.is_empty() {
        let _ = writeln!(out, "- **In:** _(start)_");
    } else {
        let _ = writeln!(out, "- **In:**");
        for e in inbound {
            let port = match &e.target_port {
                Some(p) if p != "In" => format!(" → port `{p}`"),
                _ => String::new(),
            };
            let outcome = if e.outcome.is_empty() || e.outcome == "Done" {
                String::new()
            } else {
                format!(" *(via `{}`)*", e.outcome)
            };
            let _ = writeln!(out, "    - from `{}`{outcome}{port}", e.source_id);
        }
    }

    if outbound.is_empty() {
        let _ = writeln!(out, "- **Out:** _(terminal)_");
    } else {
        let _ = writeln!(out, "- **Out:**");
        for e in outbound {
            let outcome = if e.outcome.is_empty() || e.outcome == "Done" {
                "`Done`".to_string()
            } else {
                format!("`{}`", e.outcome)
            };
            let _ = writeln!(out, "    - {outcome} → `{}`", e.target_id);
        }
    }
    out.push('\n');
}

fn format_value_inline(v: &Value) -> String {
    match v {
        Value::Null => "_(unset)_".to_string(),
        Value::Bool(b) => format!("`{b}`"),
        Value::Number(n) => format!("`{n}`"),
        Value::String(s) => {
            if s.is_empty() {
                "_(empty string)_".to_string()
            } else if s.contains('\n') {
                "_(multiline — see below)_".to_string()
            } else {
                format!("`{s}`")
            }
        }
        // Elsa v3 expression: { type, value }
        Value::Object(map) => {
            if let (Some(t), Some(val)) = (map.get("type"), map.get("value")) {
                let ty = t.as_str().unwrap_or("");
                let inner = format_value_inline(val);
                if ty.is_empty() {
                    inner
                } else {
                    format!("{inner} *(`{ty}`)*")
                }
            } else if let Some(expr) = map.get("expression") {
                format_value_inline(expr)
            } else {
                format!("`{}`", compact_json(v))
            }
        }
        Value::Array(_) => format!("`{}`", compact_json(v)),
    }
}

fn format_value_block(v: &Value, syntax: Option<&str>, indent_steps: usize) -> String {
    let indent = "    ".repeat(indent_steps);
    let (raw, inferred_lang) = extract_code(v);
    let lang = syntax_to_lang(syntax).or(inferred_lang).unwrap_or("");
    let mut out = String::new();
    let _ = writeln!(out, "{indent}```{lang}");
    for line in raw.lines() {
        let _ = writeln!(out, "{indent}{line}");
    }
    if !raw.ends_with('\n') {
        // ensure trailing newline already from writeln
    }
    let _ = writeln!(out, "{indent}```");
    out
}

fn extract_code(v: &Value) -> (String, Option<&'static str>) {
    match v {
        Value::String(s) => (s.clone(), None),
        Value::Object(map) => {
            if let Some(value) = map.get("value") {
                let (text, _) = extract_code(value);
                let lang = syntax_to_lang(map.get("type").and_then(|t| t.as_str()));
                (text, lang)
            } else if let Some(expr) = map.get("expression") {
                extract_code(expr)
            } else {
                (pretty_json(v), Some("json"))
            }
        }
        Value::Null => ("(unset)".to_string(), None),
        _ => (pretty_json(v), Some("json")),
    }
}

fn syntax_to_lang(syntax: Option<&str>) -> Option<&'static str> {
    let s = syntax?.to_lowercase();
    match s.as_str() {
        "javascript" | "js" => Some("javascript"),
        "csharp" | "c#" => Some("csharp"),
        "liquid" => Some("liquid"),
        "literal" | "object" | "json" => Some(""),
        _ => None,
    }
}

fn compact_json(v: &Value) -> String {
    serde_json::to_string(v).unwrap_or_else(|_| "(unrenderable)".to_string())
}

fn pretty_json(v: &Value) -> String {
    serde_json::to_string_pretty(v).unwrap_or_else(|_| "(unrenderable)".to_string())
}

pub fn render_combined(ir: &WorkflowIR, mermaid: &str) -> String {
    let mut out = String::new();
    let _ = writeln!(out, "# {}", ir.name);
    out.push('\n');
    write_workflow_meta(&mut out, ir);
    let _ = writeln!(out, "## Diagram");
    out.push('\n');
    let _ = writeln!(out, "```mermaid");
    out.push_str(mermaid.trim_end());
    out.push('\n');
    let _ = writeln!(out, "```");
    out.push('\n');
    let _ = writeln!(out, "## Activities");
    out.push('\n');
    for node in &ir.nodes {
        write_activity_section(&mut out, node, &ir.edges, 3);
    }
    while out.ends_with('\n') {
        out.pop();
    }
    out.push('\n');
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detect::detect;
    use crate::normalize::normalize;

    fn ir_from(json_str: &str) -> WorkflowIR {
        let json: Value = serde_json::from_str(json_str).expect("valid JSON");
        let version = detect(&json).expect("detect");
        normalize(&json, version).expect("normalize")
    }

    #[test]
    fn spec_includes_workflow_meta_and_per_activity_section() {
        let ir = ir_from(include_str!("../../../tests/fixtures/v2_document_approval.json"));
        let md = render_spec(&ir);
        assert!(md.starts_with("# Document Approval"));
        assert!(md.contains("**Workflow ID:** `doc-approval`"));
        assert!(md.contains("**Version:** 1"));
        assert!(md.contains("<!-- elsa-activity: activity-1 -->"));
        assert!(md.contains("## Receive Document"));
        assert!(md.contains("**Type:** `Http Endpoint`"));
        assert!(md.contains("**Shape:** Terminal"));
    }

    #[test]
    fn spec_renders_curated_http_endpoint() {
        let ir = ir_from(include_str!("../../../tests/fixtures/v2_if_branch.json"));
        let md = render_spec(&ir);
        assert!(md.contains("**Endpoint**"));
        assert!(md.contains("**Path:** `/document`"));
    }

    #[test]
    fn spec_describes_inbound_and_outbound_flow() {
        let ir = ir_from(include_str!("../../../tests/fixtures/v3_composite.json"));
        let md = render_spec(&ir);
        assert!(md.contains("**Flow**"));
        assert!(md.contains("`True` → `Sequence1`"));
        assert!(md.contains("from `If1`"));
    }

    #[test]
    fn spec_recurses_into_composites() {
        let ir = ir_from(include_str!("../../../tests/fixtures/v3_composite.json"));
        let md = render_spec(&ir);
        assert!(md.contains("<!-- elsa-activity: Sequence1 -->"));
        assert!(md.contains("<!-- elsa-activity: Email1 -->"));
        assert!(md.contains("<!-- elsa-activity: Signal1 -->"));
        assert!(md.contains("Wait for Decision"));
        assert!(md.contains("Composite activity"));
    }

    #[test]
    fn spec_signal_received_curated_block_renders() {
        let json = r#"{
            "id": "wf",
            "root": {
                "id": "fc",
                "type": "Elsa.Flowchart",
                "activities": [{
                    "id": "Signal1",
                    "type": "Elsa.SignalReceived",
                    "displayName": "Wait",
                    "properties": {
                        "Signal": { "type": "Literal", "value": "approved" }
                    }
                }],
                "connections": []
            }
        }"#;
        let ir = ir_from(json);
        let md = render_spec(&ir);
        assert!(md.contains("Awaits signal"));
        assert!(md.contains("**Signal name:** `approved`"));
    }

    #[test]
    fn combined_inlines_mermaid_fenced_block() {
        let ir = ir_from(include_str!("../../../tests/fixtures/v3_hello_world.json"));
        let combined = render_combined(&ir, "flowchart TD\n    A[\"x\"]\n");
        assert!(combined.contains("## Diagram"));
        assert!(combined.contains("```mermaid"));
        assert!(combined.contains("flowchart TD"));
        assert!(combined.contains("## Activities"));
    }
}
