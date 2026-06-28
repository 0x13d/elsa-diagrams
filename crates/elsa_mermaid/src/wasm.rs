use wasm_bindgen::prelude::*;

use crate::{convert, convert_combined, convert_spec, ConvertOptions};

#[wasm_bindgen]
pub fn convert_to_mermaid(workflow_json: &str, options_json: &str) -> Result<String, JsValue> {
    let opts: ConvertOptions = serde_json::from_str(options_json).unwrap_or_default();
    convert(workflow_json, &opts).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn convert_to_spec(workflow_json: &str) -> Result<String, JsValue> {
    convert_spec(workflow_json).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn convert_to_combined(workflow_json: &str, options_json: &str) -> Result<String, JsValue> {
    let opts: ConvertOptions = serde_json::from_str(options_json).unwrap_or_default();
    convert_combined(workflow_json, &opts).map_err(|e| JsValue::from_str(&e))
}
