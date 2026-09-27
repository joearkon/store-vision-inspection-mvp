$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $ProjectRoot
try {
    python -m compileall -q apps tests
    python -m unittest discover -s tests -v
    Push-Location (Join-Path $ProjectRoot "apps\web")
    try {
        npm test
        npm run build
    }
    finally {
        Pop-Location
    }
    git diff --check
}
finally {
    Pop-Location
}
