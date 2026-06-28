use std::fs;
use std::io::{self, Read, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Parser, ValueEnum};
use elsa_mermaid::{convert, convert_combined, convert_spec, ConvertOptions, DirectionOpt};

#[derive(Parser)]
#[command(name = "elsa-to-mermaid", about = "Convert Elsa workflow JSON to Mermaid diagram")]
struct Args {
    /// Input JSON file (omit to read from stdin)
    input: Option<PathBuf>,

    /// Output file (omit to write to stdout)
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Flowchart direction
    #[arg(short, long, default_value = "TD")]
    direction: String,

    /// Wrap Mermaid output in a Markdown fenced code block (ignored for --format=spec)
    #[arg(long)]
    fenced: bool,

    /// Output format
    #[arg(short, long, value_enum, default_value_t = Format::Mermaid)]
    format: Format,

    /// Shortcut for --format=spec
    #[arg(long, conflicts_with_all = ["combined", "format"])]
    spec: bool,

    /// Shortcut for --format=combined
    #[arg(long, conflicts_with_all = ["spec", "format"])]
    combined: bool,
}

#[derive(Copy, Clone, Debug, ValueEnum, PartialEq, Eq)]
enum Format {
    /// Raw Mermaid diagram only
    Mermaid,
    /// Markdown spec sheet only
    Spec,
    /// Combined markdown: workflow meta, fenced diagram, then spec sheet
    Combined,
}

fn parse_direction(s: &str) -> Result<DirectionOpt, String> {
    match s.to_ascii_uppercase().as_str() {
        "TD" => Ok(DirectionOpt::TD),
        "LR" => Ok(DirectionOpt::LR),
        "BT" => Ok(DirectionOpt::BT),
        "RL" => Ok(DirectionOpt::RL),
        other => Err(format!("Invalid direction: '{other}' (expected TD, LR, BT, RL)")),
    }
}

fn read_input(path: Option<&PathBuf>) -> io::Result<String> {
    match path {
        Some(p) => fs::read_to_string(p),
        None => {
            let mut buf = String::new();
            io::stdin().read_to_string(&mut buf)?;
            Ok(buf)
        }
    }
}

fn write_output(path: Option<&PathBuf>, content: &str) -> io::Result<()> {
    match path {
        Some(p) => fs::write(p, content),
        None => {
            io::stdout().write_all(content.as_bytes())?;
            Ok(())
        }
    }
}

fn resolve_format(args: &Args) -> Format {
    if args.spec {
        Format::Spec
    } else if args.combined {
        Format::Combined
    } else {
        args.format
    }
}

fn run() -> Result<(), String> {
    let args = Args::parse();
    let direction = parse_direction(&args.direction)?;
    let format = resolve_format(&args);

    let input = read_input(args.input.as_ref())
        .map_err(|e| format!("Failed to read input: {e}"))?;
    let opts = ConvertOptions { direction };

    let payload = match format {
        Format::Mermaid => {
            let mermaid = convert(&input, &opts)?;
            if args.fenced {
                format!("```mermaid\n{mermaid}```\n")
            } else {
                mermaid
            }
        }
        Format::Spec => convert_spec(&input)?,
        Format::Combined => convert_combined(&input, &opts)?,
    };

    write_output(args.output.as_ref(), &payload)
        .map_err(|e| format!("Failed to write output: {e}"))?;

    Ok(())
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}
