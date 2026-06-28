use crate::ir::{ActivityNode, NodeShape};

pub fn sanitize_type(activity_type: &str) -> String {
    let last_segment = activity_type.rsplit('.').next().unwrap_or(activity_type);

    let chars: Vec<char> = last_segment.chars().collect();
    let mut tokens: Vec<String> = Vec::new();
    let mut current = String::new();

    for (i, &ch) in chars.iter().enumerate() {
        let is_boundary = i > 0
            && ch.is_ascii_uppercase()
            && {
                let prev = chars[i - 1];
                if prev.is_ascii_lowercase() || prev.is_ascii_digit() {
                    true
                } else if prev.is_ascii_uppercase() {
                    chars.get(i + 1).map_or(false, |c| c.is_ascii_lowercase())
                } else {
                    false
                }
            };
        if is_boundary && !current.is_empty() {
            tokens.push(std::mem::take(&mut current));
        }
        current.push(ch);
    }
    if !current.is_empty() {
        tokens.push(current);
    }

    let joined = tokens.join(" ");

    if joined.chars().count() > 28 {
        let head: String = joined.chars().take(27).collect();
        format!("{head}…")
    } else {
        joined
    }
}

pub fn classify_shape(activity_type: &str) -> NodeShape {
    let last_segment = activity_type
        .rsplit('.')
        .next()
        .unwrap_or(activity_type)
        .to_lowercase();

    const DECISION: &[&str] = &["if", "switch", "fork"];
    const TERMINAL_TRIGGER: &[&str] =
        &["endpoint", "trigger", "start", "timer", "cron", "webhook"];
    const BLOCKING: &[&str] = &[
        "signal", "receive", "wait", "blocking", "approve", "suspend",
    ];
    const TERMINAL_END: &[&str] = &["finish", "fault", "terminate"];

    let contains_any =
        |patterns: &[&str]| patterns.iter().any(|p| last_segment.contains(p));

    if contains_any(DECISION) {
        NodeShape::Decision
    } else if contains_any(TERMINAL_TRIGGER) {
        NodeShape::Terminal
    } else if contains_any(BLOCKING) {
        NodeShape::Blocking
    } else if contains_any(TERMINAL_END) {
        NodeShape::Terminal
    } else {
        NodeShape::Default
    }
}

pub fn activity_label(node: &ActivityNode) -> String {
    node.display_name
        .clone()
        .unwrap_or_else(|| sanitize_type(&node.activity_type))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_strips_namespace_and_splits_pascalcase() {
        assert_eq!(sanitize_type("Elsa.Http.HttpEndpoint"), "Http Endpoint");
        assert_eq!(sanitize_type("HttpEndpoint"), "Http Endpoint");
        assert_eq!(sanitize_type("SendEmail"), "Send Email");
        assert_eq!(sanitize_type("If"), "If");
        assert_eq!(sanitize_type("Elsa.WriteLine"), "Write Line");
    }

    #[test]
    fn sanitize_keeps_acronym_runs_together() {
        assert_eq!(sanitize_type("HTTPEndpoint"), "HTTP Endpoint");
        assert_eq!(sanitize_type("IORead"), "IO Read");
        assert_eq!(sanitize_type("XMLHttp"), "XML Http");
    }

    #[test]
    fn sanitize_truncates_to_28_chars_with_ellipsis() {
        let long = "ThisIsAReallyLongActivityTypeNameThatExceedsLimit";
        let result = sanitize_type(long);
        assert_eq!(result.chars().count(), 28);
        assert!(result.ends_with('…'));
    }

    #[test]
    fn classify_decision_shapes() {
        assert_eq!(classify_shape("If"), NodeShape::Decision);
        assert_eq!(classify_shape("Elsa.If"), NodeShape::Decision);
        assert_eq!(classify_shape("Switch"), NodeShape::Decision);
        assert_eq!(classify_shape("Fork"), NodeShape::Decision);
    }

    #[test]
    fn classify_terminal_trigger_shapes() {
        assert_eq!(classify_shape("HttpEndpoint"), NodeShape::Terminal);
        assert_eq!(classify_shape("Elsa.Http.HttpEndpoint"), NodeShape::Terminal);
        assert_eq!(classify_shape("Timer"), NodeShape::Terminal);
        assert_eq!(classify_shape("CronTrigger"), NodeShape::Terminal);
        assert_eq!(classify_shape("Webhook"), NodeShape::Terminal);
    }

    #[test]
    fn classify_blocking_shapes() {
        assert_eq!(classify_shape("SignalReceived"), NodeShape::Blocking);
        assert_eq!(
            classify_shape("Elsa.Primitives.SignalReceived"),
            NodeShape::Blocking
        );
        assert_eq!(classify_shape("WaitForApproval"), NodeShape::Blocking);
        assert_eq!(classify_shape("Suspend"), NodeShape::Blocking);
    }

    #[test]
    fn classify_terminal_end_shapes() {
        assert_eq!(classify_shape("Finish"), NodeShape::Terminal);
        assert_eq!(classify_shape("Fault"), NodeShape::Terminal);
        assert_eq!(classify_shape("Terminate"), NodeShape::Terminal);
    }

    #[test]
    fn classify_default_for_unknown() {
        assert_eq!(classify_shape("SendEmail"), NodeShape::Default);
        assert_eq!(classify_shape("WriteLine"), NodeShape::Default);
        assert_eq!(
            classify_shape("Elsa.Http.WriteHttpResponse"),
            NodeShape::Default
        );
    }

    fn test_node(activity_type: &str, display_name: Option<&str>) -> ActivityNode {
        ActivityNode {
            id: "x".into(),
            activity_type: activity_type.into(),
            display_name: display_name.map(String::from),
            is_start: true,
            shape: NodeShape::Terminal,
            children: None,
            properties: Vec::new(),
            extras: std::collections::BTreeMap::new(),
        }
    }

    #[test]
    fn activity_label_prefers_display_name() {
        let n = test_node("HttpEndpoint", Some("Receive Doc"));
        assert_eq!(activity_label(&n), "Receive Doc");
    }

    #[test]
    fn activity_label_falls_back_to_sanitized_type() {
        let n = test_node("Elsa.Http.HttpEndpoint", None);
        assert_eq!(activity_label(&n), "Http Endpoint");
    }
}
