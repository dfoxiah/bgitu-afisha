$src1='C:\Users\user\Desktop\kursovaya_laravel.docx'
$src2='C:\Users\user\Desktop\afisha_laravel.docx'
$dst1='C:\Users\user\Desktop\kursovaya_laravel_wordsave.docx'
$dst2='C:\Users\user\Desktop\afisha_laravel_wordsave.docx'

$word=$null
$doc1=$null
$doc2=$null
try {
  $word=New-Object -ComObject Word.Application
  $word.Visible=$false
  $word.DisplayAlerts=0

  $doc1=$word.Documents.Open($src1)
  $doc1.SaveAs2($dst1)
  $doc1.Close()
  $doc1=$null

  $doc2=$word.Documents.Open($src2)
  $doc2.SaveAs2($dst2)
  $doc2.Close()
  $doc2=$null

  Write-Output 'WORD_RESAVE_OK'
}
catch {
  Write-Output 'WORD_RESAVE_FAIL'
  Write-Output $_.Exception.Message
}
finally {
  if($doc1 -ne $null){ $doc1.Close() }
  if($doc2 -ne $null){ $doc2.Close() }
  if($word -ne $null){ $word.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
}
