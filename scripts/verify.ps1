$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PythonExecutable = if ($env:STV_PYTHON) { $env:STV_PYTHON } else { "python" }

Push-Location $ProjectRoot
try {
    & $PythonExecutable -m compileall -q apps tests
    if ($LASTEXITCODE -ne 0) { throw "Python compile check failed" }
    & $PythonExecutable -m unittest discover -s tests -v
    if ($LASTEXITCODE -ne 0) { throw "Python test suite failed" }
    Push-Location (Join-Path $ProjectRoot "apps\web")
    try {
        npm test
        if ($LASTEXITCODE -ne 0) { throw "Web test suite failed" }
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Web build failed" }
    }
    finally {
        Pop-Location
    }
    $SafeProjectRoot = $ProjectRoot.Replace('\', '/')
    git -c "safe.directory=$SafeProjectRoot" -C $ProjectRoot diff --check
    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check failed"
    }
}
finally {
    Pop-Location
}
