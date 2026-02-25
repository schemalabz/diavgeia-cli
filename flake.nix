{
  description = "diavgeia-cli — TypeScript client & CLI for the Diavgeia API";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forAllSystems =
        f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
    in {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs
            pkgs.nodePackages.npm
          ];

          shellHook = ''
            echo ""
            echo "Inside diavgeia-cli Nix dev shell"
            echo ""
            echo "  node $(node --version)"
            echo "  npm  $(npm --version)"
            echo ""
            echo "Run 'npm install' then 'npm test' to run tests."
          '';
        };
      });

      packages = forAllSystems (pkgs: {
        default = pkgs.buildNpmPackage {
          pname = "diavgeia-cli";
          version = "0.1.0";
          src = ./.;

          npmDepsHash = "sha256-BkYt2mWavQu48O0fWp3+gHbwRYDNrdMJrihr6f6qkD0=";

          buildPhase = ''
            npm run build
          '';

          installPhase = ''
            runHook preInstall

            mkdir -p $out/lib/diavgeia-cli $out/bin
            cp -r dist $out/lib/diavgeia-cli/
            cp -r node_modules $out/lib/diavgeia-cli/
            cp package.json $out/lib/diavgeia-cli/

            # Create wrapper script
            cat > $out/bin/diavgeia <<'EOF'
#!/usr/bin/env bash
exec ${pkgs.nodejs}/bin/node "$(dirname "$(readlink -f "$0")")/../lib/diavgeia-cli/dist/cli/index.js" "$@"
EOF
            chmod +x $out/bin/diavgeia

            runHook postInstall
          '';

          doCheck = false;

          meta = {
            description = "TypeScript client and CLI for the Diavgeia (Greek Government Transparency) API";
            mainProgram = "diavgeia";
          };
        };
      });
    };
}
