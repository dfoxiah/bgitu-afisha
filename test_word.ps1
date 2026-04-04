$desktop=[Environment]::GetFolderPath("Desktop")
$path=Join-Path $desktop "test_word_codex.docx"
if(Test-Path $path){ Remove-Item $path -Force }
$word=New-Object -ComObject Word.Application
$word.Visible=$false
$word.DisplayAlerts=0
$doc=$word.Documents.Add()
$word.Selection.TypeText("test")
$doc.SaveAs2($path)
$doc.Close()
$word.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc)|Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($word)|Out-Null
if(Test-Path $path){ Write-Output "SAVED" } else { Write-Output "NOT_SAVED" }
