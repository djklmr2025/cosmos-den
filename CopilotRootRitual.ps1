Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Crear formulario
$form = New-Object System.Windows.Forms.Form
$form.Text = "Copilot para Visual"
$form.Size = New-Object System.Drawing.Size(500,400)
$form.StartPosition = "CenterScreen"

# Etiqueta de estado
$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = "Listo para explorar y validar artefactos..."
$statusLabel.AutoSize = $true
$statusLabel.Location = New-Object System.Drawing.Point(20,20)
$form.Controls.Add($statusLabel)

# Botón: Explorar archivos
$exploreButton = New-Object System.Windows.Forms.Button
$exploreButton.Text = "Explorar Cadenas"
$exploreButton.Size = New-Object System.Drawing.Size(200,40)
$exploreButton.Location = New-Object System.Drawing.Point(20,60)
$form.Controls.Add($exploreButton)

# Botón: Validar archivos
$validateButton = New-Object System.Windows.Forms.Button
$validateButton.Text = "Validar entradas"
$validateButton.Size = New-Object System.Drawing.Size(200,40)
$validateButton.Location = New-Object System.Drawing.Point(240,60)
$form.Controls.Add($validateButton)

# Cuadro de texto para mostrar resultados
$outputBox = New-Object System.Windows.Forms.TextBox
$outputBox.Multiline = $true
$outputBox.ScrollBars = "Vertical"
$outputBox.Size = New-Object System.Drawing.Size(440,220)
$outputBox.Location = New-Object System.Drawing.Point(20,120)
$form.Controls.Add($outputBox)

# Acción: Explorar archivos
$exploreButton.Add_Click({
    $files = Get-ChildItem "C:\arkaios" -File -Recurse -ErrorAction SilentlyContinue
    if ($files) {
        $outputBox.Clear()
        foreach ($file in $files) {
            $outputBox.AppendText("Archivo encontrado: " + $file.FullName + "`r`n")
        }
        $statusLabel.Text = "Exploración completada."
    } else {
        $statusLabel.Text = "No se encontraron archivos o acceso denegado."
    }
})

# Acción: Validar archivos con SHA256
$validateButton.Add_Click({
    $files = Get-ChildItem "C:\arkaios" -File -Recurse -ErrorAction SilentlyContinue
    if ($files) {
        $outputBox.Clear()
        foreach ($file in $files) {
            try {
                $hash = Get-FileHash $file.FullName -Algorithm SHA256
                $outputBox.AppendText("Archivo: " + $file.Name + "`r`n")
                $outputBox.AppendText("Ruta: " + $file.FullName + "`r`n")
                $outputBox.AppendText("SHA256: " + $hash.Hash + "`r`n")
                $outputBox.AppendText("--------`r`n")
            } catch {
                $outputBox.AppendText("Error al validar: " + $file.FullName + "`r`n")
            }
        }
        $statusLabel.Text = "Validación completada."
    } else {
        $statusLabel.Text = "No se encontraron archivos para validar."
    }
})

# Mostrar formulario
$form.Topmost = $true
$form.Add_Shown({$form.Activate()})
[void]$form.ShowDialog()