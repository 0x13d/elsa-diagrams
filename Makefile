.PHONY: wasm wasm-node wasm-build cli vsix test all clean trust-report

# Builds the WASM artifact + JS bindings directly via cargo + wasm-bindgen-cli.
# wasm-pack 0.14.0 is incompatible with Cargo 1.94 (renamed --out-dir flag),
# so we drive the toolchain manually until wasm-pack ships a fix.
WASM_OUT := packages/elsa-to-mermaid/wasm
WASM_NODE_OUT := packages/elsa-to-mermaid/wasm-node
WASM_INPUT := target/wasm32-unknown-unknown/release/elsa_mermaid.wasm

wasm-build:
	cargo build --release --target wasm32-unknown-unknown \
		-p elsa_mermaid --features wasm

wasm: wasm-build
	mkdir -p $(WASM_OUT)
	wasm-bindgen --target bundler --out-dir $(WASM_OUT) $(WASM_INPUT)

wasm-node: wasm-build
	mkdir -p $(WASM_NODE_OUT)
	wasm-bindgen --target nodejs --out-dir $(WASM_NODE_OUT) $(WASM_INPUT)
	# wasm-bindgen's nodejs target emits CommonJS, but the package root is
	# "type": "module", so Node would treat these .js files as ESM and the named
	# imports in src/index.node.ts would fail. Pin the folder back to CommonJS.
	# (wasm-bindgen does not emit this itself; without it a clean build breaks the
	# Node smoke — see CLAUDE.md "Things to be careful about".)
	echo '{ "type": "commonjs" }' > $(WASM_NODE_OUT)/package.json

cli:
	cargo build --release -p elsa-mermaid-cli

vsix: wasm-node
	cd apps/vscode-extension && npm install && npm run package

test:
	cargo test --workspace

all: wasm wasm-node cli vsix

clean:
	cargo clean
	rm -rf $(WASM_OUT) $(WASM_NODE_OUT) packages/elsa-to-mermaid/dist
	rm -rf apps/vscode-extension/dist apps/vscode-extension/*.vsix

trust-report:
	bash scripts/trust-report.sh
