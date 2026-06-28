pub mod detect;
pub mod ir;
pub mod label;
pub mod normalize;
pub mod render;
pub mod spec;

#[cfg(feature = "wasm")]
pub mod wasm;

use render::Direction;

#[derive(serde::Deserialize, Default, Debug, Clone)]
pub struct ConvertOptions {
    #[serde(default)]
    pub direction: DirectionOpt,
}

#[derive(serde::Deserialize, Default, Debug, Clone, Copy)]
#[serde(rename_all = "UPPERCASE")]
pub enum DirectionOpt {
    #[default]
    TD,
    LR,
    BT,
    RL,
}

impl From<DirectionOpt> for Direction {
    fn from(d: DirectionOpt) -> Self {
        match d {
            DirectionOpt::TD => Direction::TopDown,
            DirectionOpt::LR => Direction::LeftRight,
            DirectionOpt::BT => Direction::BottomTop,
            DirectionOpt::RL => Direction::RightLeft,
        }
    }
}

fn build_ir(workflow_json: &str) -> Result<serde_json::Value, String> {
    serde_json::from_str(workflow_json).map_err(|e| format!("Invalid JSON: {e}"))
}

fn ir_from_json(json: &serde_json::Value) -> Result<ir::WorkflowIR, String> {
    let version = detect::detect(json)?;
    normalize::normalize(json, version)
}

pub fn convert(workflow_json: &str, opts: &ConvertOptions) -> Result<String, String> {
    let json = build_ir(workflow_json)?;
    let ir = ir_from_json(&json)?;
    let render_opts = render::RenderOptions {
        direction: opts.direction.into(),
    };
    Ok(render::render(&ir, &render_opts))
}

pub fn convert_spec(workflow_json: &str) -> Result<String, String> {
    let json = build_ir(workflow_json)?;
    let ir = ir_from_json(&json)?;
    Ok(spec::render_spec(&ir))
}

pub fn convert_combined(workflow_json: &str, opts: &ConvertOptions) -> Result<String, String> {
    let json = build_ir(workflow_json)?;
    let ir = ir_from_json(&json)?;
    let render_opts = render::RenderOptions {
        direction: opts.direction.into(),
    };
    let mermaid = render::render(&ir, &render_opts);
    Ok(spec::render_combined(&ir, &mermaid))
}
