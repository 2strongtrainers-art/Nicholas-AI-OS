# Ghidra 12.2 acquisition and verification

Official upstream: https://github.com/NationalSecurityAgency/ghidra

## Actual status

- Official Ghidra 12.2 release downloaded and SHA-256 matched published GitHub release metadata.
- Java Temurin 25.0.5+8.0.LTS downloaded from Adoptium metadata and checksum verified.
- Linux x86_64 headless import, analysis, decompilation and recompilation passed.
- The recovered function matched the original program on all six inputs below.
- A fork into 2strongtrainers-art is **pending browser authentication**. This document is a verification record, not a substitute for the upstream fork.
- No Mac installation, GUI operation, MCP connection or arbitrary-software compatibility was verified.

## Downloads and provenance

- ghidra: https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.2_build/ghidra_12.2_PUBLIC_20261016.zip\n  - Bytes: 569712708; SHA-256: `2c2cd776db3c1f6a097ba418922378ac3649cadd5e844a6f5f088ae628a7be67`
- jdk: https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.5%2B8/OpenJDK25U-jdk_x64_linux_hotspot_25.0.5_8.tar.gz\n  - Bytes: 141341188; SHA-256: `68982529869257d0ee6b824ec5aa270ff8b118bb438670da0b97ebdab178d7fb`

Upstream license: Apache-2.0, with bundled third-party components carrying their own notices. Setup documentation for the tested tag: https://github.com/NationalSecurityAgency/ghidra/blob/Ghidra_12.2_build/GhidraDocs/GettingStarted.md

## Functional proof

A self-authored C sample was compiled with GCC using `-O0 -fno-pie -no-pie`, without DWARF debug information. Ghidra headless imported and analyzed that ELF binary; the post-script recovered the function. The recovered C was compiled separately and run on the same inputs. This proves the tested decompiler path works for this example; it does not recover original comments or guarantee original source reconstruction.

Sample SHA-256: `eecd41f55977687d52c6f238b0b98adf6b72b82f66468424c3944cd4387cd668`

| Input | Original | Recovered |
| --- | --- | --- |
| -10 | -147 | -147 |
| -1 | 6 | 6 |
| 0 | 23 | 23 |
| 1 | 40 | 40 |
| 3 | 74 | 74 |
| 100 | 1723 | 1723 |

Recovered C:

```c
int price_for(int param_1)

{
  return param_1 * 0x11 + 0x17;
}
```

## Extraction correction

The initial Python ZIP extraction left launcher/native execute permissions unset. Executable permissions were restored within the isolated installation. An early launch returned zero despite a script/decompiler error; verification therefore required the named-function marker, no script error, an output file, successful recompilation and matching outputs. No application logic was patched.

## Reproducible sample

```c
#include <stdio.h>
#include <stdlib.h>
__attribute__((noinline)) int price_for(int quantity) {
    return quantity * 17 + 23;
}
int main(int argc, char **argv) {
    int quantity = argc > 1 ? atoi(argv[1]) : 3;
    printf("%d\n", price_for(quantity));
    return 0;
}
```

Post-script, saved as `VerifyDecompile.java`:

```java
import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.program.model.listing.Function;
import java.nio.file.Files;
import java.nio.file.Path;

public class VerifyDecompile extends GhidraScript {
    public void run() throws Exception {
        DecompInterface decompiler = new DecompInterface();
        try {
            if (!decompiler.openProgram(currentProgram)) throw new Exception("Program open failed");
            Function target = currentProgram.getFunctionManager().getFunctions(true).next();
            boolean found = false;
            for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
                if (f.getName().equals("price_for")) { target = f; found = true; break; }
            }
            if (!found) throw new Exception("price_for function not found");
            DecompileResults result = decompiler.decompileFunction(target, 60, monitor);
            if (!result.decompileCompleted()) throw new Exception(result.getErrorMessage());
            String code = result.getDecompiledFunction().getC();
            Files.writeString(Path.of(getScriptArgs()[0]), code);
            println("VERIFIED_FUNCTION: " + target.getName());
            println(code);
        } finally { decompiler.dispose(); }
    }
}
```

Run with the tested Ghidra release and JDK25, substituting installation paths:

```bash
gcc -O0 -fno-pie -no-pie -o sample sample.c
mkdir -p projects
/path/to/ghidra_12.2_PUBLIC/support/analyzeHeadless projects NickSmoke -import sample -scriptPath . -postScript VerifyDecompile.java decompiled.c -deleteProject
```

Use an isolated project directory. GitHub is source/version storage; a fork alone is not an installed desktop application. Existing workflows and account permissions were not changed by this verification.
