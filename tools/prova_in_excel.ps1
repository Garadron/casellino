# Opens a generated .xlsx in real Excel, compares sizes with the template and exports a PDF.
# Usage: powershell -File tools\prova_in_excel.ps1 -Generato <file.xlsx> -Modello <template.xlsm> -Pdf <out.pdf>
param(
  [Parameter(Mandatory = $true)][string]$Generato,
  [Parameter(Mandatory = $true)][string]$Modello,
  [Parameter(Mandatory = $true)][string]$Pdf,
  [string]$FoglioModello = '3A'
)
$ErrorActionPreference = 'Stop'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  $wbT = $excel.Workbooks.Open($Modello, 0, $true)
  # A network printer that is off makes Excel wait forever: use the PDF printer instead
  # (it can be chosen only while a workbook is open; Italian Excel says "su", English "on").
  $pdfPrinter = $null
  :outer foreach ($word in 'su', 'on') {
    foreach ($n in 0..20) {
      $name = 'Microsoft Print to PDF {0} Ne{1:D2}:' -f $word, $n
      try { $excel.ActivePrinter = $name; $pdfPrinter = $name; break outer } catch { }
    }
  }
  "Stampante usata per la prova: $pdfPrinter"
  $t = $wbT.Worksheets.Item($FoglioModello)
  $wbG = $excel.Workbooks.Open($Generato, 0, $true)
  $diff = 0
  foreach ($ws in $wbG.Worksheets) {
    foreach ($c in 1..170) {
      if ([math]::Abs($t.Columns($c).Width - $ws.Columns($c).Width) -gt 0.001) { $diff++; "Colonna $c : $($ws.Columns($c).Width) invece di $($t.Columns($c).Width)" }
    }
    foreach ($r in 1..51) {
      if ([math]::Abs($t.Rows($r).Height - $ws.Rows($r).Height) -gt 0.001) { $diff++; "Riga $r : $($ws.Rows($r).Height) invece di $($t.Rows($r).Height)" }
    }
    $ps = $ws.PageSetup
    "Foglio $($ws.Name): area di stampa $($ps.PrintArea) | orientamento $($ps.Orientation) (2 = orizzontale) | carta $($ps.PaperSize) (9 = A4) | zoom $($ps.Zoom) | pagine $($ws.PageSetup.Pages.Count)"
  }
  $cm = $t.Columns(2).Width / 72 * 2.54
  "Casella: {0:N3} cm di larghezza (modello e file nuovo uguali). Riga civico {1:N3} cm, riga via {2:N3} cm" -f $cm, ($t.Rows(4).Height / 72 * 2.54), ($t.Rows(5).Height / 72 * 2.54)
  if ($diff -eq 0) { 'Excel: tutte le larghezze e altezze uguali al modello' } else { "Excel: $diff differenze" }
  $wbG.ExportAsFixedFormat(0, $Pdf)
  "PDF creato: $Pdf"
  $wbG.Close($false)
  $wbT.Close($false)
}
finally {
  $excel.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
